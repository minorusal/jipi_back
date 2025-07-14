'use strict'

const boom = require('boom')
const seguimientoClientesService = require('../../services/seguimiento-clientes')

exports.createSeguimiento = async (req, res, next) => {
    try {
        const { id_empresa, razon_social, denominacion, rfc } = req.body
        console.log(req.body)
        // Validaciones
        if (!id_empresa || !razon_social || !denominacion || !rfc) {
            return res.status(400).json({ error: true, mensaje: 'Todos los campos son obligatorios' })
        }

        // Validar que id_empresa sea un número
        if (isNaN(id_empresa) || id_empresa <= 0) {
            return res.status(400).json({ error: true, mensaje: 'ID de empresa inválido' })
        }

        // Validar que denominacion sea un número
        if (isNaN(denominacion) || denominacion <= 0) {
            return res.status(400).json({ error: true, mensaje: 'Denominación inválida' })
        }

        // Validar formato de RFC
        const rfcUpperCase = rfc.toUpperCase()
        const rfcPersonaFisica = /^[A-Z]{4}[0-9]{6}[A-Z0-9]{3}$/
        const rfcPersonaMoral = /^[A-Z]{3}[0-9]{6}[A-Z0-9]{3}$/

        if (!rfcPersonaFisica.test(rfcUpperCase) && !rfcPersonaMoral.test(rfcUpperCase)) {
            return res.status(400).json({ error: true, mensaje: 'Formato de RFC inválido' })
        }

        // Crear el seguimiento
        const resultado = await seguimientoClientesService.createSeguimiento({
            id_empresa,
            razon_social,
            denominacion,
            rfc: rfcUpperCase
        })

        res.status(200).json({
            error: false,
            message: 'Seguimiento creado correctamente',
            data: {
                id: resultado.insertId,
                id_empresa,
                razon_social,
                denominacion,
                rfc: rfcUpperCase,
                estatus: 'en_seguimiento'
            }
        })

    } catch (error) {
        return res.status(500).json({ error: true, mensaje: 'Error interno del servidor' })
    }
}

exports.getAllSeguimientos = async (req, res, next) => {
    try {
        const { id_empresa } = req.query

        if (!id_empresa || isNaN(id_empresa)) {
            return res.status(400).json({ error: true, mensaje: 'ID de empresa es requerido' })
        }

        const seguimientos = await seguimientoClientesService.getAllSeguimientos(parseInt(id_empresa))

        res.status(200).json({
            error: false,
            results: seguimientos
        })

    } catch (error) {
        return res.status(500).json({ error: true, mensaje: 'Error al obtener seguimientos' })
    }
}

exports.updateEstatus = async (req, res, next) => {
    try {
        const { id } = req.params
        const { estatus } = req.body

        if (!id || isNaN(id)) {
            return res.status(400).json({ error: true, mensaje: 'ID inválido' })
        }

        if (!estatus || !['en_seguimiento', 'sin_seguimiento'].includes(estatus)) {
            return res.status(400).json({ error: true, mensaje: 'Estatus inválido. Debe ser "en_seguimiento" o "sin_seguimiento"' })
        }

        const resultado = await seguimientoClientesService.updateEstatus(id, estatus)

        res.status(200).json({
            error: false,
            message: 'Estatus actualizado correctamente',
            data: {
                id: parseInt(id),
                estatus
            }
        })

    } catch (error) {
        return res.status(500).json({ error: true, mensaje: 'Error al actualizar estatus' })
    }
}

exports.importarSeguimientosMasivos = async (req, res, next) => {
    try {
        const { id_empresa, seguimientos } = req.body;
        if (!id_empresa || !Array.isArray(seguimientos) || seguimientos.length === 0) {
            return res.status(400).json({ error: true, mensaje: 'Datos incompletos para importación masiva' });
        }
        // Validar campos mínimos
        for (const s of seguimientos) {
            if (!s.empresa || !s.denominacion || !s.rfc) {
                return res.status(400).json({ error: true, mensaje: 'Todos los campos son obligatorios en cada registro' });
            }
        }
        // Obtener RFCs existentes
        const rfcs = seguimientos.map(s => s.rfc);
        const existentes = await seguimientoClientesService.obtenerRfcsExistentes(id_empresa, rfcs);
        const rfcsExistentes = existentes.map(e => e.rfc);
        // Filtrar los que no existen
        const nuevos = seguimientos.filter(s => !rfcsExistentes.includes(s.rfc));
        let insertados = 0;
        if (nuevos.length > 0) {
            const resultado = await seguimientoClientesService.insertarSeguimientosMasivos(id_empresa, nuevos);
            insertados = resultado.insertados;
        }
        res.status(200).json({
            error: false,
            insertados,
            duplicados: seguimientos.length - nuevos.length
        });
    } catch (error) {
        return res.status(500).json({ error: true, mensaje: 'Error al importar seguimientos masivos' });
    }
}

exports.actualizarEstatusMasivo = async (req, res, next) => {
  try {
    const { id_empresa, estatus_origen, estatus_destino } = req.body;
    if (!id_empresa || !estatus_origen || !estatus_destino) {
      return res.status(400).json({ error: true, mensaje: 'Faltan parámetros para actualización masiva' });
    }
    if (!['en_seguimiento', 'sin_seguimiento'].includes(estatus_origen) || !['en_seguimiento', 'sin_seguimiento'].includes(estatus_destino)) {
      return res.status(400).json({ error: true, mensaje: 'Estatus inválido' });
    }
    const resultado = await seguimientoClientesService.actualizarEstatusMasivo(id_empresa, estatus_origen, estatus_destino);
    res.status(200).json({
      error: false,
      message: 'Estatus actualizado masivamente',
      updated: resultado.affectedRows || 0
    });
  } catch (error) {
    return res.status(500).json({ error: true, mensaje: 'Error al actualizar estatus masivo' });
  }
}
