'use strict'

const db = require('../lib/db')
const Boom = require('@hapi/boom')
const emailService = require('./email') // Importamos el servicio de email

class BoletinajeService {
  constructor() {
    if (BoletinajeService.instance) {
      return BoletinajeService.instance
    }
    BoletinajeService.instance = this
  }

  async getPreguntas() {
    const preguntas = await db.models.BoletinajePreguntas.findAll({
      where: { activo: true },
      order: [['orden', 'ASC']]
    })
    return preguntas
  }

  async guardarCuestionario(data) {
    const { id_proveedor, id_empresa_cliente, respuestas } = data

    const transaction = await db.sequelize.transaction()

    try {
      // 1. Crear el grupo de boletinaje para obtener un ID autoincremental
      const grupo = await db.models.BoletinajeGrupo.create({
        id_empresa_cliente,
        id_empresa_proveedor: id_proveedor // Asumiendo que id_proveedor es el que boletina
      }, { transaction })

      const id_boletinaje_grupo = grupo.id_boletinaje_grupo

      // 2. Preparar y guardar las respuestas asociadas al nuevo grupo
      const respuestasAGuardar = respuestas.map(r => ({
        id_boletinaje_grupo,
        id_boletinaje_pregunta: r.id_pregunta,
        respuesta: r.respuesta
      }))

      await db.models.BoletinajeRespuestas.bulkCreate(respuestasAGuardar, { transaction })

      // 3. Determinar si el usuario puede continuar al siguiente paso
      const respuestasAfirmativas = respuestas.filter(r => r.respuesta === true).length
      const puede_continuar = respuestasAfirmativas >= 3 // Se necesitan al menos 3 respuestas afirmativas

      await transaction.commit()

      return {
        id_boletinaje_grupo,
        puede_continuar
      }
    } catch (error) {
      await transaction.rollback()
      // Loggear el error podría ser útil aquí
      throw error
    }
  }

  async guardarReporteImpago (data) {
    const { contactos_deudor = [], ...reporteData } = data
    const ESTATUS_ABIERTO_ID = 1; // Asumimos que 1 = 'Abierto' según el script SQL
    
    const transaction = await db.sequelize.transaction()
    let id_boletinaje_reporte_impago;

    try {
      // --- TRANSACCIÓN ATÓMICA ---
      // 1. Guardar el reporte de impago principal
      const reporte = await db.models.BoletinajeReporteImpago.create({
        ...reporteData,
        id_cat_boletinaje_estatus: ESTATUS_ABIERTO_ID
      }, { transaction })
      id_boletinaje_reporte_impago = reporte.id_boletinaje_reporte_impago

      // 2. Si hay contactos, guardarlos
      if (contactos_deudor.length > 0) {
        const contactosAGuardar = contactos_deudor.map(c => ({
          ...c,
          id_boletinaje_reporte_impago
        }))
        await db.models.BoletinajeReporteImpagoContactos.bulkCreate(contactosAGuardar, { transaction })
      }

      // Si todo va bien, se confirma la transacción
      await transaction.commit()
    } catch (error) {
      // Si algo falla, se deshace todo
      await transaction.rollback()
      if (error.name === 'SequelizeUniqueConstraintError') {
        throw new Error('Ya existe un reporte de impago para este grupo de boletinaje.')
      }
      throw error // Se relanza el error original
    }

    // --- OPERACIONES POST-TRANSACCIÓN ---
    // Si llegamos aquí, la transacción fue exitosa.
    
    // 3. Obtenemos el reporte completo con sus asociaciones para el envío de correo
    const reporteGuardado = await this.getReporteImpagoById(id_boletinaje_reporte_impago)
    
    // 4. Enviar notificaciones (fuera de la transacción)
    try {
      await emailService.enviarNotificacionesDeImpago(reporteGuardado)
    } catch (emailError) {
      // Si el envío de correo falla, no deshacemos la creación del reporte.
      // En un escenario real, aquí se debería loggear el error de forma detallada.
      console.error('Error al enviar las notificaciones por correo:', emailError)
    }
    
    return { id_boletinaje_reporte_impago }
  }

  async getReporteImpagoById(id) {
    const reporte = await db.models.BoletinajeReporteImpago.findOne({
      where: { id_boletinaje_reporte_impago: id },
      include: [
        {
          model: db.models.BoletinajeReporteImpagoContactos,
          as: 'contactos'
        },
        {
          model: db.models.CatBoletinajeEstatus,
          as: 'estatus'
        },
        {
          model: db.models.BoletinajeGrupo,
          as: 'grupo',
          include: {
            model: db.models.Empresa,
            as: 'empresa_proveedor' // Necesitamos el nombre del proveedor
          }
        }
      ]
    })

    if (!reporte) {
      throw Boom.notFound('No se encontró un reporte de impago con el ID proporcionado.')
    }

    return reporte
  }

  async updateReporteImpago(id, data) {
    const reporte = await this.getReporteImpagoById(id) // Este método ya incluye el grupo.

    const [updated] = await db.models.BoletinajeReporteImpago.update(data, {
      where: { id_boletinaje_reporte_impago: id }
    })

    if (updated) {
      return await this.getReporteImpagoById(id) // Devolvemos el reporte actualizado
    }
    // Este caso no debería ocurrir si getReporteImpagoById no falla, pero es una buena práctica
    throw Boom.internal('No se pudo actualizar el reporte de impago.')
  }

  async getReportesImpagoList(options) {
    const { page = 1, limit = 10, id_empresa, tipo_busqueda } = options;
    const offset = (page - 1) * limit;

    const whereClause = {};
    if (tipo_busqueda === 'proveedor') {
      // Reportes que YO he hecho de otros
      whereClause['$grupo.id_empresa_proveedor$'] = id_empresa;
    } else if (tipo_busqueda === 'cliente') {
      // Reportes que OTROS han hecho de mí
      whereClause['$grupo.id_empresa_cliente$'] = id_empresa;
    }

    const { count, rows } = await db.models.BoletinajeReporteImpago.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: db.models.BoletinajeGrupo,
          as: 'grupo',
          attributes: ['id_empresa_proveedor', 'id_empresa_cliente'],
          include: [
            {
              model: db.models.Empresa,
              as: 'empresa_proveedor',
              attributes: ['emp_id', 'emp_nombre', 'emp_rfc']
            },
            {
              model: db.models.Empresa,
              as: 'empresa_cliente',
              attributes: ['emp_id', 'emp_nombre', 'emp_rfc']
            }
          ]
        },
        {
          model: db.models.CatBoletinajeEstatus,
          as: 'estatus',
          attributes: ['nombre']
        }
      ],
      limit,
      offset,
      order: [['fecha_creacion', 'DESC']]
    });

    return {
      total_items: count,
      total_pages: Math.ceil(count / limit),
      current_page: page,
      items: rows
    };
  }

  /**
   * Guarda una notificación de tipo "Sin Impago" y sus incidentes asociados.
   * Utiliza una transacción para asegurar la atomicidad de la operación.
   * @param {object} data - Los datos para la notificación.
   * @returns {Promise<object>} - La notificación guardada.
   */
  async guardarNotificacionSinImpago(data) {
    const { id_proveedor, id_empresa_cliente, acepta_responsabilidad, incidentes } = data

    const t = await db.sequelize.transaction()
    try {
      // 1. Crear la notificación principal
      const notificacion = await db.models.BoletinajeNotificacionSinImpago.create({
        id_empresa_proveedor: id_proveedor,
        id_empresa_cliente,
        acepta_responsabilidad,
      }, { transaction: t })

      // 2. Mapear códigos de incidentes a sus IDs del catálogo
      const codigos = incidentes.map(i => i.codigo_tipo_incidente)
      const tiposIncidenteDb = await db.models.CatBoletinajeTipoIncidenciaSinImpago.findAll({
        where: { codigo: codigos },
        attributes: ['id_cat_boletinaje_tipo_incidencia_sin_impago', 'codigo'],
        raw: true,
      })

      if (tiposIncidenteDb.length !== new Set(codigos).size) {
        await t.rollback()
        throw Boom.badRequest('Uno o más códigos de incidente no son válidos o están duplicados.')
      }

      const mapaCodigosAIds = tiposIncidenteDb.reduce((mapa, tipo) => {
        mapa[tipo.codigo] = tipo.id_cat_boletinaje_tipo_incidencia_sin_impago
        return mapa
      }, {})

      // 3. Preparar y crear los registros de incidentes
      const incidentesData = incidentes.map(incidente => ({
        id_boletinaje_notificacion_sin_impago: notificacion.id_boletinaje_notificacion_sin_impago,
        id_cat_boletinaje_tipo_incidencia_sin_impago: mapaCodigosAIds[incidente.codigo_tipo_incidente],
        razon_social_relacionada: incidente.razon_social_relacionada,
        rfc_relacionado: incidente.rfc_relacionado,
        detalles: incidente.detalles,
      }))

      await db.models.BoletinajeNotificacionSinImpagoIncidentes.bulkCreate(incidentesData, { transaction: t })

      // 4. Confirmar la transacción
      await t.commit()

      return notificacion
    } catch (error) {
      await t.rollback()
      if (error.isBoom) {
        throw error
      }
      throw Boom.internal('Error al guardar la notificación sin impago.', error)
    }
  }
}

const inst = new BoletinajeService()
Object.freeze(inst)

module.exports = inst