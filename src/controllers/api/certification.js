'use strict'

const axios = require('axios')
const { callKoneshApi } = require('./konesh')
const debug = require('debug')('old-api:certification-router')
const fsp = require('fs').promises
const html_to_pdf = require('html-pdf-node')
const { cronosSecretKey: secretKeyCronos, cronosURL: { certification: URLConsultaCronos } } = require('../../config')
const boom = require('boom')
const stripe = require('../../lib/stripe')
const certificationService = require('../../services/certification')
const utilitiesService = require('../../services/utilities')
const companiesService = require('../../services/companies')
const paymentsService = require('../../services/payments')
const hadesService = require('../../services/hades')
const algorithmService = require('../../services/algorithm')
const blocService = require('../../services/bloc')
const blocController = require('./bloc')
const cronosTypes = { certification: 'Certification', report: 'Report' }
const uploadImageS3 = require('../../utils/uploadImageS3')
const logger = require('../../utils/logs/logger')
const cipher = require('../../utils/cipherService')
const nodemailer = require('nodemailer')
const { toNumber, getLimits } = require('../../utils/numberUtils')

const { sendCompaniEmail } = require('./mailjet-controler')

const fs = require('fs')
const path = require('path')
const CryptoJS = require('crypto-js')

const { emailjet: { key, secretKey, sender: { from } } } = require('../../config')
const mailjet = require('node-mailjet').apiConnect(key, secretKey)

Object.freeze(cronosTypes)

const REFERENCIA_IDS = Object.freeze({
  BUENAS_4: 1,
  BUENAS_2_3: 2,
  BUENA_1: 3,
  MALAS: 4,
  MIXTAS: 5,
  NINGUNA: 6
})

const SCORE_KEYS = [
  '_01_pais',
  '_02_sector_riesgo',
  '_03_capital_contable',
  '_04_plantilla_laboral',
  '_05_sector_cliente_final',
  '_06_tiempo_actividad',
  '_07_influencia_controlante',
  '_08_ventas_anuales',
  '_09_tipo_cifras',
  '_10_incidencias_legales',
  '_11_evolucion_ventas',
  '_12_apalancamiento',
  '_13_flujo_neto',
  '_14_payback',
  '_15_rotacion_ctas_x_cobrar',
  '_16_referencias_comerciales'
]

const SCORE_KEY_MAP = {
  _01_pais: 'paisScore',
  _02_sector_riesgo: 'sectorRiesgoScore',
  _03_capital_contable: 'capitalContableScore',
  _04_plantilla_laboral: 'plantillaLaboralScore',
  _05_sector_cliente_final: 'sectorClienteFinalScore',
  _06_tiempo_actividad: 'tiempoActividadScore',
  _07_influencia_controlante: 'influenciaControlanteScore',
  _08_ventas_anuales: 'ventasAnualesScore',
  _09_tipo_cifras: 'tipoCifrasScore',
  _10_incidencias_legales: 'incidenciasLegalesScore',
  _11_evolucion_ventas: 'evolucionVentasScore',
  _12_apalancamiento: 'apalancamientoScore',
  _13_flujo_neto: 'flujoNetoScore',
  _14_payback: 'paybackScore',
  _15_rotacion_ctas_x_cobrar: 'rotacionCtasXCobrarScore',
  _16_referencias_comerciales: 'referenciasProveedoresScore'
}


let referenciasCatalogo = {}

const loadReferenciasCatalogo = async () => {
  try {
    const catalogo = await certificationService.getCatResultadoReferenciasProveedores()
    referenciasCatalogo = catalogo.reduce((acc, ref) => {
      acc[ref.id_cat_resultado_referencias_proveedores] = ref
      return acc
    }, {})
  } catch (error) {
    console.error('Error al cargar el catalogo de referencias:', error)
    referenciasCatalogo = {}
  }
}
let globalConfig = {}

const loadGlobalConfig = async () => {
  try {
    globalConfig = await utilitiesService.getParametros()
  } catch (error) {
    console.error('Error al cargar la configuración global:', error)
    throw new Error('Error al cargar la configuración global')
  }
}

loadGlobalConfig()
loadReferenciasCatalogo()

let algorithmConstants = {
  monto_mayor1500: 1500000,
  monto_menor500: 500000,
  dpo_mayor1500: { sin: 120, conUno: 90, conDos: 30 },
  dpo_menor500: { sin: 30 },
  dpo_entre500y1500: { sin: 90, conUno: 60, conDos: 30 },
  logitFactor: 0.0784,
  logitConstant: 2.9834,
  ref_malas_porcentaje: 20,
  ref_malas_dias: 90
}

const loadAlgorithmConstants = async () => {
  try {
    const params = await utilitiesService.getParametros()
    const getVal = name => {
      const p = params.find(it => it.nombre === name)
      return p ? parseFloat(p.valor) : null
    }

    algorithmConstants = {
      monto_mayor1500: getVal('monto_mayor1500') ?? algorithmConstants.monto_mayor1500,
      monto_menor500: getVal('monto_menor500') ?? algorithmConstants.monto_menor500,
      dpo_mayor1500: {
        sin: getVal('dpo_mayor1500_sin') ?? algorithmConstants.dpo_mayor1500.sin,
        conUno: getVal('dpo_mayor1500_con_uno') ?? algorithmConstants.dpo_mayor1500.conUno,
        conDos: getVal('dpo_mayor1500_con_dos') ?? algorithmConstants.dpo_mayor1500.conDos
      },
      dpo_menor500: {
        sin: getVal('dpo_menor500') ?? algorithmConstants.dpo_menor500.sin
      },
      dpo_entre500y1500: {
        sin: getVal('dpo_entre500y1500_sin') ?? algorithmConstants.dpo_entre500y1500.sin,
        conUno: getVal('dpo_entre500y1500_con_uno') ?? algorithmConstants.dpo_entre500y1500.conUno,
        conDos: getVal('dpo_entre500y1500_con_dos') ?? algorithmConstants.dpo_entre500y1500.conDos
      },
      logitFactor: getVal('algoritmo_logit_factor') ?? algorithmConstants.logitFactor,
      logitConstant: getVal('algoritmo_logit_constant') ?? algorithmConstants.logitConstant,
      ref_malas_porcentaje: getVal('referencia_malas_porcentaje') ?? algorithmConstants.ref_malas_porcentaje,
      ref_malas_dias: getVal('referencia_malas_dias') ?? algorithmConstants.ref_malas_dias
    }
  } catch (error) {
    console.error('Error al cargar parametros de algoritmo:', error)
  }
}

loadAlgorithmConstants()

// Procesa generación de PDF y envío de correo de manera asíncrona
async function processReporteCreditoAsync({
  customUuid,
  id_cliente,
  id_proveedor,
  id_reporte_credito,
  reporteCredito,
  id_certification
}) {
  const fileMethod = `file: src/controllers/api/certification.js - method: processReporteCreditoAsync`
  try {
    const location = await generarReporteCredito(customUuid, id_cliente, id_reporte_credito, reporteCredito, id_certification)
    reporteCredito.reporte_pdf = location.archivo
    logger.info(`${fileMethod} | ${customUuid} Reporte de credito pdf: ${JSON.stringify(location)}`)
    reporteCredito.id_reporte_credito = id_reporte_credito
    await certificationService.insertReporteCredito(id_certification, reporteCredito, customUuid)

    if (location?.archivo) {
      const empresa_info = await certificationService.getUsuarioEmail(id_proveedor)
      const [{ usu_nombre: nombre, usu_email: email }] = empresa_info
      const templateID = 6967845

      const cliente = await certificationService.consultaEmpresaInfo(id_cliente)
      const _cliente = cliente?.result?.[0]?.emp_razon_social || 'No encontrado'

      const proveedor = await certificationService.consultaEmpresaInfo(id_proveedor)
      const _proveedor = proveedor?.result?.[0]?.emp_razon_social || 'No encontrado'

      await sendCompaniEmail({
        email,
        nombre,
        templateID,
        empresa: _cliente,
        empresa_envia: _proveedor
      })
    }
  } catch (error) {
    const errorJSON = serializeError(error)
    errorJSON.origenError = `Error en proceso as\u00edncrono`
    errorJSON.customUuid = customUuid
    await sendEmailNodeMailer({ info_email_error: errorJSON })
    logger.error(`${fileMethod} | ${customUuid} Error proceso as\u00edncrono: ${error.message}`)
  }
}

async function obtenerDemandas(nombre) {
  const block_demandas = await globalConfig.find(item => item.nombre === 'block_demandas').valor
  const block_demandas_url = block_demandas
    .replace('||', encodeURIComponent(nombre))
    .replace('||', encodeURIComponent(''))

  const startTs = Date.now()
  let response
  let status
  let errorMsg = null

  try {
    response = await axios.get(block_demandas_url)
    status = response.status
  } catch (err) {
    status = err.response ? err.response.status : null
    errorMsg = err.message
    response = err.response || { data: null }
    const responseTimeErr = Date.now() - startTs
    try {
      await blocService.saveBlocResponse({
        endpoint_name: 'block_demandas',
        request_url: block_demandas_url,
        http_status: status,
        response_time_ms: responseTimeErr,
        response_json: response ? JSON.stringify(response.data) : null,
        error_message: errorMsg
      })
    } catch (e) {
      logger.error(`Error saving bloc response: ${e.message}`)
    }
    throw err
  }

  const responseTime = Date.now() - startTs
  try {
    await blocService.saveBlocResponse({
      endpoint_name: 'block_demandas',
      request_url: block_demandas_url,
      http_status: status,
      response_time_ms: responseTime,
      response_json: response ? JSON.stringify(response.data) : null,
      error_message: errorMsg
    })
  } catch (e) {
    logger.error(`Error saving bloc response: ${e.message}`)
  }

  // Normalize and filter demandas by type and date
  const results = response.data?.results || {}
  let demandas = []
  Object.values(results).forEach(arr => {
    if (Array.isArray(arr)) {
      demandas = demandas.concat(
        arr.map(item => ({
          ...item,
          tipo_proceso: item.tipo_proceso || item.tipo,
          fecha: item.fecha
        }))
      )
    }
  })

  const haceUnAño = new Date()
  haceUnAño.setFullYear(haceUnAño.getFullYear() - 1)

  const filtered = demandas.filter(d => {
    const tipo = (d.tipo_proceso || '').toLowerCase()
    const fecha = new Date(d.fecha)
    return (
      fecha >= haceUnAño &&
      (tipo.includes('mercantil') || tipo.includes('penal'))
    )
  })

  return { data: { demandas: filtered } }
}

const duplicateRegister = async (body, certificacion_id) => {
  try {
    const latestCertification = await certificationService.duplicateCertification(body, certificacion_id)
    if (!latestCertification) return false

    const latestCertificationInmueble = await certificationService.duplicateCertificationInmueble(latestCertification.certificacion_id)
    if (!latestCertificationInmueble) return false

    const latestCertificationReferenciaComercial = await certificationService.duplicateCertificationReferences(latestCertification.certificacion_id)
    if (!latestCertificationReferenciaComercial) return false

    const latestCertificationRepresentatives = await certificationService.duplicateRepresentatives(latestCertification.certificacion_id)
    if (!latestCertificationRepresentatives) return false

    const latestCertificationRelatedCompanies = await certificationService.duplicateRelatedCompanies(latestCertification.certificacion_id)
    if (!latestCertificationRelatedCompanies) return false

    const latestCertificationFinancialRecords = await certificationService.duplicateFinancialRecords(latestCertification.certificacion_id)
    if (!latestCertificationFinancialRecords) return false

    const latestCertificationDocuments = await certificationService.duplicateCertificationDocuments(latestCertification.certificacion_id)
    if (!latestCertificationDocuments) return false

    return latestCertificationReferenciaComercial[0].certificacion_id

  } catch (error) {
    return false
  }
}

const insercionSeccion1 = async (body, certificacionIniciadaFlag, certificacion_id) => {
  try {
    if (certificacionIniciadaFlag) {

      if (body.new) {
        let newIdCertificacion = await duplicateRegister(body, certificacion_id)
        if (!newIdCertificacion) return false
        await certificationService.updateOrCreatePropertiesAndReferences(body, newIdCertificacion);

        // Aquí se actualizan los registros se la sección 1 en caso de que envien nuevamente los datos
        const actualizaCertificacion = await certificationService.updateCertification(body);
        if (actualizaCertificacion === 0) return false

        return true
      }

      // Aquí se actualizan los registros se la sección 1 en caso de que envien nuevamente los datos
      const actualizaCertificacion = await certificationService.updateCertification(body);
      if (actualizaCertificacion === 0) return false

      // Revisar países de referencias comerciales
      const { referencia_comercial: referencias } = body
      for (let i = 0; i < referencias.length; i++) {
        const referencia = referencias[i]
        const { pais } = referencia
        const [existePais] = await certificationService.getCountryById(pais)
        if (!existePais) return false
      }

      await certificationService.updateOrCreatePropertiesAndReferences(body, certificacion_id);

      return true
    } else {
      // Revisar herramienta de protección
      const { herramienta_proteccion: herramienta } = body
      const herramientas = await certificationService.getTools()
      const [existeHerramienta] = herramientas.filter(h => h.herramienta_id === herramienta)
      if (!existeHerramienta) return false

      // Revisar países de referencias comerciales
      const { referencia_comercial: referencias } = body
      for (let i = 0; i < referencias.length; i++) {
        const referencia = referencias[i]
        const { pais } = referencia
        const [existePais] = await certificationService.getCountryById(pais)
        if (!existePais) return false
      }

      // Insertar en base de datos
      body.n_certificacion = 1;
      const { affectedRows: certificacionCreada, insertId: certificacionID } = await certificationService.createCertification(body)
      if (certificacionCreada === 0) return false
      // Insertar inmuebles
      const { inmuebles } = body
      for (let i = 0; i < inmuebles.length; i++) {
        if (!inmuebles[i].precio) {
          inmuebles[i].precio = null
        }
        await certificationService.createProperties(inmuebles[i], certificacionID)
      }

      for (let i = 0; i < referencias.length; i++) {
        await certificationService.createReferences(referencias[i], certificacionID)
      }
      return true
    }
  } catch (error) {
    return false
  }
}

const insercionSeccion2 = async (body, certificacionIniciadaFlag, certificacion_id) => {
  try {
    if (certificacionIniciadaFlag) {

      if (body.new) {
        let newIdCertificacion = await duplicateRegister(body, certificacion_id)
        if (!newIdCertificacion) return false
        const addRepresentantes = await certificationService.updateOrCreateRepresentatives(body, newIdCertificacion);
        if (addRepresentantes === 0) return false
        return true
      }

      const addRepresentantes = await certificationService.updateOrCreateRepresentatives(body, certificacion_id);
      if (addRepresentantes === 0) return false
      return true
    } else {
      const { affectedRows: certificacionCreada, insertId: certificacionID } = await certificationService.createCertificationRegister(body)
      if (certificacionCreada === 0) return false
      const addRepresentantes = await certificationService.updateOrCreateRepresentatives(body, certificacionID);
      if (addRepresentantes === 0) return false
      return true
    }
  } catch (error) {
    return false
  }
}

const insercionSeccion3 = async (body, certificacionIniciadaFlag, certificacion_id) => {
  try {
    if (certificacionIniciadaFlag) {

      if (body.new) {
        let newIdCertificacion = await duplicateRegister(body, certificacion_id)
        if (!newIdCertificacion) return false
        const addRepresentantes = await certificationService.updateOrCreateRelatedCompanies(body, newIdCertificacion);
        if (addRepresentantes === 0) return false
        return true
      }

      const addRepresentantes = await certificationService.updateOrCreateRelatedCompanies(body, certificacion_id);
      if (addRepresentantes === 0) return false
      return true
    } else {
      const { affectedRows: certificacionCreada, insertId: certificacionID } = await certificationService.createCertificationRegister(body)
      if (certificacionCreada === 0) return false
      const addRepresentantes = await certificationService.updateOrCreateRelatedCompanies(body, certificacionID);
      if (addRepresentantes === 0) return false
      return true
    }
  } catch (error) {
    console.log(error)
    return false
  }
}

const insercionSeccion4 = async (body, certificacionIniciadaFlag, certificacion_id) => {
  try {
    const { empresa, seccion, fecha, periodo_activo, periodo_pasivo, unidad_neta, ventas } = body;
    if (certificacionIniciadaFlag) {


      if (body.new) {
        let newIdCertificacion = await duplicateRegister(body, certificacion_id)
        if (!newIdCertificacion) return false

        const updatePartidaFinanciera = await certificationService.updateFinancialRecord(newIdCertificacion, body);
        if (updatePartidaFinanciera === 0) return false
        return true

      }

      const existPartidaFinanciera = await certificationService.getFinancialRecord(certificacion_id);
      if (existPartidaFinanciera.result.length === 0) {
        const addPartidaFinanciera = await certificationService.insertFinancialRecord(certificacion_id, body);
        if (addPartidaFinanciera === 0) return false
      } else {
        const updatePartidaFinanciera = await certificationService.updateFinancialRecord(certificacion_id, body);
        if (updatePartidaFinanciera === 0) return false
      }
      return true;
    } else {
      const { affectedRows: certificacionCreada, insertId: certificacionID } = await certificationService.createCertificationRegister({ empresa, fecha });
      if (certificacionCreada === 0) return false
      const addPartidaFinanciera = await certificationService.insertFinancialRecord(certificacionID, { seccion, fecha, periodo_activo, periodo_pasivo, unidad_neta, ventas });
      if (addPartidaFinanciera === 0) return false
      return true;
    }
  } catch (error) {
    return false;
  }
}

const postCertification = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  const fileMethod = `file: src/controllers/api/certification.js - method: postCertification`
  try {
    const { body } = req;
    logger.info(`${fileMethod} - Inicio para crear certificación con la siguiente información: ${JSON.stringify(body)}`)
    const { empresa: empresaID } = body
    logger.info(`${fileMethod} - Proceso de certificación de la empresa con ID: ${empresaID}`)
    let certificacion_id;
    let certificacionIniciadaFlag = false;


    // Existe la empresa
    const [empresa] = await companiesService.getEmpresa(empresaID)
    logger.info(`${fileMethod} - Proceso de certificación de la empresa: ${JSON.stringify(empresa)}`)

    if (!empresa) {
      logger.warn(`${fileMethod} - La empresa con ID ${empresaID} no existe`)
      return next(boom.badRequest('Company does not exist'))
    }

    // Revisar que la empresa tenga un telefono
    const tieneTelefono = await certificationService.getCompanyPhone(empresaID)
    logger.info(`${fileMethod} - Número telefonico de la empresa: ${JSON.stringify(tieneTelefono)}`)

    if (!tieneTelefono) {
      logger.warn(`${fileMethod} - La empresa con ID ${empresaID} no tiene número telefonico, es importante registrar uno para la certificación`)
      return next(boom.badRequest('Phone does not exists'))
    }

    // Existe certificación iniciada
    const certificacionIniciada = await certificationService.getCertification(empresaID)
    logger.info(`${fileMethod} - Esta es la información de la certificación actual de la empresa: ${JSON.stringify(certificacionIniciada)}`)
    if (certificacionIniciada) {
      certificacion_id = certificacionIniciada.certificacion_id;
      certificacionIniciadaFlag = true;
    }


    logger.info(`${fileMethod} - Sección: ${body.seccion.toString()}, información a guardar:  ${JSON.stringify(body)}, Certificación iniciada?: ${certificacionIniciadaFlag}`)
    switch (body.seccion) {
      case 1:
        const insercionSeccionUno = await insercionSeccion1(body, certificacionIniciadaFlag, certificacion_id);
        if (!insercionSeccionUno) {
          logger.error(`${fileMethod} - Ocurrio un problema al insertar la sección 1 de certificación`)
          return next(boom.badRequest('Error en la inserción en sección 1'));
        }
        break;
      case 2:
        const insercionSeccionDos = await insercionSeccion2(body, certificacionIniciadaFlag, certificacion_id);
        if (!insercionSeccionDos) {
          logger.error(`${fileMethod} - Ocurrio un problema al insertar la sección 2 de certificación`)
          return next(boom.badRequest('Error en la inserción en sección 2'));
        }
        break;
      case 3:
        const insercionSeccionTres = await insercionSeccion3(body, certificacionIniciadaFlag, certificacion_id);
        if (!insercionSeccionTres) {
          logger.error(`${fileMethod} - Ocurrio un problema al insertar la sección 3 de certificación`)
          return next(boom.badRequest('Error en la inserción en sección 3'));
        }
        break;
      case 4:
        const insercionSeccionCuatro = await insercionSeccion4(body, certificacionIniciadaFlag, certificacion_id);
        if (!insercionSeccionCuatro) {
          logger.error(`${fileMethod} - Ocurrio un problema al insertar la sección 4 de certificación`)
          return next(boom.badRequest('Error en la inserción en sección 4'));
        }
        break;
      default:
        logger.error(`${fileMethod} - La sección ${body.seccion} es desconocida`)
        return next(boom.badRequest('Sección desconocida'));
    }

    logger.info(`${fileMethod} - Objeto de respuesta del enspoint:  ${JSON.stringify({
      error: false,
      results: {
        created: true,
        certification: body
      }
    })}`)

    const encryptedResponse = await cipher.encryptData(JSON.stringify({
      error: false,
      results: {
        created: true,
        certification: body
      }
    }));

    return res.status(200).send(encryptedResponse)

    // Obtener estatus actual de certificación
    const { emp_certificada: estatusCertificacion } = empresa
    const [certificada, pendiente] = [1, 2]
    // ¿La empresa ya está certificada?
    if (estatusCertificacion === certificada) return next(boom.badRequest('Company already certified'))

    // En este punto se debe preparar variable que diga en que estatus de la certificacion se encuentra la empresa para retornarla cuando se requiera enviar nueva información
    // ¿La empresa ya está en proceso de certificarse?
    if (estatusCertificacion === pendiente) return next(boom.badRequest('Company in process'))

    // Revisar herramienta de protección
    const { herramienta_proteccion: herramienta } = body
    const herramientas = await certificationService.getTools()
    const [existeHerramienta] = herramientas.filter(h => h.herramienta_id === herramienta)
    if (!existeHerramienta) return next(boom.badRequest('Bad tool'))

    // Revisar países de referencias comerciales
    // const { referencias_comerciales: referencias } = body
    // for (let i = 0; i < referencias.length; i++) {
    //   const referencia = referencias[i]
    //   const { pais } = referencia
    //   const [existePais] = await certificationService.getCountryById(pais)
    //   if (!existePais) return next(boom.badRequest(`No existe país ${pais}`))
    // }

    // Revisar que todos los porcentajes no den más de 100%
    const { representantes } = body
    const total = representantes.reduce((vi, cv) => {
      if (cv.porcentaje) {
        return vi + cv.porcentaje
      } else {
        return vi + 0
      }
    }, 0)

    if (total > 100) return next(boom.badRequest(`La suma de porcentajes (${total}%) es mayor a 100%`))

    // Insertar en base de datos
    // const { affectedRows: certificacionCreada, insertId: certificacionID } = await certificationService.createCertification(body)
    // if (certificacionCreada === 0) return next(boom.badRequest('No creada'))

    // Insertar más datos con el ID de la certificación

    // Insertar referencias comerciales
    for (let i = 0; i < referencias.length; i++) {
      await certificationService.createReferences(referencias[i], certificacionID)
    }

    // Insertar inmuebles
    const { inmuebles } = body
    for (let i = 0; i < inmuebles.length; i++) {
      if (!inmuebles[i].precio) {
        inmuebles[i].precio = null
      }
      await certificationService.createProperties(inmuebles[i], certificacionID)
    }

    // Insertar representantes
    for (let i = 0; i < representantes.length; i++) {
      const representante = representantes[i]
      // El primer representante tiene que ser el accionista
      if (i === 0) {
        const { accionista } = representante
        if (!accionista) {
          representante.accionista = '1'
        }
      } else {
        representante.accionista = '0'
      }
      const { porcentaje } = representante
      if (!porcentaje) {
        representante.porcentaje = 0
      }
      await certificationService.createRepresentative(representante, certificacionID)
    }

    // Insertar empresas relacionadas
    const { empresas_relacionadas: empresas } = body
    for (let i = 0; i < empresas.length; i++) {
      await certificationService.createRelatedCompany(empresas[i], certificacionID)
    }

    // Cambiar estatus de certificación a empresa para dejarlo como "pendiente"
    await certificationService.updateStatus(empresaID, pendiente)

    // Crea un puente entre MC y Arca
    const certificationDetails = await certificationService.getCertificationDetails(certificacionID)
    await hadesService.sendDataToCronos(cronosTypes.certification, certificationDetails)

    return res.json({
      error: false,
      results: {
        created: true,
        certification: body
      }
    })
  } catch (err) {
    logger.error(`${fileMethod} - Ocurrio un problema al crear la certificación certificación`)
    next(err)
  }
}

const iniciaCertificacion = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: iniciaCertificacion`;
  try {
    const { body } = req;
    const { id_empresa, id_usuario, direccion_fiscal, accionistas, incidencias_legales, empresas_relacionadas, principales_directores, estructura_personal, equipo_transporte, seguros, industria_id } = body
    let updateIdCertification = false

    logger.info(`${fileMethod} | Inicio para crear certificación con la siguiente información: ${JSON.stringify(body)}`)

    const [empresa] = await companiesService.getEmpresa(id_empresa)
    logger.info(`${fileMethod} | Proceso de certificación de la empresa: ${JSON.stringify(empresa)}`)

    if (!empresa) {
      logger.warn(`${fileMethod} | La empresa con ID ${id_empresa} no existe`)
      return next(boom.badRequest('La empresa no existe'))
    }
    await companiesService.editEmpresaCertification(id_empresa, industria_id)

    const certificacion = await certificationService.getCertificacionByEmpresa(id_empresa)
    if (certificacion.result.length > 0) {
      logger.info(`${fileMethod} | Datos de la certificación de la empresa: ${id_empresa}`)
      await certificationService.updateEstatusCertificacion(certificacion.result[0].id_certification, 'cancelada')

      logger.info(`${fileMethod} | Se cancela la certificación anterior para ingresar los datos de la nueva ${certificacion.result[0].id_certification}`)

      updateIdCertification = true
    }

    const [usuario_empresa] = await companiesService.getUsuarioEmpresa(id_usuario, id_empresa)
    if (!usuario_empresa) {
      logger.warn(`${fileMethod} | La empresa con ID ${id_empresa} no tiene relacion con el usuario ${id_usuario}`)
      return next(boom.badRequest(`La empresa con ID ${id_empresa} no tiene relacion con el usuario ${id_usuario}`))
    }

    if (accionistas && accionistas.length > 0) {
      let controlantes = 0
      for (const accionista of accionistas) {
        if (parseInt(accionista.controlante) === 1) {
          controlantes += 1
          accionista.controlante = 1
        } else {
          accionista.controlante = 0
        }
        if (accionista.conteo_error_rfc === undefined) accionista.conteo_error_rfc = 0
        if (accionista.razon_sat_rfc === undefined) accionista.razon_sat_rfc = ''
      }
      if (controlantes > 1) {
        logger.warn(`${fileMethod} | Se debe indicar como máximo un accionista controlante`)
        return next(boom.badRequest('Debe existir como máximo un accionista controlante'))
      }
    }

    const insertCert = await certificationService.iniciaCertification(body)
    if (!insertCert.result) {
      logger.warn(`${fileMethod} | No se insertaron los datos primarios para la certificación`);
      return next(boom.badRequest('No se insertaron los datos primarios para la certificación'));
    }

    if (empresas_relacionadas.length > 0) {
      for (let i in empresas_relacionadas) {
        const insertEmpresasRel = await certificationService.insertEmpresasRel(insertCert.result.insertId, empresas_relacionadas[i])
        if (!insertEmpresasRel.result) {
          logger.warn(`${fileMethod} | No se insertaron los datos de empresas relacionadas para la certificación`)
          return next(boom.badRequest('No se insertaron los datos de empresas relacionadas para la certificación'))
        }
      }
    }

    const uniqueIncidencias = []
    const seenKeys = new Set()

    if (certificacion.result.length > 0) {
      await certificationService.deleteDemandas(certificacion.result[0].id_certification)
    }
    if (incidencias_legales && incidencias_legales.length > 0) {
      for (let i = 0; i < incidencias_legales.length; i++) {
        const item = incidencias_legales[i];

        const comments = item.comentarios;
        if (comments && comments != null) {
          const match = comments.match(/EXP: (\d+\/\d+)/);
          const key = match ? match[1] : null;

          if (key && !seenKeys.has(key)) {
            seenKeys.add(key);
            uniqueIncidencias.push(item);
          } else if (!key) {
            uniqueIncidencias.push(item);
          }
        }
      }
      if (certificacion.result.length == 0) {
      } else {
        // await certificationService.deleteDemandas(certificacion.result[0].id_certification)
        for (let i in uniqueIncidencias) {
          const insertDemandas = await certificationService.insertDemandas(uniqueIncidencias[i], insertCert.result.insertId)
          if (!insertDemandas.result) {
            logger.warn(`${fileMethod} | No se insertaron los datos de demandas para la certificación`);
            return next(boom.badRequest('No se insertaron los datos de demandas para la certificación'));
          }
        }
      }
    }

    const updateEmpresaInfo = await certificationService.updateEmpresaInfo(body)
    if (!updateEmpresaInfo.result) {
      logger.warn(`${fileMethod} | No se actualizaron los datos de la empresa para la certificación`);
      return next(boom.badRequest('No se actualizaron los datos de la empresa para la certificación'));
    }

    const updateDomicilioCertificacion = await certificationService.insertDomicilioFiscal(id_empresa, 3, direccion_fiscal)
    if (!updateDomicilioCertificacion) {
      logger.warn(`${fileMethod} | No se actualizaron los datos de la direccion fiscal de empresa para la certificación`);
      return next(boom.badRequest('No se actualizaron los datos de la direccion fiscal de  la empresa para la certificación'));
    }

    for (let accionista of accionistas) {
      const insertAcci = await certificationService.insertaAccionista(insertCert.result.insertId, accionista);
      if (!insertAcci.result) {
        logger.warn(`${fileMethod} | No se insertó el accionista: ${JSON.stringify(accionista)}`);
        return next(boom.badRequest(`No se insertó el accionista: ${JSON.stringify(accionista)}`));
      }
    }
    body.id_certification = insertCert.result.insertId
    if (certificacion.result.length > 0) {
      await certificationService.actualizaReferenciaComercialIdCertification(body, certificacion.result[0].id_certification)
    }

    if (principales_directores.length > 0) {
      for (let director in principales_directores) {
        const insertDirectores = await certificationService.insertDirectores(principales_directores[director], body.id_certification)
        if (!insertDirectores.result) {
          logger.warn(`${fileMethod} | No se insertó el director: ${JSON.stringify(director)}`);
          return next(boom.badRequest(`No se insertó el director: ${JSON.stringify(director)}`));
        }
      }
    }

    if (
      !estructura_personal.personal_operativo &&
      !estructura_personal.personal_administrativo &&
      !estructura_personal.personal_directivo
    ) {
    } else {
      const insertPersonal = await certificationService.insertEstructuraPersonal(estructura_personal, body.id_certification)
      if (!insertPersonal.result) {
        logger.warn(`${fileMethod} | No se inserto la estructura del personal`);
        return next(boom.badRequest('No se inserto la estructura del personal'))
      }
    }

    if (
      !equipo_transporte.flotilla_transporte_carga_transporte_especializado &&
      !equipo_transporte.flotilla_otros_vehiculos
    ) {
    } else {
      const insertEquipoTransporte = await certificationService.insertEquipoTransporte(equipo_transporte, body.id_certification)
      if (!insertEquipoTransporte.result) {
        logger.warn(`${fileMethod} | No se inserto el equipo de transporte`)
        return next(boom.badRequest('No se inserto el equipo de transporte'))
      }
    }

    if (seguros.length > 0) {
      for (let seguro in seguros) {
        const insertSeguros = await certificationService.insertSeguros(seguros[seguro], body.id_certification)
        if (!insertSeguros.result) {
          logger.warn(`${fileMethod} | No se insertó el seguro: ${JSON.stringify(seguro)}`);
          return next(boom.badRequest(`No se insertó el seguro: ${JSON.stringify(seguro)}`));
        }
      }
    }

    if (updateIdCertification) {
      logger.warn(`${fileMethod} |Se actualiza id_certification para los catalogos [documentos, estado de balance, estado de resultados, referencias comerciales]`);
    }

    logger.warn(`${fileMethod} | Respuesta exitosa que regresara el endpoint: ${JSON.stringify({
      error: false,
      results: {
        created: true,
        certification: body
      }
    })}`);

    return res.json({
      error: false,
      results: {
        created: true,
        certification: body
      }
    })

  } catch (error) {
    logger.warn(`${fileMethod} | Error general del endpoint ${error}`);
    next(error)
  }
}


const getIndustria = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: getIndustria`;
  try {
    const industries = await certificationService.getIndustries()

    if (!industries) {
      logger.warn(`${fileMethod} | No fue posible obtener el listado de industrias`)
      return next(boom.badRequest('No fue posible obtener el listado de industrias'));
    }

    logger.info(`${fileMethod} | Respuesta exitosa que regresara el endpoint: ${JSON.stringify({
      error: false,
      results: {
        industries: industries.result
      }
    })}`)

    return res.json({
      error: false,
      results: {
        industries: industries.result
      }
    })

  } catch (error) {
    logger.warn(`${fileMethod} | Error general del endpoint ${JSON.stringify(error)}`);
    next(error)
  }
}

const getBienesAsegurados = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: getBienesAsegurados`;
  try {
    const bienesAsegurados = await certificationService.getBienesAsegurados()

    if (!bienesAsegurados) {
      logger.warn(`${fileMethod} | No fue posible obtener el listado de bienesAsegurados`)
      return next(boom.badRequest('No fue posible obtener el listado de bienesAsegurados'));
    }

    logger.info(`${fileMethod} | Respuesta exitosa que regresara el endpoint: ${JSON.stringify({
      error: false,
      results: {
        bienesAsegurados: bienesAsegurados.result
      }
    })}`)

    return res.json({
      error: false,
      results: {
        bienesAsegurados: bienesAsegurados.result
      }
    })

  } catch (error) {
    logger.warn(`${fileMethod} | Error general del endpoint ${JSON.stringify(error)}`);
    next(error)
  }
}

const getPoderes = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: getPoderes`;
  try {
    const poderes = await certificationService.getPoderes()

    if (!poderes) {
      logger.warn(`${fileMethod} | No fue posible obtener el listado de poderes`)
      return next(boom.badRequest('No fue posible obtener el listado de poderes'));
    }

    logger.info(`${fileMethod} | Respuesta exitosa que regresara el endpoint: ${JSON.stringify({
      error: false,
      results: {
        poderes: poderes.result
      }
    })}`)

    return res.json({
      error: false,
      results: {
        poderes: poderes.result
      }
    })

  } catch (error) {
    logger.warn(`${fileMethod} | Error general del endpoint ${JSON.stringify(error)}`);
    next(error)
  }
}

const getPuestos = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: getPuestos`;
  try {
    const puestos = await certificationService.getPuestos()

    if (!puestos) {
      logger.warn(`${fileMethod} | No fue posible obtener el listado de puestos`)
      return next(boom.badRequest('No fue posible obtener el listado de puestos'));
    }

    logger.info(`${fileMethod} | Respuesta exitosa que regresara el endpoint: ${JSON.stringify({
      error: false,
      results: {
        puestos: puestos.result
      }
    })}`)

    return res.json({
      error: false,
      results: {
        puestos: puestos.result
      }
    })

  } catch (error) {
    logger.warn(`${fileMethod} | Error general del endpoint ${JSON.stringify(error)}`);
    next(error)
  }
}

const getDenominaciones = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: getDenominaciones`;
  try {
    const denominaciones = await certificationService.getDenominaciones()

    if (!denominaciones) {
      logger.warn(`${fileMethod} | No fue posible obtener el listado de denominaciones`)
      return next(boom.badRequest('No fue posible obtener el listado de denominaciones'));
    }

    logger.info(`${fileMethod} | Respuesta exitosa que regresara el endpoint: ${JSON.stringify({
      error: false,
      results: {
        denominaciones: denominaciones.result
      }
    })}`)

    return res.json({
      error: false,
      results: {
        denominaciones: denominaciones.result
      }
    })

  } catch (error) {
    logger.warn(`${fileMethod} | Error general del endpoint ${JSON.stringify(error)}`);
    next(error)
  }
}

const getPais = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: getPais`;
  try {
    const { tipo } = req.params

    const paises = await certificationService.getPaises(tipo)

    if (!paises) {
      logger.warn(`${fileMethod} | No fue posible obtener el listado de paises`)
      return next(boom.badRequest('No fue posible obtener el listado de paises'));
    }

    logger.info(`${fileMethod} | Respuesta exitosa que regresara el endpoint: ${JSON.stringify({
      error: false,
      results: {
        paises: paises.result
      }
    })}`)

    return res.json({
      error: false,
      results: {
        paises: paises.result
      }
    })

  } catch (error) {
    logger.warn(`${fileMethod} | Error general del endpoint ${JSON.stringify(error)}`);
    next(error)
  }
}

const getPaisAlgoritmo = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: getPaisAlgoritmo`;
  try {
    const paises = await certificationService.getPaisesAlgoritmo()

    if (!paises) {
      logger.warn(`${fileMethod} | No fue posible obtener el listado de paises para el algoritmo`)
      return next(boom.badRequest('No fue posible obtener el listado de paises para el algoritmo'));
    }

    logger.info(`${fileMethod} | Respuesta exitosa que regresara el endpoint: ${JSON.stringify({
      error: false,
      results: {
        paises: paises.result
      }
    })}`)

    return res.json({
      error: false,
      results: {
        paises: paises.result
      }
    })

  } catch (error) {
    logger.warn(`${fileMethod} | Error general del endpoint ${JSON.stringify(error)}`);
    next(error)
  }
}

const getSectorRiesgoSectorialAlgoritmo = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: getSectorRiesgoSectorialAlgoritmo`;
  try {
    const sector_riesgo_sectorial = await certificationService.getSectorRiesgoSectorialAlgoritmo()

    if (!sector_riesgo_sectorial) {
      logger.warn(`${fileMethod} | No fue posible obtener el listado de sector riesgo sectorial para el algoritmo`)
      return next(boom.badRequest('No fue posible obtener el listado de sector riesgo sectorial para el algoritmo'));
    }

    logger.info(`${fileMethod} | Respuesta exitosa que regresara el endpoint: ${JSON.stringify({
      error: false,
      results: {
        sector_riesgo_sectorial: sector_riesgo_sectorial.result
      }
    })}`)

    return res.json({
      error: false,
      results: {
        sector_riesgo_sectorial: sector_riesgo_sectorial.result
      }
    })

  } catch (error) {
    logger.warn(`${fileMethod} | Error general del endpoint ${JSON.stringify(error)}`);
    next(error)
  }
}

const getSectorClientesFinalesAlgoritmo = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: getSectorClientesFinales`;
  try {
    const sector_clientes_finales = await certificationService.getSectorClientesFinalesAlgoritmo()

    if (!sector_clientes_finales) {
      logger.warn(`${fileMethod} | No fue posible obtener el listado de sector clientes finales para el algoritmo`)
      return next(boom.badRequest('No fue posible obtener el listado de sector clientes finales para el algoritmo'))
    }

    logger.info(`${fileMethod} | Respuesta exitosa que regresara el endpoint: ${JSON.stringify({
      error: false,
      results: {
        sector_clientes_finales: sector_clientes_finales.result
      }
    })}`)

    return res.json({
      error: false,
      results: {
        sector_clientes_finales: sector_clientes_finales.result
      }
    })

  } catch (error) {
    logger.warn(`${fileMethod} | Error general del endpoint ${JSON.stringify(error)}`);
    next(error)
  }
}

const getTiempoActividadComercialAlgoritmo = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: getTiempoActividadComercialAlgoritmo`;
  try {
    const tiempo_actividad_comercial = await certificationService.getTiempoActividadComercialAlgoritmo()

    if (!tiempo_actividad_comercial) {
      logger.warn(`${fileMethod} | No fue posible obtener el listado de tiempo de actividad comercial para el algoritmo`)
      return next(boom.badRequest('No fue posible obtener el listado de tiempo de actividad comercial para el algoritmo'));
    }

    logger.info(`${fileMethod} | Respuesta exitosa que regresara el endpoint: ${JSON.stringify({
      error: false,
      results: {
        tiempo_actividad_comercial: tiempo_actividad_comercial.result
      }
    })}`)

    return res.json({
      error: false,
      results: {
        tiempo_actividad_comercial: tiempo_actividad_comercial.result
      }
    })

  } catch (error) {
    logger.warn(`${fileMethod} | Error general del endpoint ${JSON.stringify(error)}`);
    next(error)
  }
}

const getTipoCifrasAlgoritmo = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: getTipoCifrasAlgoritmo`;
  try {
    const tipo_cifras = await certificationService.getTipoCifrasAlgoritmo()

    if (!tipo_cifras) {
      logger.warn(`${fileMethod} | No fue posible obtener el listado de tipo cifras para el algoritmo`)
      return next(boom.badRequest('No fue posible obtener el listado de tipo cifras para el algoritmo'))
    }

    logger.info(`${fileMethod} | Respuesta exitosa que regresara el endpoint: ${JSON.stringify({
      error: false,
      results: {
        tipo_cifras: tipo_cifras.result
      }
    })}`)

    return res.json({
      error: false,
      results: {
        tipo_cifras: tipo_cifras.result
      }
    })

  } catch (error) {
    logger.warn(`${fileMethod} | Error general del endpoint ${JSON.stringify(error)}`)
    next(error)
  }
}

const guardaMercadoObjetivo = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: guardaMercadoObjetivo`
  try {
    const { body } = req
    const { id_certification, principales_clientes, estructuras_ventas, importaciones, exportaciones } = body

    logger.info(`${fileMethod} | Inicio para guardar las partidas financieras: ${JSON.stringify(body)}`)

    const certificacion = await certificationService.getCertificacion(id_certification)
    logger.info(`${fileMethod} | Información de la certificación con ID: ${JSON.stringify(certificacion)}`)
    if (!certificacion.result) {
      logger.warn(`${fileMethod} | La certificacion con ID ${certificacion} no existe`)
      return next(boom.badRequest(`La certificacion con ID ${certificacion} no existe`))
    }
    if (principales_clientes.length > 0) {
      for (let cliente in principales_clientes) {
        const savePrincipalesClientes = await certificationService.savePrincipalesClientes(id_certification, principales_clientes[cliente])
        if (!savePrincipalesClientes.success) {
          logger.warn(`${fileMethod} | ${savePrincipalesClientes.message}`)
          return next(boom.badRequest(`${savePrincipalesClientes.message}`))
        }
      }
    }

    const saveEstructuraVentas = await certificationService.saveEstructuraVentas(id_certification, estructuras_ventas)
    if (!saveEstructuraVentas.success) {
      logger.warn(`${fileMethod} | ${saveEstructuraVentas.message}`)
      return next(boom.badRequest(`${saveEstructuraVentas.message}`))
    }
    if (importaciones.length > 0) {
      for (let importacion in importaciones) {
        const saveImportacionesExportaciones = await certificationService.saveImportacionesExportaciones(id_certification, 'importacion', importaciones[importacion])
        if (!saveImportacionesExportaciones.success) {
          logger.warn(`${fileMethod} | ${saveImportacionesExportaciones.message}`)
          return next(boom.badRequest(`${saveImportacionesExportaciones.message}`))
        }
      }
    }
    if (exportaciones.length > 0) {
      for (let exportacion in exportaciones) {
        const saveImportacionesExportaciones = await certificationService.saveImportacionesExportaciones(id_certification, 'exportacion', exportaciones[exportacion])
        if (!saveImportacionesExportaciones.success) {
          logger.warn(`${fileMethod} | ${saveImportacionesExportaciones.message}`)
          return next(boom.badRequest(`${saveImportacionesExportaciones.message}`))
        }
      }
    }
    return res.json({
      error: false,
      results: {
        created: true,
        mercadoObjetivo: body
      }
    })
  } catch (error) {
    next(error)
  }
}

const guardaPartidasFinancieras = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: guardaPartidasFinancieras`
  try {
    const { body } = req
    const { id_certification } = body
    logger.info(`${fileMethod} | Inicio para guardar las partidas financieras: ${JSON.stringify(body)}`)

    const certificacion = await certificationService.getCertificacion(id_certification)
    logger.info(`${fileMethod} | Información de la certificación con ID: ${JSON.stringify(certificacion)}`)

    // const partidaFinanciera = await certificationService.getCertificacionPartidaFinanciera(id_certification)
    // if (partidaFinanciera.result.length > 0) {
    //   logger.warn(`${fileMethod} | No se guardaron las partidas financieras por que ya existen partidas para la certificación actual`)
    //   return next(boom.badRequest('No se guardaron las partidas financieras por que ya existen partidas para la certificación actual'))
    // }
    // logger.info(`${fileMethod} | Partidas financieras obtenidas: ${JSON.stringify(partidaFinanciera)}`)

    if (!certificacion.result) {
      logger.warn(`${fileMethod} | La certificacion con ID ${certificacion} no existe`)
      return next(boom.badRequest(`La certificacion con ID ${certificacion} no existe`))
    }

    // Calcular totales para los dos periodos
    if (body.partida_estado_balance_periodo_contable_anterior) {
      const anterior = body.partida_estado_balance_periodo_contable_anterior
      const {
        caja_bancos = 0,
        saldo_cliente_cuenta_x_cobrar = 0,
        saldo_inventarios = 0,
        deudores_diversos = 0,
        otros_activos = 0,
        proveedores = 0,
        acreedores = 0,
        inpuestos_x_pagar = 0,
        otros_pasivos = 0,
        total_activo_fijo = 0,
        activo_intangible = 0,
        activo_diferido = 0,
        total_otros_activos = 0,
        total_pasivo_largo_plazo = 0,
        otros_pasivos_largo_plazo = 0,
        capital_social = 0,
        resultado_ejercicios_anteriores = 0,
        resultado_ejercicios = 0,
        otro_capital = 0
      } = anterior
      anterior.total_activo_circulante =
        caja_bancos +
        saldo_cliente_cuenta_x_cobrar +
        saldo_inventarios +
        deudores_diversos +
        otros_activos

      anterior.activo_total =
        anterior.total_activo_circulante +
        total_activo_fijo +
        activo_intangible +
        activo_diferido +
        total_otros_activos

      anterior.total_pasivo_circulante =
        proveedores +
        acreedores +
        inpuestos_x_pagar +
        otros_pasivos

      anterior.suma_pasivo_largo_plazo =
        total_pasivo_largo_plazo + otros_pasivos_largo_plazo

      anterior.total_capital_contable_pat =
        capital_social +
        resultado_ejercicios_anteriores +
        resultado_ejercicios +
        otro_capital

      anterior.capital_contable =
        capital_social +
        resultado_ejercicios_anteriores +
        resultado_ejercicios +
        otro_capital
    }

    if (body.partida_estado_balance_periodo_contable_previo_anterior) {
      const previo = body.partida_estado_balance_periodo_contable_previo_anterior
      const {
        caja_bancos = 0,
        saldo_cliente_cuenta_x_cobrar = 0,
        saldo_inventarios = 0,
        deudores_diversos = 0,
        otros_activos = 0,
        proveedores = 0,
        acreedores = 0,
        inpuestos_x_pagar = 0,
        otros_pasivos = 0,
        total_activo_fijo = 0,
        activo_intangible = 0,
        activo_diferido = 0,
        total_otros_activos = 0,
        total_pasivo_largo_plazo = 0,
        otros_pasivos_largo_plazo = 0,
        capital_social = 0,
        resultado_ejercicios_anteriores = 0,
        resultado_ejercicios = 0,
        otro_capital = 0
      } = previo
      previo.total_activo_circulante =
        caja_bancos +
        saldo_cliente_cuenta_x_cobrar +
        saldo_inventarios +
        deudores_diversos +
        otros_activos

      previo.activo_total =
        previo.total_activo_circulante +
        total_activo_fijo +
        activo_intangible +
        activo_diferido +
        total_otros_activos

      previo.total_pasivo_circulante =
        proveedores +
        acreedores +
        inpuestos_x_pagar +
        otros_pasivos

      previo.suma_pasivo_largo_plazo =
        total_pasivo_largo_plazo + otros_pasivos_largo_plazo

      previo.total_capital_contable_pat =
        capital_social +
        resultado_ejercicios_anteriores +
        resultado_ejercicios +
        otro_capital

      previo.capital_contable =
        capital_social +
        resultado_ejercicios_anteriores +
        resultado_ejercicios +
        otro_capital
    }

    const insertPEBPCA = await certificationService.insertPEBPCA(body)
    if (!insertPEBPCA.success) {
      logger.warn(`${fileMethod} | ${insertPEBPCA.message}`)
      return next(boom.badRequest(`${insertPEBPCA.message}`))
    }

    const insertPEBPCPA = await certificationService.insertPEBPCPA(body)
    if (!insertPEBPCPA.success) {
      logger.warn(`${fileMethod} | ${insertPEBPCPA.message}`)
      return next(boom.badRequest('No se insertaron los datos PEBPCPA para la certificación'))
    }

    const insertPERPCPA = await certificationService.insertPERPCPA(body)
    if (!insertPERPCPA.success) {
      logger.warn(`${fileMethod} | ${insertPERPCPA.message}`)
      return next(boom.badRequest(`${insertPEBPCPA.message}`))
    }

    const insertPERPCA = await certificationService.insertPERPCA(body)
    if (!insertPERPCA.success) {
      logger.warn(`${fileMethod} | ${insertPERPCA.message}`)
      return next(boom.badRequest(`${insertPERPCA.message}`))
    }

    const partidasFinancieras = await certificationService.getCertificacionPartidaFinanciera(id_certification)
    if (!partidasFinancieras) {
      logger.warn(`${fileMethod} | No se insertaron las partidas financieras`)
      return next(boom.badRequest('No se insertaron las partidas financieras'))
    }
    logger.info(`${fileMethod} | Partidas financieras obtenidas despues de insertarlas: ${JSON.stringify(partidasFinancieras)}`)

    logger.info(`${fileMethod} |  Respuesta exitosa que regresara el endpoint ${JSON.stringify({
      error: false,
      results: {
        created: true,
        partidasFinancieras: body
      }
    })}`)

    return res.json({
      error: false,
      results: {
        created: true,
        partidasFinancieras: body
      }
    })

  } catch (error) {
    logger.warn(`${fileMethod} | Error general del endpoint ${JSON.stringify(error)}`);
    next(error)
  }
}

// Guarda o actualiza las referencias comerciales de una certificación.
// Las referencias ya contestadas se preservan y, en caso de existir,
// se reasignan al nuevo id_certification proporcionado.
// [COPIAR DESDE AQUÍ]
// Guarda o actualiza las referencias comerciales de una certificación.
const guardaReferenciasComerciales = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: guardaReferenciasComerciales`;
  try {
    const { body } = req;
    const { id_certification, id_empresa, referencias_comerciales: frontEndRefs } = body

    if (!Array.isArray(frontEndRefs)) {
      logger.warn(`${fileMethod} | referencias_comerciales no es un arreglo valido: ${JSON.stringify(frontEndRefs)}`)
      return next(boom.badRequest('El formato de referencias comerciales no es válido'))
    }

    const certificacionIniciada = await certificationService.getCertificationByIdCertfication(id_certification)
    if (!certificacionIniciada) {
      logger.warn(`${fileMethod} | No hay certificación iniciada para el id ${id_certification}`)
      return next(boom.badRequest('No hay certificación iniciada'))
    }

    // --- INICIO REFACTOR: Lógica de Sincronización (Upsert) ---

    // 1. Obtener el estado actual de la base de datos
    const dbRefs = await certificationService.getReferenciasComercialesByIdCertification(id_certification);
    const frontEndRefIds = new Set(frontEndRefs.filter(ref => ref.id_certification_referencia_comercial).map(ref => ref.id_certification_referencia_comercial));

    // 2. Determinar qué referencias eliminar (las que están en DB pero no en el front y no están contestadas)
    const refsToDelete = dbRefs.filter(dbRef =>
      !frontEndRefIds.has(dbRef.id_certification_referencia_comercial) && dbRef.contestada !== 'si'
    );

    for (const ref of refsToDelete) {
      logger.info(`${fileMethod} | Eliminando referencia no contestada: ${ref.id_certification_referencia_comercial}`);
      await certificationService.deleteReferenciaComercialById(ref.id_certification_referencia_comercial);
    }

    // Filtramos referencias validas
    const referencias_comerciales_validas = frontEndRefs.filter(ref => {
      const camposClave = ['razon_social', 'denominacion', 'rfc', 'id_pais'];
      return camposClave.some(k => {
        const v = ref[k];
        if (typeof v === 'string') {
          return v.trim() !== '';
        }
        if (typeof v === 'number') {
          return v !== 0 && v !== null;
        }
        return v !== null && v !== undefined && v !== '';
      });
    });

    const referenciasContestadas = dbRefs.filter(ref => ref.contestada === 'si');
    const idsContestadas = new Set(referenciasContestadas.map(ref => ref.id_certification_referencia_comercial));

    // 3. Procesar referencias que vienen del frontend (Insertar o Actualizar)
    let contactosParaEnviarEmail = [];
    for (const frontEndRef of referencias_comerciales_validas) {

      // Omitir si la referencia ya está contestada (por ID)
      if (frontEndRef.id_certification_referencia_comercial && idsContestadas.has(frontEndRef.id_certification_referencia_comercial)) {
        logger.info(`${fileMethod} | Omitiendo actualización de referencia ya contestada: ${frontEndRef.id_certification_referencia_comercial}`);
        continue;
      }

      // Nueva verificación: evitar duplicados por datos clave si ya está contestada
      const yaContestada = await certificationService.existeReferenciaComercialContestadaPorDatos({
        id_certification,
        razon_social: frontEndRef.razon_social,
        denominacion: frontEndRef.denominacion,
        rfc: frontEndRef.rfc,
        id_pais: frontEndRef.id_pais
      })
      if (yaContestada) {
        logger.info(`${fileMethod} | Referencia comercial ya contestada, se omite: ${JSON.stringify(frontEndRef)}`)
        continue;
      }

      if (frontEndRef.id_certification_referencia_comercial) {
        // Es una ACTUALIZACIÓN (UPDATE)
        logger.info(`${fileMethod} | Actualizando referencia existente: ${frontEndRef.id_certification_referencia_comercial}`);
        await certificationService.updateReferenciaComercial(frontEndRef.id_certification_referencia_comercial, frontEndRef);

        const contactosNuevos = await certificationService.syncContactosForReferencia(frontEndRef.id_certification_referencia_comercial, frontEndRef.contactos);

        // Enriquecer contactos nuevos con datos para el email
        contactosParaEnviarEmail.push(...contactosNuevos.map(c => ({
          ...c,
          empresa_destino: frontEndRef.razon_social
        })));

      } else {
        // Es una INSERCIÓN (INSERT)
        logger.info(`${fileMethod} | Insertando nueva referencia.`);
        const direccion = await certificationService.insertaDireccionReferenciaComercial(frontEndRef);
        if (!direccion || !direccion.insertId) {
          logger.error(`${fileMethod} - Fallo al insertar la dirección para la nueva referencia.`);
          continue;
        }

        const nuevaReferencia = await certificationService.insertaReferenciaComercial(frontEndRef, id_certification, direccion.insertId);
        if (!nuevaReferencia || !nuevaReferencia.insertId) {
          logger.warn(`${fileMethod} - No se insertó la referencia comercial: ${JSON.stringify(frontEndRef)}`);
          continue;
        }

        await certificationService.insertaInfoEmpresaCliente(frontEndRef, nuevaReferencia.insertId);

        if (Array.isArray(frontEndRef.contactos)) {
          for (const contacto of frontEndRef.contactos) {
            const contactoInsertado = await certificationService.insertaContacto(contacto, 'noenviado', nuevaReferencia.insertId);
            if (contactoInsertado && contactoInsertado.insertId) {
              contactosParaEnviarEmail.push({
                nombre: contacto.nombre_contacto,
                correo: contacto.correo_contacto,
                id_contacto: contactoInsertado.insertId,
                id_referencia: nuevaReferencia.insertId,
                empresa_destino: frontEndRef.razon_social,
              });
            }
          }
        }
      }
    }

    // --- FIN REFACTOR ---

    logger.info(`${fileMethod} - Se enviarán emails a los siguientes contactos nuevos: ${JSON.stringify(contactosParaEnviarEmail)}`)

    if (contactosParaEnviarEmail.length > 0) {
      const [empresa_origen] = await companiesService.getEmpresaById(id_empresa)
      // La lógica para determinar el nombre de la empresa para el email debe ser más robusta
      // ya que la lista de contactos puede ser mixta (de refs nuevas y actualizadas).
      // Por ahora, se mantiene una lógica simplificada.
      const denominaciones = await certificationService.getDenominaciones()
      const denominacion_empresa_var = denominaciones.result.find(item => item.id == frontEndRefs[0]?.denominacion)
      const empresa_var = `${frontEndRefs[0]?.razon_social} ${denominacion_empresa_var?.denominacion || ''}`

      await enviarReferenciasComercialesExternos(certificacionIniciada?.id_empresa, id_certification, contactosParaEnviarEmail, empresa_var, empresa_origen.empresa_nombre)
    }

    // --- FILTRADO EXTREMO PARA RESPUESTA ---
    const referencias_comerciales_respuesta = Array.isArray(body.referencias_comerciales)
      ? body.referencias_comerciales.filter(ref => {
        const camposClave = ['razon_social', 'denominacion', 'rfc', 'id_pais'];
        return camposClave.some(k => {
          const v = ref[k];
          return v !== '' && v !== null && v !== undefined;
        });
      })
      : [];
    logger.info(`${fileMethod} | Referencias comerciales devueltas: ${JSON.stringify(referencias_comerciales_respuesta)}`);

    return res.json({
      error: false,
      results: {
        synced: true,
        referencias: referencias_comerciales_respuesta
      }
    });

  } catch (error) {
    logger.warn(`${fileMethod} | Error general del endpoint ${error.stack}`);
    next(error)
  }
}

const getReferenciaComercialForm = async (req, res, next) => {
  try {
    const { id_certification } = req.params
    const referencias_comerciales = []
    const get_referencias_comerciales = await certificationService.getReferenciasComercialesByIdCertification(id_certification)
    if (!get_referencias_comerciales) return next(boom.badRequest(`El ID de certificacion ${id_certification} no tiene referecias insertadas`))

    // El query puede devolver registros repetidos por los joins. Filtrar por
    // id de referencia para evitar duplicados exactos
    const referenciasUnicas = []
    const seenReferencias = new Set()
    for (const ref of get_referencias_comerciales) {
      const key = ref.id_certification_referencia_comercial
      if (!seenReferencias.has(key)) {
        seenReferencias.add(key)
        referenciasUnicas.push(ref)
      }
    }

    for (const referencia of referenciasUnicas) {
      let contactos = await certificationService.getContactos(referencia.id_certification_referencia_comercial)
      const seen = new Set()
      contactos = contactos.filter(c => {
        if (!seen.has(c.id_certification_contacto)) {
          seen.add(c.id_certification_contacto)
          return true
        }
        return false
      })
      referencia.contactos = contactos

      const empresas_cliente = await certificationService.getEmpresaClienteByIdCertification(referencia.id_certification_referencia_comercial)
      referencia.empresa_cliente = empresas_cliente
      referencias_comerciales.push(referencia)
    }

    /*
    return res.json({
      id_certification,
      referencias_comerciales
    })
    */

    const referencias_comerciales_filtradas = referencias_comerciales.filter(ref => {
      const camposClave = ['razon_social', 'denominacion', 'rfc', 'id_pais'];
      return camposClave.some(k => {
        const v = ref[k];
        if (typeof v === 'string') {
          return v.trim() !== '';
        }
        if (typeof v === 'number') {
          return v !== 0;
        }
        return v !== null && v !== undefined && v !== '';
      });
    });
    return res.json({
      id_certification,
      referencias_comerciales: referencias_comerciales_filtradas
    });

  } catch (error) {
    next(error)
  }
}

const getCertificationContries = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const paises = await certificationService.getCountries()
    const herramientas = await certificationService.getTools()
    const encryptedResponse = await cipher.encryptData(JSON.stringify({
      error: false,
      results: {
        paises,
        herramientas
      }
    }));

    return res.status(200).send(encryptedResponse)
  } catch (err) {
    next(err)
  }
}

const uploadDocuments = async (req, res, next) => {
  try {
    const fileMethod = `file: src/controllers/api/certification.js - method: uploadDocuments`
    const body = typeof req.decryptedBody === 'string' ? JSON.parse(req.decryptedBody) : req.decryptedBody;
    const { empresa: empresaID, pdf } = body;


    logger.info(`${fileMethod} - Archivo a subir : ${JSON.stringify(req.file)}`)
    logger.info(`${fileMethod} - Datos para dar de alta en BD : ${JSON.stringify(body)}`)

    // Existe la empresa
    const [empresa] = await companiesService.getEmpresa(empresaID)
    logger.info(`${fileMethod} - Existe empresa: ${JSON.stringify(empresa)}`);
    if (!empresa) return next(boom.badRequest('Company does not exist'))

    // Revisar que la empresa tenga un telefono
    const tieneTelefono = await certificationService.getCompanyPhone(empresaID)
    logger.info(`${fileMethod} - La empresa tiene telefono: ${tieneTelefono}`)
    if (!tieneTelefono) return next(boom.badRequest('Phone does not exists'))

    // Verificar si se adjuntó un archivo
    if (!pdf) {
      logger.warn(`${fileMethod} - No se adjunto el archivo ${pdf}`);
      return next(boom.badRequest('No se adjunto el archivo'))
    }

    logger.info(`${fileMethod} - Archivo obtenido del request para hacer el upload: ${JSON.stringify(pdf)}`);

    // Obtener el archivo cargado
    const file = pdf;
    const pathBucket = 'certificacionDocs';
    const locationAWS = await uploadImageS3.uploadImage(file, pathBucket)
    logger.info(`${fileMethod} - Ruta de AWS en donde se guardo el archivo: ${locationAWS}`);
    if (locationAWS == undefined) res.status(400).json({ error: true, message: 'No se subio el archivo a AWS' });

    // Aquí puedes realizar cualquier procesamiento adicional con el archivo, como guardar en la base de datos o en el sistema de archivos, etc.
    const uploadFile = await certificationService.createCertificationDocument(body, locationAWS);

    logger.info(`${fileMethod} - Se realiza la inserción en la BD: ${uploadFile}`);
    logger.info(`${fileMethod} - Objeto de respuesta del endpoint: ${JSON.stringify({
      error: false,
      results: {
        created: true,
        certification: body,
        document: locationAWS
      }
    })}`);

    const encryptedResponse = await cipher.encryptData(JSON.stringify({
      error: false,
      results: {
        created: true,
        certification: body,
        document: locationAWS
      }
    }));

    return res.status(200).send(encryptedResponse)
  } catch (error) {

    logger.error('Este es un mensaje de error: ' + error);
    next(error);
  }
};

module.exports = {
  uploadDocuments
};


const dataOutSectionOne = async (results) => {
  try {
    const formattedData = {
      certificaciones: {},
      certificaciones_inmueble: [],
      certificaciones_referencias_comerciales: []
    };

    results.forEach(row => {
      // Obtener datos de certificaciones
      if (!formattedData.certificaciones.certificacion_id) {
        formattedData.certificaciones = {
          certificacion_id: row.certificacion_id,
          empresa_id: row.empresa_id,
          nrp: row.nrp,
          herramienta_proteccion_id: row.herramienta_proteccion_id,
          capital_social: row.capital_social,
          empleados: row.empleados,
          created_at: row.created_at
        };
      }

      // Obtener datos de certificaciones_inmueble
      if (row.id_cert_inmueble && !formattedData.certificaciones_inmueble.some(item => item.id_cert_inmueble === row.id_cert_inmueble)) {
        formattedData.certificaciones_inmueble.push({
          id_cert_inmueble: row.id_cert_inmueble,
          certificacion_id: row.certificacion_id,
          direccion: row.direccion,
          propio: row.propio,
          comodato: row.comodato,
          renta: row.renta,
          precio: row.precio,
          oficinas_administrativas: row.oficinas_administrativas,
          almacen: row.almacen,
          area_produccion: row.area_produccion
        });
      }

      // Obtener datos de certificaciones_referencias_comerciales
      if (row.id_cert_ref_com && !formattedData.certificaciones_referencias_comerciales.some(item => item.id_cert_ref_com === row.id_cert_ref_com)) {
        formattedData.certificaciones_referencias_comerciales.push({
          id_cert_ref_com: row.id_cert_ref_com,
          certificacion_id: row.certificacion_id,
          empresa: row.empresa,
          nombre: row.nombre,
          correo: row.correo,
          telefono: row.telefono,
          pais_id: row.pais_id
        });
      }
    });

    return formattedData;

  } catch (error) {
    throw error
  }
}

const dataOutSectionTwo = async (results) => {
  try {
    const categorizedRepresentatives = {
      representante_legal: null,
      accionistas: []
    };

    results.forEach(representative => {
      if (representative.representante_legal === "1") {
        // Si es representante legal, lo agregamos a la propiedad representante_legal
        categorizedRepresentatives.representante_legal = representative;
      } else {
        // Si no es representante legal, lo agregamos a la propiedad accionistas
        categorizedRepresentatives.accionistas.push(representative);
      }
    });

    return categorizedRepresentatives;

  } catch (error) {
    throw error
  }
}

const groupByCertificacionId = (data) => {
  const groupedData = {};
  data.forEach((item) => {
    const certificacionId = item.certificacion_id;
    if (!groupedData[certificacionId]) {
      groupedData[certificacionId] = {
        certificacion_id: item.certificacion_id,
        empresa_id: item.empresa_id,
        nrp: item.nrp,
        herramienta_proteccion_id: item.herramienta_proteccion_id,
        capital_social: item.capital_social,
        empleados: item.empleados,
        created_at: item.created_at,
        id_cert_partida_fin: item.id_cert_partida_fin,
        seccion: item.seccion,
        fecha: item.fecha,
        periodo_activo: item.periodo_activo,
        periodo_pasivo: item.periodo_pasivo,
        unidad_neta: item.unidad_neta,
        ventas: item.ventas,
        documentos: []
      };
    }
    if (item.id_cert_docs) {
      groupedData[certificacionId].documentos.push({
        id_cert_docs: item.id_cert_docs,
        nombre_documento: item.nombre_documento,
        ruta: item.ruta,
        fecha_carga: item.fecha_carga,
        vencimiento: item.vencimiento,
        status: item.status,
        peso: item.peso
      });
    } else {
      groupedData[certificacionId].documentos.push({})
    }
  });
  return Object.values(groupedData);
};

const getCertificationByCompany = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const fileMethod = `file: src/controllers/api/certification.js - method: getCertificationByCompany`;
    const { idEmpresa, idSeccion } = req.params;
    logger.info(`${fileMethod} - Inicio para obtener certificación de la empresa con ID: ${JSON.stringify(idEmpresa)} y la sección: ${JSON.stringify(idSeccion)}`)

    const results = await certificationService.getCertificationBySection(idEmpresa, idSeccion)
    logger.info(`${fileMethod} - Información de la Empresa consultada: ${JSON.stringify(results)}`)
    if (!results || results.length === 0) {
      logger.error(`${fileMethod} - No hay resultados disponibles para la empresa con ID : ${JSON.stringify(idEmpresa)}`)
      return next(boom.notFound(`${fileMethod} - No hay resultados disponibles para la empresa con ID : ${JSON.stringify(idEmpresa)}`));
    }

    let response = {};
    switch (idSeccion) {
      case '1':
        // La sección 1 es referente a inmuebles y referencias comerciales
        response = await dataOutSectionOne(results)
        logger.info(`${fileMethod} - Información de la sección ${idSeccion} (inmuebles y referencias comerciales) de la empresa con ID: ${idEmpresa} -  ${JSON.stringify(response)}`)
        if (!response) {
          logger.error(`${fileMethod} - No se pudo obtener información de la sección ${idSeccion} (inmuebles y referencias comerciales) de la empresa con ID: ${JSON.stringify(idEmpresa)}`)
          return next(boom.badRequest(`${fileMethod} - No se pudo obtener información de la sección ${idSeccion} (inmuebles y referencias comerciales) de la empresa con ID: ${JSON.stringify(idEmpresa)}`))
        }
        break;
      case '2':
        // La sección 2 es referente a representantes y representante legal
        response = await dataOutSectionTwo(results)
        logger.info(`${fileMethod} - Información de la sección ${idSeccion} (representantes y representante legal) de la empresa con ID: ${idEmpresa} -  ${JSON.stringify(response)}`)
        if (!response) {
          logger.error(`${fileMethod} - No se pudo obtener información de la sección ${idSeccion} (representantes y representante legal) de la empresa con ID: ${JSON.stringify(idEmpresa)}`)
          return next(boom.badRequest(`${fileMethod} - No se pudo obtener información de la sección ${idSeccion} (representantes y representante legal) de la empresa con ID: ${JSON.stringify(idEmpresa)}`))
        }
        break;
      case '3':
        // La sección 3 es referente a empresas relacionadas
        logger.info(`${fileMethod} - Información de la sección ${idSeccion} (empresas relacionadas) de la empresa con ID: ${idEmpresa} -  ${JSON.stringify(results)}`)
        const objetoConEmpresasRelacionadas = {
          empresas_relacionadas: results
        }
        response = objetoConEmpresasRelacionadas
        if (!response) {
          logger.error(`${fileMethod} - No se pudo obtener información de la sección ${idSeccion} (empresas relacionadas) de la empresa con ID: ${JSON.stringify(idEmpresa)}`)
          return next(boom.badRequest(`${fileMethod} - No se pudo obtener información de la sección ${idSeccion} (empresas relacionadas) de la empresa con ID: ${JSON.stringify(idEmpresa)}`))
        }
        break;
      case '4':
        // La sección 4 es referente a documentos pdf para certificación
        response = groupByCertificacionId(results);
        logger.info(`${fileMethod} - Información de la sección ${idSeccion} (documentos pdf para certificación) de la empresa con ID: ${idEmpresa} -  ${JSON.stringify(response)}`)
        if (!response) {
          logger.error(`${fileMethod} - No se pudo obtener información de la sección ${idSeccion} (documentos pdf para certificación) de la empresa con ID: ${JSON.stringify(idEmpresa)}`)
          return next(boom.badRequest(`${fileMethod} - No se pudo obtener información de la sección ${idSeccion} (documentos pdf para certificación) de la empresa con ID: ${JSON.stringify(idEmpresa)}`))
        }
        break;

      default:
        logger.error(`${fileMethod} - La sección ${idSeccion} no existe`)
        return next(boom.badRequest(`${fileMethod} - La sección ${idSeccion} no existe`))
        break;
    }

    logger.info(`${fileMethod} - Objeto de respuesta del endpoint: ${JSON.stringify({
      error: false,
      results: {
        response
      }
    })}`)

    const encryptedResponse = await cipher.encryptData(JSON.stringify({
      error: false,
      results: {
        response
      }
    }));

    return res.status(200).send(encryptedResponse)
  } catch (err) {
    logger.error(`${fileMethod} - Ocurrio un error al  consultar la sección ${idSeccion} - ${JSON.stringify(err)}`)
    next(err)
  }
}

const payCertification = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const { body: { user: userID, payment_method: paymentMethod } } = req

    const [customer] = await paymentsService.getUserPaymentTokens(userID)
    if (!customer) return next(boom.notFound('Customer not found'))

    const { token: customerID } = customer

    const [certificationDetails] = await certificationService.getCertificationPrice()
    const { precio, moneda } = certificationDetails

    const payment = await stripe.createPayment(precio, moneda, customerID, paymentMethod)

    if (payment.statusCode) return next(boom.badRequest(`Error in payment: ${payment.type}`))

    await paymentsService.savePayment(userID, precio, 'Certification', moneda)

    const encryptedResponse = await cipher.encryptData(JSON.stringify({
      error: false,
      results: {
        status: payment.status
      }
    }));

    return res.status(200).send(encryptedResponse)
  } catch (err) {
    next(err)
  }
}

const certificateMyCompanyForTest = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const { body: { company: empresaID } } = req
    // Ya certificada? Si certificada o en proceso 400
    // Existe la empresa
    const [empresa] = await companiesService.getEmpresa(empresaID)
    if (!empresa) return next(boom.badRequest('Company does not exist'))

    const [yaCertificada] = await certificationService.getCertification(empresaID)
    if (yaCertificada) return next(boom.badRequest('Company in process'))

    // Obtener estatus actual de certificación
    const { emp_certificada: estatusCertificacion } = empresa
    const [certificada, pendiente] = [1, 2]
    // ¿La empresa ya está certificada?
    if (estatusCertificacion === certificada) return next(boom.badRequest('Company already certified'))

    // ¿La empresa ya está en proceso de certificarse?
    if (estatusCertificacion === pendiente) return next(boom.badRequest('Company in process'))
    // Certificar
    const empresaCertificada = await certificationService.certificateMyCompanyForTest(empresaID)
    return res.status(201).json({
      error: false,
      results: {
        certificada: empresaCertificada
      }
    })
  } catch (err) {
    next(err)
  }
}

const resetCertificationsForTest = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const reset = await certificationService.resetCertificationsForTest()
    return res.json({
      error: false,
      results: {
        reset
      }
    })
  } catch (err) {
    next(err)
  }
}

const getScoreEvolucionVentas = async (id_certification, customUuid) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: getScoreEvolucionVentas`
  try {
    const [ventasAnualesAnioAnterior, ventasAnualesAnioPrevioAnterior] = await Promise.all([
      certificationService.getVentasAnualesAnioAnterior(id_certification),
      certificationService.getVentasAnualesAnioPrevioAnterior(id_certification)
    ])

    if (!ventasAnualesAnioAnterior || !ventasAnualesAnioAnterior.length || !ventasAnualesAnioPrevioAnterior || !ventasAnualesAnioPrevioAnterior.length) {
      logger.warn(`${fileMethod} | ${customUuid} No se pudo obtener ventas anuales para calcular la evolución`)
      return { error: true }
    }

    logger.info(`${fileMethod} | ${customUuid} Ventas anuales de certificación ID ${id_certification}: ${JSON.stringify({ ventasAnualesAnioAnterior, ventasAnualesAnioPrevioAnterior })}`)

    const anterior = parseFloat(ventasAnualesAnioAnterior.ventas_anuales)
    const previoAnterior = parseFloat(ventasAnualesAnioPrevioAnterior.ventas_anuales)
    const evolucionVentas = ((anterior - previoAnterior) / previoAnterior) * 100

    logger.info(`${fileMethod} | ${customUuid} Las evolución de ventas de la certificación ID: ${id_certification} es: ${JSON.stringify(evolucionVentas)}`)
    if (!Number.isFinite(evolucionVentas)) {
      return {
        score: '0',
        nombre: `(${anterior} - ${previoAnterior}) / ${previoAnterior} * 100`,
        rango_numerico: 'null',
        ventas_anuales_periodo_anterior_estado_resultados: anterior,
        periodo_anterior_estado_resultados: ventasAnualesAnioAnterior.periodo_anterior,
        ventas_anuales_periodo_previo_anterior_estado_resultados: previoAnterior,
        evolucion_ventas: evolucionVentas
      }
    }

    const getScore = await certificationService.getScoreEvolucionVentas(evolucionVentas)
    if (!getScore) {
      logger.warn(`${fileMethod} | ${customUuid} No se ha podido obtener el score de evolucion de ventas: ${JSON.stringify(getScore)}`)
      return { error: true }
    }

    logger.info(`${fileMethod} | ${customUuid} El score de evolución de ventas de la certificación ID: ${id_certification} es: ${JSON.stringify(getScore)}`)

    const result = {
      score: getScore.valor_algoritmo,
      nombre: getScore.nombre,
      rango_numerico: getScore.rango_numerico,
      ventas_anuales_periodo_anterior_estado_resultados: anterior,
      periodo_anterior_estado_resultados: ventasAnualesAnioAnterior.periodo_anterior,
      ventas_anuales_periodo_previo_anterior_estado_resultados: previoAnterior,
      evolucion_ventas: evolucionVentas
    }

    logger.info(`${fileMethod} | ${customUuid} El score de evolución de ventas de certificación es: ${JSON.stringify(result)}`)

    return result
  } catch (error) {
    logger.error(`${fileMethod} | ${customUuid} Error general: ${JSON.stringify(error)}`)
    return {
      error: true
    }
  }
}

const getScorePlantillaLaboral = async (id_certification, algoritmo_v, customUuid) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: getScorePlantillaLaboral`
  try {
    const plantillaCertification = await certificationService.getPlantillaCertification(id_certification)
    if (!plantillaCertification) {
      logger.warn(`${fileMethod} | ${customUuid} No se ha podido obtener la plantilla de la empresa: ${JSON.stringify(plantillaCertification)}`)
      return {
        error: true
      }
    }

    logger.info(`${fileMethod} | ${customUuid} La plantilla de la certificación ID: ${id_certification} es: ${JSON.stringify(plantillaCertification)}`)

    const getScore = await certificationService.getScorePlantillaLaboral(plantillaCertification.plantilla_laboral, algoritmo_v)
    if (!getScore) {
      logger.warn(`${fileMethod} | ${customUuid} No se ha podido obtener el score de plantilla: ${JSON.stringify(getScore)}`)
      return {
        error: true
      }
    }

    logger.info(`${fileMethod} | ${customUuid} El score de plantilla de la certificación ID: ${id_certification} es: ${JSON.stringify(getScore)}`)

    logger.info(`${fileMethod} | ${customUuid} El score de plantilla de certificación es: ${JSON.stringify({
      score: getScore.valor_algoritmo,
      descripcion: getScore.nombre,
      limite_inferior: getScore.limite_inferior,
      limite_superior: getScore.limite_superior,
      plantilla_laboral: plantillaCertification.plantilla_laboral
    })}`)

    return {
      score: getScore.valor_algoritmo,
      descripcion: getScore.nombre,
      limite_inferior: getScore.limite_inferior,
      limite_superior: getScore.limite_superior,
      plantilla_laboral: plantillaCertification.plantilla_laboral
    }
  } catch (error) {
    logger.error(`${fileMethod} | ${customUuid} Error general: ${JSON.stringify(error)}`)
    return {
      error: true
    }
  }
}

const getScoreVentasAnuales = async (id_certification, customUuid) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: getScoreVentasAnuales`
  try {
    const ventasAnualesAnioAnterior = await certificationService.getVentasAnualesAnioAnterior(id_certification)
    if (!ventasAnualesAnioAnterior) {
      logger.warn(`${fileMethod} | ${customUuid} No se ha podido obtener las ventas anuales del estado de resultados del periodo previo anterior: ${JSON.stringify(ventasAnualesAnioAnterior)}`)
      return { error: true }
    }

    logger.info(`${fileMethod} | ${customUuid} Las ventas anuales de la certificación ID: ${id_certification} es: ${JSON.stringify(ventasAnualesAnioAnterior)}`)

    const scoreVentas = await certificationService.getScoreVentasAnualesAnioAnterior(ventasAnualesAnioAnterior.ventas_anuales)
    if (!scoreVentas) {
      logger.warn(`${fileMethod} | ${customUuid} El score de ventas anuales del estado de resultados del periodo previo anterior: ${JSON.stringify(scoreVentas)}`)
      return { error: true }
    }

    const result = {
      score: scoreVentas.valor_algoritmo,
      descripcion: scoreVentas.nombre,
      limite_inferior: scoreVentas.limite_inferior,
      limite_superior: scoreVentas.limite_superior,
      ventas_anuales: ventasAnualesAnioAnterior.ventas_anuales,
      periodo_anterior_estado_resultados: ventasAnualesAnioAnterior.periodo_anterior
    }

    logger.info(`${fileMethod} | ${customUuid} La información para el score de certificación es: ${JSON.stringify(result)}`)
    return result
  } catch (error) {
    logger.error(`${fileMethod} | ${customUuid} Error general: ${JSON.stringify(error)}`)
    return { error: true }
  }
}

const getScoreApalancamiento = async (id_certification, customUuid, algoritmo_v) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: getScoreApalancamiento`
  try {
    let valor_algoritmo = '0'
    const [deudaTotalPCA, capitalContable] = await Promise.all([
      certificationService.deudaTotalPCA(id_certification),
      certificationService.capitalContablePCA(id_certification)
    ])

    if (!deudaTotalPCA || !capitalContable) {
      logger.warn(`${fileMethod} | ${customUuid} No se pudo obtener información de balance para la certificación: ${id_certification}`)
      return { error: true }
    }

    if (!deudaTotalPCA.deuda_total) {
      logger.warn(`${fileMethod} | ${customUuid} No se ha podido obtener deuda total de partida de balance del periodo contable anterior: ${JSON.stringify(deudaTotalPCA)}`)
      valor_algoritmo = '-30'
    }

    const parseNumber = require('../../utils/number')

    const deuda = parseNumber(deudaTotalPCA.deuda_total)
    const capital = parseNumber(capitalContable.capital_contable)
    const apalancamiento = deuda / capital
    logger.info(`${fileMethod} | ${customUuid} El apalancamiento obtenido de la certificación ID: ${id_certification} es: ${apalancamiento}`)

    if (Number(algoritmo_v?.v_alritmo) === 2) {
      const defaultScore = await certificationService.getScoreApalancamiento(0, algoritmo_v)
      if (!defaultScore) {
        logger.warn(`${fileMethod} | ${customUuid} No se ha podido obtener el score de apalancamiento para algoritmo v2`)
        return { error: true }
      }

      return {
        score: defaultScore.valor_algoritmo,
        descripcion_apalancamiento:
          Number(algoritmo_v?.v_alritmo) === 2 ? 'algoritmo v2' : 'algoritmo v1',
        deuda_total_estado_balance_periodo_anterior: deudaTotalPCA.deuda_total,
        periodo_estado_balance_tipo: deudaTotalPCA.tipo,
        periodo_anterior_estado_balance: deudaTotalPCA.periodo_anterior,
        periodo_actual_estado_balance: deudaTotalPCA.periodo_actual,
        periodo_previo_anterior_estado_balance: deudaTotalPCA.periodo_previo_anterior,
        limite_inferior: defaultScore.limite_inferior,
        limite_superior: defaultScore.limite_superior,
        capital_contable_estado_balance: capitalContable.capital_contable,
        apalancamiento
      }
    }

    if (!Number.isFinite(apalancamiento)) {
      const descripcion =
        valor_algoritmo === '-30'
          ? 'Indefinido por no reportar deuda total'
          : 'DESCONOCIDO'

      const scoreFinal = valor_algoritmo === '-30' ? '-30' : '0'

      return {
        score: scoreFinal,
        descripcion_apalancamiento: descripcion,
        deuda_total_estado_balance_periodo_anterior: deudaTotalPCA.deuda_total,
        periodo_estado_balance_tipo: deudaTotalPCA.tipo,
        periodo_anterior_estado_balance: deudaTotalPCA.periodo_anterior,
        periodo_actual_estado_balance: deudaTotalPCA.periodo_actual,
        periodo_previo_anterior_estado_balance: deudaTotalPCA.periodo_previo_anterior,
        limite_inferior: '',
        limite_superior: '',
        capital_contable_estado_balance: capitalContable.capital_contable,
        apalancamiento
      }
    }

    const getScore = await certificationService.getScoreApalancamiento(apalancamiento, algoritmo_v)
    if (!getScore) {
      logger.warn(`${fileMethod} | ${customUuid} No se ha podido obtener el score de apalancamiento : ${JSON.stringify(getScore)}`)
      return { error: true }
    }

    return {
      score: valor_algoritmo !== '0' ? valor_algoritmo : getScore.valor_algoritmo,
      descripcion_apalancamiento: getScore.nombre,
      deuda_total_estado_balance_periodo_anterior: deudaTotalPCA.deuda_total,
      periodo_estado_balance_tipo: deudaTotalPCA.tipo,
      periodo_anterior_estado_balance: deudaTotalPCA.periodo_anterior,
      periodo_actual_estado_balance: deudaTotalPCA.periodo_actual,
      periodo_previo_anterior_estado_balance: deudaTotalPCA.periodo_previo_anterior,
      limite_inferior: getScore.limite_inferior,
      limite_superior: getScore.limite_superior,
      capital_contable_estado_balance: capitalContable.capital_contable,
      apalancamiento
    }
  } catch (error) {
    logger.error(`${fileMethod} | ${customUuid} Error general: ${JSON.stringify(error)}`)
    return { error: true }
  }
}

const calculaDpo = async (idCertification, caja_bancos_periodo_anterior, dso, dio) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: calculaDpo`
  try {
    let dpo = 'N/A'
    const mayor1500 = caja_bancos_periodo_anterior > algorithmConstants.monto_mayor1500
    const menor500 = caja_bancos_periodo_anterior < algorithmConstants.monto_menor500
    const rangoMedio = !mayor1500 && !menor500

    if (mayor1500) {
      if (!dso && !dio) dpo = algorithmConstants.dpo_mayor1500.sin
      else if ((!dso && dio) || (dso && !dio)) dpo = algorithmConstants.dpo_mayor1500.conUno
      else if (dso && dio) dpo = algorithmConstants.dpo_mayor1500.conDos
    } else if (menor500) {
      dpo = algorithmConstants.dpo_menor500.sin
    } else if (rangoMedio) {
      if (!dso && !dio) dpo = algorithmConstants.dpo_entre500y1500.sin
      else if (!dso && dio) dpo = algorithmConstants.dpo_entre500y1500.conUno
      else dpo = algorithmConstants.dpo_entre500y1500.conDos
    }

    await certificationService.updateDpo(idCertification, dpo)

    return dpo

  } catch (error) {
    logger.error(`${fileMethod} | ${customUuid} Error general: ${JSON.stringify(error)}`)
    return {
      error: true
    }
  }
}

const getScoreCajaBancos = async (id_certification, customUuid) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: getScoreCajaBancos`
  try {
    const cajaBancoPCA = await certificationService.cajaBancoPCA(id_certification)
    if (!cajaBancoPCA) {
      logger.warn(`${fileMethod} | ${customUuid} No se ha podido obtener caja banco del periodo contable anterior`)
      return { error: true }
    }

    const scoreInfo = await certificationService.getScoreCajaBancoPCA(cajaBancoPCA.caja_bancos)
    if (!scoreInfo) {
      logger.warn(`${fileMethod} | ${customUuid} No se ha podido obtener el score de caja bancos`)
      return { error: true }
    }

    const response = {
      descripcion: scoreInfo.nombre,
      score: scoreInfo.valor_algoritmo,
      caja_bancos_periodo_anterior: cajaBancoPCA.caja_bancos,
      limite_inferior: scoreInfo.limite_inferior,
      limite_superior: scoreInfo.limite_superior
    }

    logger.info(`${fileMethod} | ${customUuid} Score de caja bancos: ${JSON.stringify(response)}`)
    return response
  } catch (error) {
    logger.error(`${fileMethod} | ${customUuid} Error general: ${JSON.stringify(error)}`)
    return { error: true }
  }
}

const getScoreCapitalContable = async (id_certification, customUuid) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: getScoreCapitalContable`
  try {
    const capitalContableEBPA = await certificationService.capitalContableEBPA(id_certification)
    if (!capitalContableEBPA || capitalContableEBPA.capital_contable == null) {
      logger.warn(`${fileMethod} | ${customUuid} No se ha podido obtener el Capital contable del estado de balance previo anterior: ${JSON.stringify(capitalContableEBPA)}`)
      return { error: true }
    }

    logger.info(`${fileMethod} | ${customUuid} La información de capital contable de estado de balance previo anterior de la certificación ID: ${id_certification} es: ${JSON.stringify(capitalContableEBPA)}`)

    const capitalContable = Number(capitalContableEBPA.capital_contable)
    if (Number.isNaN(capitalContable)) {
      logger.warn(`${fileMethod} | ${customUuid} El valor de capital contable obtenido no es numérico: ${capitalContableEBPA.capital_contable}`)
      return { error: true }
    }

    const getScore = await certificationService.getScoreCapitalContableEBPA(capitalContable)
    if (!getScore) {
      return { error: true }
    }

    const scoreInfo = {
      error: false,
      score: getScore.valor_algoritmo,
      descripcion: getScore.nombre,
      limite_inferior: getScore.limite_inferior,
      limite_superior: getScore.limite_superior,
      capital_contable_estado_balance_PA: capitalContable
    }

    logger.info(`${fileMethod} | ${customUuid} La información para el score de capital contable es: ${JSON.stringify(scoreInfo)}`)

    return scoreInfo
  } catch (error) {
    logger.error(`${fileMethod} | ${customUuid} Error general: ${JSON.stringify(error)}`)
    return {
      error: true
    }
  }
}

const getPaisScoreFromSummary = async (id_certification, algoritmo_v, parametrosAlgoritmo, customUuid) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: getPaisScoreFromSummary`
  try {
    const pais = await certificationService.getPaisAlgoritmoByIdCertification(id_certification)
    if (!pais) {
      logger.warn(`${fileMethod} | ${customUuid} No se encontró el país para la certificación ${id_certification}`)
      return { error: true }
    }

    const paisScore = parametrosAlgoritmo.paisScore.find(p => p.nombre === pais.nombre)
    if (!paisScore) {
      logger.warn(`${fileMethod} | ${customUuid} No se encontró configuración en parámetros para el país ${pais.nombre}`)
      return { error: true }
    }

    const score = Number(algoritmo_v?.v_alritmo) === 2 ? paisScore.v2 : paisScore.v1
    return { nombre: pais.nombre, valor_algoritmo: score }
  } catch (error) {
    logger.error(`${fileMethod} | ${customUuid} Error general: ${JSON.stringify(error)}`)
    return { error: true }
  }
}

const getSectorRiesgoScoreFromSummary = async (id_certification, algoritmo_v, parametrosAlgoritmo, customUuid) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: getSectorRiesgoScoreFromSummary`
  try {
    const sectorRiesgo = await certificationService.getSectorRiesgoByIdCertification(id_certification, algoritmo_v)
    if (!sectorRiesgo) {
      logger.warn(`${fileMethod} | ${customUuid} No se encontró sector riesgo para la certificación ${id_certification}`)
      return { error: true }
    }

    const sectorScore = parametrosAlgoritmo.sectorRiesgoScore.find(s => s.nombre === sectorRiesgo.nombre)
    if (!sectorScore) {
      logger.warn(`${fileMethod} | ${customUuid} No se encontró configuración en parámetros para el sector ${sectorRiesgo.nombre}`)
      return { error: true }
    }

    const score = Number(algoritmo_v?.v_alritmo) === 2 ? sectorScore.v2 : sectorScore.v1
    return { nombre: sectorRiesgo.nombre, valor_algoritmo: score }
  } catch (error) {
    logger.error(`${fileMethod} | ${customUuid} Error general: ${JSON.stringify(error)}`)
    return { error: true }
  }
}

const getScoreCapitalContableFromSummary = async (id_certification, algoritmo_v, parametrosAlgoritmo, customUuid) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: getScoreCapitalContableFromSummary`
  try {
    const capitalContableEBPA = await certificationService.capitalContableEBPA(id_certification)
    if (!capitalContableEBPA || capitalContableEBPA.capital_contable == null) {
      logger.warn(`${fileMethod} | ${customUuid} No se ha podido obtener el Capital contable del estado de balance previo anterior: ${JSON.stringify(capitalContableEBPA)}`)
      return { error: true }
    }

    const capitalContable = Number(capitalContableEBPA.capital_contable)
    if (Number.isNaN(capitalContable)) {
      logger.warn(`${fileMethod} | ${customUuid} El valor de capital contable obtenido no es numérico: ${capitalContableEBPA.capital_contable}`)
      return { error: true }
    }

    const capitalScore = parametrosAlgoritmo.capitalContableScore.find(c => {
      const limiteSuperior = c.limite_superior == null ? 9999999999 : c.limite_superior
      return capitalContable >= c.limite_inferior && capitalContable <= limiteSuperior
    })
    if (!capitalScore) {
      return { error: true }
    }

    const score = Number(algoritmo_v?.v_alritmo) === 2 ? capitalScore.v2 : capitalScore.v1
    const scoreInfo = {
      error: false,
      score,
      descripcion: capitalScore.nombre,
      limite_inferior: capitalScore.limite_inferior,
      limite_superior: capitalScore.limite_superior,
      capital_contable_estado_balance_PA: capitalContable
    }

    logger.info(`${fileMethod} | ${customUuid} La información para el score de capital contable es: ${JSON.stringify(scoreInfo)}`)

    return scoreInfo
  } catch (error) {
    logger.error(`${fileMethod} | ${customUuid} Error general: ${JSON.stringify(error)}`)
    return { error: true }
  }
}

const getScorePlantillaLaboralFromSummary = async (id_certification, algoritmo_v, parametrosAlgoritmo, customUuid) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: getScorePlantillaLaboralFromSummary`
  try {
    const plantillaCertification = await certificationService.getPlantillaCertification(id_certification)
    if (!plantillaCertification || plantillaCertification.plantilla_laboral == null) {
      logger.warn(`${fileMethod} | ${customUuid} No se ha podido obtener la plantilla de la empresa: ${JSON.stringify(plantillaCertification)}`)
      return { error: true }
    }

    const plantillaLaboral = Number(plantillaCertification.plantilla_laboral)
    if (Number.isNaN(plantillaLaboral)) {
      logger.warn(`${fileMethod} | ${customUuid} El valor de plantilla laboral obtenido no es numérico: ${plantillaCertification.plantilla_laboral}`)
      return { error: true }
    }

    const plantillaScore = parametrosAlgoritmo.plantillaLaboralScore.find(p => {
      const limiteSuperior = p.limite_superior == null ? 9999999999 : p.limite_superior
      return plantillaLaboral >= p.limite_inferior && plantillaLaboral <= limiteSuperior
    })

    if (!plantillaScore) {
      return { error: true }
    }

    const score = Number(algoritmo_v?.v_alritmo) === 2 ? plantillaScore.v2 : plantillaScore.v1
    const result = {
      score,
      descripcion: plantillaScore.nombre,
      limite_inferior: plantillaScore.limite_inferior,
      limite_superior: plantillaScore.limite_superior,
      plantilla_laboral: plantillaLaboral
    }

    logger.info(`${fileMethod} | ${customUuid} La información para el score de plantilla laboral es: ${JSON.stringify(result)}`)

    return result
  } catch (error) {
    logger.error(`${fileMethod} | ${customUuid} Error general: ${JSON.stringify(error)}`)
    return { error: true }
  }
}

const getScoreClienteFinalFromSummary = async (
  id_certification,
  algoritmo_v,
  parametrosAlgoritmo,
  customUuid
) => {
  const fileMethod =
    `file: src/controllers/api/certification.js - method: getScoreClienteFinalFromSummary`
  try {
    const sectorClienteFinal = await certificationService.getScoreClienteFinal(
      id_certification,
      algoritmo_v
    )

    if (!sectorClienteFinal) {
      logger.warn(
        `${fileMethod} | ${customUuid} No se encontró sector cliente final para la certificación ${id_certification}`
      )
      return { error: true }
    }

    const sectorScore = parametrosAlgoritmo.sectorClienteFinalScore.find(
      s => s.nombre === sectorClienteFinal.nombre
    )

    if (!sectorScore) {
      logger.warn(
        `${fileMethod} | ${customUuid} No se encontró configuración en parámetros para el sector cliente final ${sectorClienteFinal.nombre}`
      )
      return { error: true }
    }

    const score = Number(algoritmo_v?.v_alritmo) === 2 ? sectorScore.v2 : sectorScore.v1
    return { nombre: sectorClienteFinal.nombre, valor_algoritmo: score }
  } catch (error) {
    logger.error(
      `${fileMethod} | ${customUuid} Error general: ${JSON.stringify(error)}`
    )
    return { error: true }
  }
}

const getScoreTiempoActividadFromSummary = async (
  id_certification,
  algoritmo_v,
  parametrosAlgoritmo,
  customUuid
) => {
  const fileMethod =
    `file: src/controllers/api/certification.js - method: getScoreTiempoActividadFromSummary`
  try {
    const tiempoActividad = await certificationService.getScoreTiempoActividad(
      id_certification,
      algoritmo_v
    )

    if (!tiempoActividad) {
      logger.warn(
        `${fileMethod} | ${customUuid} No se encontró tiempo actividad para la certificación ${id_certification}`
      )
      return { error: true }
    }

    const tiempoScore = parametrosAlgoritmo.tiempoActividadScore.find(
      t => t.nombre === tiempoActividad.nombre
    )

    if (!tiempoScore) {
      logger.warn(
        `${fileMethod} | ${customUuid} No se encontró configuración en parámetros para el tiempo actividad ${tiempoActividad.nombre}`
      )
      return { error: true }
    }

    const score = Number(algoritmo_v?.v_alritmo) === 2 ? tiempoScore.v2 : tiempoScore.v1
    return { nombre: tiempoActividad.nombre, valor_algoritmo: score }
  } catch (error) {
    logger.error(
      `${fileMethod} | ${customUuid} Error general: ${JSON.stringify(error)}`
    )
    return { error: true }
  }
}

const getControlanteScoreFromSummary = async (
  id_certification,
  parametrosAlgoritmo,
  customUuid
) => {
  const fileMethod =
    `file: src/controllers/api/certification.js - method: getControlanteScoreFromSummary`
  try {
    const accionistas = await certificationService.getAccionistas(id_certification)

    const accionistaControlante = accionistas && accionistas.result
      ? accionistas.result.find(a => parseInt(a.controlante) === 1)
      : null

    const nombreEmpresaControlante = accionistaControlante?.razon_social || null
    const rfcEmpresaControlante = accionistaControlante?.rfc || null

    let respuestaDemandas = { data: { demandas: [] } }
    if (nombreEmpresaControlante) {
      respuestaDemandas = await obtenerDemandas(nombreEmpresaControlante)
    }
    logger.info(
      `${fileMethod} | ${customUuid} Demandas obtenidas: ${JSON.stringify(respuestaDemandas)}`
    )

    const hayDemandaPenal = respuestaDemandas.data?.demandas?.some(
      d => d.tipo_proceso?.toLowerCase() === 'penal'
    )

    const haceUnAño = new Date()
    haceUnAño.setFullYear(haceUnAño.getFullYear() - 1)

    const demandasMercantilesRecientes = respuestaDemandas.data?.demandas?.filter(
      d =>
        d.tipo_proceso?.toLowerCase() === 'mercantil' &&
        new Date(d.fecha) >= haceUnAño
    )

    const hayDosOMasIncidenciasRecientes =
      demandasMercantilesRecientes?.length >= 2

    const resumenDemandas = {
      hay_demanda_penal: hayDemandaPenal,
      hay_2_o_mas_mercantiles_recientes: hayDosOMasIncidenciasRecientes
    }

    logger.info(
      `${fileMethod} | ${customUuid} Resumen demandas: ${JSON.stringify(resumenDemandas)}`
    )

    const blocData = nombreEmpresaControlante
      ? await consultaBlocEmpresaControlanteData(nombreEmpresaControlante)
      : {
        bloc_sat69b: null,
        bloc_ofac: null,
        bloc_concursos_mercantiles: null,
        bloc_proveedores_contratistas: null
      }

    logger.info(
      `${fileMethod} | ${customUuid} Bloc data: ${JSON.stringify(blocData)}`
    )

    const sinDemandas =
      !respuestaDemandas.data?.demandas ||
      respuestaDemandas.data.demandas.length === 0

    const isBlocValueEmpty = v => {
      if (v == null) return true
      if (Array.isArray(v)) return v.length === 0
      if (typeof v === 'object') {
        const values = Object.values(v)
        if (values.length === 0) return true
        return values.every(isBlocValueEmpty)
      }
      return false
    }

    const sinBlocInfo = !blocData ||
      [
        blocData.bloc_sat69b,
        blocData.bloc_ofac,
        blocData.bloc_concursos_mercantiles,
        blocData.bloc_proveedores_contratistas
      ].every(isBlocValueEmpty)

    const reglasConfiguradas =
      Array.isArray(parametrosAlgoritmo?.influenciaControlanteScore)
        ? parametrosAlgoritmo.influenciaControlanteScore
          .map(r => r.nombre)
          .filter(Boolean)
        : []

    const reglaDesconocido = reglasConfiguradas.find(r =>
      r.toLowerCase().includes('desconocido')
    )
    const reglaPositivo = reglasConfiguradas.find(r =>
      r.toLowerCase().includes('positivo')
    )
    const reglaNegativa = reglasConfiguradas.find(r =>
      ['aes', 'bloc', 'demanda'].some(k => r.toLowerCase().includes(k))
    )

    let regla = ''
    if (!accionistaControlante) {
      regla = reglaDesconocido || 'Regla no definida'
    } else if (sinDemandas && sinBlocInfo) {
      regla = reglaPositivo || 'Regla no definida'
    } else {
      regla = reglaNegativa || 'Regla no definida'
    }

    const cat = await certificationService.getInfluenciaControlanteScore(regla)
    const score = cat ? cat.valor_algoritmo : null

    const insertData = {
      id_certification,
      empresa_controlante: nombreEmpresaControlante,
      demandas_penales: resumenDemandas.hay_demanda_penal ? 1 : 0,
      demandas_mercantiles: resumenDemandas.hay_2_o_mas_mercantiles_recientes ? 1 : 0,
      sat_69b: blocData.bloc_sat69b,
      ofac: blocData.bloc_ofac,
      mercantiles_proveedores: blocData.bloc_concursos_mercantiles,
      contratistas_boletinados: blocData.bloc_proveedores_contratistas
    }

    await certificationService.insertResultadoEmpresaControlante(insertData)

    return {
      score,
      regla,
      empresa_controlante: nombreEmpresaControlante,
      resumen_demandas: resumenDemandas,
      bloc_data: blocData,
      resultado_empresa_controlante: insertData
    }
  } catch (error) {
    logger.error(
      `${fileMethod} | ${customUuid} Error general: ${JSON.stringify(error)}`
    )
    return { error: true }
  }
}

const getScoreVentasAnualesFromSummary = async (
  id_certification,
  algoritmo_v,
  parametrosAlgoritmo,
  customUuid
) => {
  const fileMethod =
    `file: src/controllers/api/certification.js - method: getScoreVentasAnualesFromSummary`
  try {
    const ventasAnualesAnioAnterior =
      await certificationService.getVentasAnualesAnioAnterior(id_certification)

    if (
      !ventasAnualesAnioAnterior ||
      ventasAnualesAnioAnterior.ventas_anuales == null
    ) {
      logger.warn(
        `${fileMethod} | ${customUuid} No se ha podido obtener las ventas anuales del estado de resultados del periodo previo anterior: ${JSON.stringify(
          ventasAnualesAnioAnterior
        )}`
      )
      return { error: true }
    }

    const ventasAnuales = Number(ventasAnualesAnioAnterior.ventas_anuales)
    if (Number.isNaN(ventasAnuales)) {
      logger.warn(
        `${fileMethod} | ${customUuid} El valor de ventas anuales obtenido no es numérico: ${ventasAnualesAnioAnterior.ventas_anuales}`
      )
      return { error: true }
    }

    const ventaScore = parametrosAlgoritmo.ventasAnualesScore.find(v => {
      const limiteSuperior =
        v.limite_superior == null ? 9999999999 : v.limite_superior
      return ventasAnuales >= v.limite_inferior && ventasAnuales <= limiteSuperior
    })

    if (!ventaScore) {
      return { error: true }
    }

    const score = Number(algoritmo_v?.v_alritmo) === 2 ? ventaScore.v2 : ventaScore.v1

    const result = {
      score,
      descripcion: ventaScore.nombre,
      limite_inferior: ventaScore.limite_inferior,
      limite_superior: ventaScore.limite_superior,
      ventas_anuales: ventasAnuales,
      periodo_anterior_estado_resultados: ventasAnualesAnioAnterior.periodo_anterior
    }

    logger.info(
      `${fileMethod} | ${customUuid} La información para el score de ventas anuales es: ${JSON.stringify(
        result
      )}`
    )

    return result
  } catch (error) {
    logger.error(`${fileMethod} | ${customUuid} Error general: ${JSON.stringify(error)}`)
    return { error: true }
  }
}

const getScoreTipoCifrasFromSummary = async (
  id_certification,
  algoritmo_v,
  parametrosAlgoritmo,
  customUuid
) => {
  const fileMethod =
    `file: src/controllers/api/certification.js - method: getScoreTipoCifrasFromSummary`
  try {
    const tipoCifraId = await certificationService.getTipoCifra(id_certification)
    if (tipoCifraId === null || tipoCifraId === undefined) {
      logger.warn(
        `${fileMethod} | ${customUuid} No se ha podido obtener el tipo de cifra`
      )
      return { error: true }
    }

    const tipoInfo = await certificationService.getScoreTipoCifra(tipoCifraId)
    if (!tipoInfo) {
      logger.warn(
        `${fileMethod} | ${customUuid} No se pudo obtener la descripción del tipo cifra`
      )
      return { error: true }
    }

    const tipoScore = parametrosAlgoritmo.tipoCifrasScore.find(
      t => t.nombre === tipoInfo.nombre
    )
    if (!tipoScore) return { error: true }

    const score = Number(algoritmo_v?.v_alritmo) === 2 ? tipoScore.v2 : tipoScore.v1
    return { id_tipo_cifra: tipoCifraId, descripcion: tipoInfo.nombre, score }
  } catch (error) {
    logger.error(`${fileMethod} | ${customUuid} Error general: ${JSON.stringify(error)}`)
    return { error: true }
  }
}

const getScoreIncidenciasLegalesFromSummary = async (
  id_certification,
  algoritmo_v,
  parametrosAlgoritmo,
  customUuid
) => {
  const fileMethod =
    `file: src/controllers/api/certification.js - method: getScoreIncidenciasLegalesFromSummary`
  try {
    const incidencias = await certificationService.getDemandas(id_certification)
    if (!incidencias || !incidencias.result) {
      logger.warn(
        `${fileMethod} | ${customUuid} No se han podido obtener incidencias legales`
      )
      return { error: true }
    }

    let tipo = null
    let fecha = null
    let caso = 'NINGUNA'
    let countMerc = 0
    let penal = false

    for (const inc of incidencias.result) {
      tipo = inc.tipo_demanda
      fecha = inc.fecha_demanda
      if (tipo === 'mercantil') {
        const dif = (new Date() - new Date(fecha)) / (1000 * 60 * 60 * 24)
        if (dif <= 365) countMerc++
      } else if (tipo === 'penal') {
        penal = true
      }
    }

    if (penal) {
      caso = '>= 1 INCIDENCIA PENAL ( no importando el año)'
    } else if (countMerc === 1) {
      caso = '1 INCIDENCIA MERCANTIL <= 1 AÑO'
    } else if (countMerc >= 2) {
      caso = '2 INCIDENCIAS MERCANTILES <= 1 AÑO'
    }

    const cat = parametrosAlgoritmo.incidenciasLegalesScore.find(
      i => i.nombre === caso
    )
    if (!cat) return { error: true }

    const score = Number(algoritmo_v?.v_alritmo) === 2 ? cat.v2 : cat.v1

    return {
      score,
      tipo: penal || countMerc ? tipo : null,
      fecha: penal || countMerc ? fecha : null,
      caso: cat.nombre
    }
  } catch (error) {
    logger.error(`${fileMethod} | ${customUuid} Error general: ${JSON.stringify(error)}`)
    return { error: true }
  }
}

const getScoreEvolucionVentasFromSummary = async (
  id_certification,
  algoritmo_v,
  parametrosAlgoritmo,
  customUuid
) => {
  const fileMethod =
    `file: src/controllers/api/certification.js - method: getScoreEvolucionVentasFromSummary`
  try {
    const [anioAnterior, previoAnterior] = await Promise.all([
      certificationService.getVentasAnualesAnioAnterior(id_certification),
      certificationService.getVentasAnualesAnioPrevioAnterior(id_certification)
    ])

    if (anioAnterior === null || anioAnterior === undefined ||
      previoAnterior === null || previoAnterior === undefined) {
      return { error: true }
    }

    const anterior = parseFloat(anioAnterior.ventas_anuales)
    const previo = parseFloat(previoAnterior.ventas_anuales)
    const evolucion = ((anterior - previo) / previo) * 100

    if (!Number.isFinite(evolucion)) {
      return {
        score: '0',
        nombre: `(${anterior} - ${previo}) / ${previo} * 100`,
        rango_numerico: 'null',
        ventas_anuales_periodo_anterior_estado_resultados: anterior,
        periodo_anterior_estado_resultados: anioAnterior.periodo_anterior,
        ventas_anuales_periodo_previo_anterior_estado_resultados: previo,
        evolucion_ventas: evolucion
      }
    }

    const base = {
      ventas_anuales_periodo_anterior_estado_resultados: anterior,
      periodo_anterior_estado_resultados: anioAnterior.periodo_anterior,
      ventas_anuales_periodo_previo_anterior_estado_resultados: previo,
      evolucion_ventas: evolucion
    }



    const evoScore = parametrosAlgoritmo.evolucionVentasScore.find(e => {
      const [inf, sup] = getLimits(e)
      return evolucion >= inf && evolucion <= sup
    })
    if (!evoScore) return { error: true }

    const result = {
      score:
        Number(algoritmo_v?.v_alritmo) === 2 ? evoScore.v2 : evoScore.v1,
      nombre: evoScore.nombre,
      rango_numerico: evoScore.rango,
      ...base
    }

    return result
  } catch (error) {
    logger.error(`${fileMethod} | ${customUuid} Error general: ${JSON.stringify(error)}`)
    return { error: true }
  }
}

const getScoreApalancamientoFromSummary = async (
  id_certification,
  algoritmo_v,
  parametrosAlgoritmo,
  customUuid
) => {
  const fileMethod =
    `file: src/controllers/api/certification.js - method: getScoreApalancamientoFromSummary`
  try {
    const [
      [estadoBalanceAnterior],
      [estadoBalancePrevioAnterior]
    ] = await Promise.all([
      certificationService.getEstadoBalanceData(id_certification, 'anterior'),
      certificationService.getEstadoBalanceData(id_certification, 'previo_anterior')
    ])
    const [pasivoLargoPlazoPCA, capitalContable] = await Promise.all([
      certificationService.pasivoLargoPlazoPCA(id_certification),
      certificationService.capitalContablePCA(id_certification)
    ])

    if (!pasivoLargoPlazoPCA || !capitalContable) {
      logger.warn(
        `${fileMethod} | ${customUuid} Falta deuda total o capital contable`
      )
      return { error: true }
    }

    const parseNumber = require('../../utils/number')

    const toFloat = (value) => parseNumber(value ?? 0)

    const pasivoAnterior =
      toFloat(estadoBalanceAnterior?.pasivo_largo_plazo_anterior) +
      toFloat(estadoBalanceAnterior?.pasivo_diferido_anterior) +
      toFloat(estadoBalanceAnterior?.total_pasivo_circulante_anterior)
    const capitalAnterior =
      toFloat(estadoBalanceAnterior?.capital_social_anterior) +
      toFloat(estadoBalanceAnterior?.resultado_ejercicios_anteriores_anterior) +
      toFloat(estadoBalanceAnterior?.resultado_ejercicios_anterior) +
      toFloat(estadoBalanceAnterior?.otro_capital_anterior)
    const pasivoPrevio =
      toFloat(estadoBalancePrevioAnterior?.pasivo_largo_plazo_previo_anterior) +
      toFloat(estadoBalancePrevioAnterior?.pasivo_diferido_previo_anterior) +
      toFloat(estadoBalancePrevioAnterior?.total_pasivo_circulante_previo_anterior)
    const capitalPrevio =
      toFloat(estadoBalancePrevioAnterior?.capital_social_previo_anterior) +
      toFloat(estadoBalancePrevioAnterior?.resultado_ejercicios_anteriores_previo_anterior) +
      toFloat(estadoBalancePrevioAnterior?.resultado_ejercicios_previo_anterior) +
      toFloat(estadoBalancePrevioAnterior?.otro_capital_previo_anterior)

    const solvenciaAnterior =
      !isNaN(pasivoAnterior) && !isNaN(capitalAnterior) && capitalAnterior !== 0
        ? parseFloat((pasivoAnterior / capitalAnterior).toFixed(1))
        : capitalAnterior === 0
          ? null
          : NaN
    const solvenciaPrevio =
      !isNaN(pasivoPrevio) && !isNaN(capitalPrevio) && capitalPrevio !== 0
        ? parseFloat((pasivoPrevio / capitalPrevio).toFixed(1))
        : capitalPrevio === 0
          ? null
          : NaN

    const pasivo = pasivoAnterior
    const capital = capitalAnterior

    if (!Number.isFinite(pasivo) || !Number.isFinite(capital)) {
      logger.warn(
        `${fileMethod} | ${customUuid} Valores no numéricos para calcular apalancamiento`
      )
      return { error: true }
    }

    const deudaReportada = pasivo !== 0
    const capitalReportado = capital !== 0

    let apalancamiento = null
    if (deudaReportada && capitalReportado && capital !== 0) {
      apalancamiento = parseFloat((pasivo / capital).toFixed(1))
    }

    const operacion = `${pasivo} / ${capital}`

    const versionField = Number(algoritmo_v?.v_alritmo) === 2 ? 'v2' : 'v1'
    const noCapitalScore = parametrosAlgoritmo.apalancamientoScore.find(a =>
      a.nombre && a.nombre.toLowerCase().includes('capital') && a.nombre.toLowerCase().includes('no')
    )
    const noDeudaScore = parametrosAlgoritmo.apalancamientoScore.find(a =>
      a.nombre && a.nombre.toLowerCase().includes('deuda') && a.nombre.toLowerCase().includes('no')
    )
    const desconocidoScore = parametrosAlgoritmo.apalancamientoScore.find(a =>
      a.nombre && a.nombre.toLowerCase().includes('desconocido')
    )

    let apalScore = null

    if (!capitalReportado && !deudaReportada) {
      const allScores = parametrosAlgoritmo.apalancamientoScore.filter(
        s => s[versionField] !== null && s[versionField] !== undefined && s.nombre
      )

      if (allScores.length > 0) {
        apalScore = allScores.reduce((min, curr) =>
          parseFloat(curr[versionField]) < parseFloat(min[versionField]) ? curr : min
        )
      } else {
        apalScore = desconocidoScore
      }
    } else if (!capitalReportado) {
      apalScore = noCapitalScore || desconocidoScore
    } else if (!deudaReportada) {
      apalScore = noDeudaScore || desconocidoScore
    } else if (apalancamiento !== null && !Number.isNaN(apalancamiento)) {
      const ranges = parametrosAlgoritmo.apalancamientoScore.filter(a => {
        if (a.limite_inferior !== null && a.limite_superior !== null) {
          const inf = parseFloat(a.limite_inferior)
          const sup = parseFloat(a.limite_superior)
          return apalancamiento >= inf && apalancamiento <= sup
        }
        return false
      })

      if (ranges.length > 0) {
        apalScore = ranges.reduce((min, curr) =>
          parseFloat(curr[versionField]) < parseFloat(min[versionField]) ? curr : min
        )
      } else {
        apalScore = desconocidoScore
      }
    } else {
      apalScore = desconocidoScore
    }

    const score = Number(algoritmo_v?.v_alritmo) === 2 ? apalScore.v2 : apalScore.v1

    return {
      score,
      descripcion_apalancamiento: apalScore.nombre,
      deuda_total_estado_balance_periodo_anterior:
        pasivoLargoPlazoPCA.total_pasivo_largo_plazo,
      periodo_estado_balance_tipo: pasivoLargoPlazoPCA.tipo,
      periodo_anterior_estado_balance: pasivoLargoPlazoPCA.periodo_anterior,
      periodo_actual_estado_balance: pasivoLargoPlazoPCA.periodo_actual,
      periodo_previo_anterior_estado_balance:
        pasivoLargoPlazoPCA.periodo_previo_anterior,
      limite_inferior: apalScore.limite_inferior,
      limite_superior: apalScore.limite_superior,
      capital_contable_estado_balance: capitalContable.capital_contable,
      apalancamiento,
      operacion
    }
  } catch (error) {
    logger.error(`${fileMethod} | ${customUuid} Error general: ${JSON.stringify(error)}`)
    return { error: true }
  }
}


const getScoreCajaBancosFromSummary = async (
  id_certification,
  algoritmo_v,
  parametrosAlgoritmo,
  customUuid
) => {
  const fileMethod =
    `file: src/controllers/api/certification.js - method: getScoreCajaBancosFromSummary`
  try {
    const cajaBancoPCA = await certificationService.cajaBancoPCA(id_certification)
    if (!cajaBancoPCA) return { error: true }



    const cajaScore = parametrosAlgoritmo.flujoNetoScore.find(c => {
      const [inf, sup] = getLimits(c)
      return cajaBancoPCA.caja_bancos >= inf && cajaBancoPCA.caja_bancos <= sup
    })
    if (!cajaScore) {
      return {
        error: true,
        caja_bancos_periodo_anterior: cajaBancoPCA.caja_bancos
      }
    }

    const score = Number(algoritmo_v?.v_alritmo) === 2 ? cajaScore.v2 : cajaScore.v1

    return {
      descripcion: cajaScore.nombre,
      score,
      caja_bancos_periodo_anterior: cajaBancoPCA.caja_bancos,
      limite_inferior: cajaScore.limite_inferior,
      limite_superior: cajaScore.limite_superior
    }
  } catch (error) {
    logger.error(`${fileMethod} | ${customUuid} Error general: ${JSON.stringify(error)}`)
    return { error: true }
  }
}

const getScorePaybackFromSummary = async (
  id_certification,
  algoritmo_v,
  parametrosAlgoritmo,
  customUuid
) => {
  const fileMethod =
    `file: src/controllers/api/certification.js - method: getScorePaybackFromSummary`
  try {
    const parseNumber = require('../../utils/number')
    let scoreOverride = null
    const [
      pasivoCirculanteData,
      utilidadOperativa,
      estadoBalanceAnterior
    ] = await Promise.all([
      certificationService.totalPasivoCirculanteAnterior(id_certification),
      certificationService.utilidadOperativa(id_certification),
      certificationService.getEstadoBalanceData(id_certification, 'anterior')
    ])

    if (!utilidadOperativa) return { error: true }

    if (utilidadOperativa.utilidad_operativa == 0) scoreOverride = 'N/A'

    let payback = null
    let paybackScore
    let operacionPayback = null

    const pasivoLargoPlazoAnterior = parseNumber(
      estadoBalanceAnterior?.pasivo_largo_plazo_anterior ?? 0
    )
    const pasivoDiferidoAnterior = parseNumber(
      estadoBalanceAnterior?.pasivo_diferido_anterior ?? 0
    )
    const pasivoCirculanteAnterior = parseNumber(
      pasivoCirculanteData?.total_pasivo_circulante ?? 0
    )

    const deudaReportada =
      pasivoCirculanteAnterior !== undefined && pasivoCirculanteAnterior !== null

    if (!deudaReportada) {
      paybackScore = parametrosAlgoritmo.paybackScore.find(p =>
        p.nombre &&
        p.nombre.toLowerCase().includes('indefinido') &&
        p.nombre.toLowerCase().includes('corto')
      )
    } else {
      payback =
        pasivoCirculanteAnterior /
        parseNumber(utilidadOperativa.utilidad_operativa)
      operacionPayback = `${pasivoCirculanteAnterior} / ${utilidadOperativa.utilidad_operativa}`
      if (Number.isFinite(payback)) {
        payback = Number(payback.toFixed(2))
      }

      if (payback < 0) {
        paybackScore = parametrosAlgoritmo.paybackScore.find(p =>
          p.nombre && p.nombre.toLowerCase().includes('negativo')
        )
      } else {
        paybackScore = parametrosAlgoritmo.paybackScore.find(p => {
          const sup = p.limite_superior == null ? 9999999999 : p.limite_superior
          return payback >= p.limite_inferior && payback <= sup
        })
      }
    }

    if (!paybackScore) return { error: true }

    const score =
      scoreOverride != null
        ? scoreOverride
        : Number(algoritmo_v?.v_alritmo) === 2
          ? paybackScore.v2
          : paybackScore.v1

    return {
      score,
      deuda_corto_plazo_periodo_anterior: pasivoCirculanteAnterior,
      pasivo_largo_plazo_anterior: pasivoLargoPlazoAnterior,
      pasivo_diferido_anterior: pasivoDiferidoAnterior,
      pasivo_circulante_anterior: pasivoCirculanteAnterior,
      periodo_actual: pasivoCirculanteData ? pasivoCirculanteData.periodo_actual : null,
      periodo_anterior: pasivoCirculanteData ? pasivoCirculanteData.periodo_anterior : null,
      periodo_previo_anterior: pasivoCirculanteData
        ? pasivoCirculanteData.periodo_previo_anterior
        : null,
      utilida_operativa: utilidadOperativa.utilidad_operativa,
      payback,
      operacion: operacionPayback,
      descripcion: paybackScore.nombre,
      limite_inferior: paybackScore.limite_inferior,
      limite_superior: paybackScore.limite_superior
    }
  } catch (error) {
    logger.error(`${fileMethod} | ${customUuid} Error general: ${JSON.stringify(error)}`)
    return { error: true }
  }
}

const getScoreRotacionCtasXCobrasScoreFromSummary = async (
  id_certification,
  algoritmo_v,
  parametrosAlgoritmo,
  customUuid
) => {
  const fileMethod =
    `file: src/controllers/api/certification.js - method: getScoreRotacionCtasXCobrasScoreFromSummary`
  // Evaluar ambos indicadores (DSO y DIO) por separado.
  // Obtener el score de cada uno con base en los parámetros dinámicos.
  // NO se deben sumar los scores.
  // Debe seleccionarse y retornarse el score más alto (más positivo) entre los dos.
  // Esta lógica es para evitar castigos excesivos si al menos uno de los indicadores es favorable.
  try {
    let noDso = false
    let noDio = false
    let dso = 0
    let dio = 0
    let dsoMayor90 = false
    let dioMayor90 = false

    const [saldoClienteCuentaXCobrar, ventasAnuales, saldoInventarios, costoVentasAnuales] = await Promise.all([
      certificationService.saldoClienteCuentaXCobrar(id_certification),
      certificationService.ventasAnuales(id_certification),
      certificationService.saldoInventarios(id_certification),
      certificationService.costoVentasAnuales(id_certification)
    ])

    if (!saldoClienteCuentaXCobrar || !ventasAnuales || !saldoInventarios || !costoVentasAnuales) {
      return { error: true }
    }

    if (parseFloat(ventasAnuales.ventas_anuales) === 0) {
      noDso = true
    } else {
      dso = (parseFloat(saldoClienteCuentaXCobrar.saldo_cliente_cuenta_x_cobrar) / parseFloat(ventasAnuales.ventas_anuales)) * 360
      dsoMayor90 = dso >= 90
    }

    if (parseFloat(costoVentasAnuales.costo_ventas_anuales) === 0) {
      noDio = true
    } else {
      dio = (parseFloat(saldoInventarios.saldo_inventarios) / parseFloat(costoVentasAnuales.costo_ventas_anuales)) * 360
      dioMayor90 = dio >= 90
    }

    let rotacionRules = parametrosAlgoritmo.rotacionCtasXCobrarScore

    if (!Array.isArray(rotacionRules) || rotacionRules.length === 0) {
      const rangosBD = await algorithmService.getGeneralSummary()
      rotacionRules = rangosBD.rotacionCtasXCobrarScore || []
    }

    let rotScoreDio = null
    let rotScoreDso = null
    let bestScoreDio = null
    let bestScoreDso = null
    let metricUsed = null
    const lines = []
    const formatNum = n =>
      isNaN(Number(n))
        ? '-'
        : Number(n).toLocaleString('es-MX', { maximumFractionDigits: 2 })

    // Evaluamos rangos para DIO buscando el mejor puntaje
    if (!noDio) {
      for (const r of rotacionRules) {
        if (!r.nombre || r.nombre.toLowerCase().includes('desconocido')) continue
        const sup = r.limite_superior == null || isNaN(Number(r.limite_superior)) ? Infinity : Number(r.limite_superior)
        const inf = r.limite_inferior == null || isNaN(Number(r.limite_inferior)) ? -Infinity : Number(r.limite_inferior)
        const limInf = formatNum(inf)
        const limSup = formatNum(sup)
        const candidateScore = Number(algoritmo_v?.v_alritmo) === 2 ? Number(r.v2) : Number(r.v1)
        if (dio >= inf && dio <= sup) {
          if (bestScoreDio == null || candidateScore > bestScoreDio) {
            bestScoreDio = candidateScore
            rotScoreDio = r
          }
        }
        if (dio < inf) lines.push(`DIO = ${formatNum(dio)}: No entra en rango [${limInf} - ${limSup}] porque está por debajo del límite.`)
        else if (dio > sup) lines.push(`DIO = ${formatNum(dio)}: No entra en rango [${limInf} - ${limSup}] porque está por encima del límite.`)
      }
      if (rotScoreDio) {
        const sup = rotScoreDio.limite_superior == null || isNaN(Number(rotScoreDio.limite_superior)) ? Infinity : Number(rotScoreDio.limite_superior)
        const inf = rotScoreDio.limite_inferior == null || isNaN(Number(rotScoreDio.limite_inferior)) ? -Infinity : Number(rotScoreDio.limite_inferior)
        lines.push(`DIO = ${formatNum(dio)} entra en rango [${formatNum(inf)} a ${formatNum(sup)}] → Score: ${bestScoreDio}`)
      }
    }

    // Evaluamos rangos para DSO buscando el mejor puntaje
    if (!noDso) {
      for (const r of rotacionRules) {
        if (!r.nombre || r.nombre.toLowerCase().includes('desconocido')) continue
        const sup = r.limite_superior == null || isNaN(Number(r.limite_superior)) ? Infinity : Number(r.limite_superior)
        const inf = r.limite_inferior == null || isNaN(Number(r.limite_inferior)) ? -Infinity : Number(r.limite_inferior)
        const limInf = formatNum(inf)
        const limSup = formatNum(sup)
        const candidateScore = Number(algoritmo_v?.v_alritmo) === 2 ? Number(r.v2) : Number(r.v1)
        if (dso >= inf && dso <= sup) {
          if (bestScoreDso == null || candidateScore > bestScoreDso) {
            bestScoreDso = candidateScore
            rotScoreDso = r
          }
        }
        if (dso < inf) lines.push(`DSO = ${formatNum(dso)}: No entra en rango [${limInf} - ${limSup}] porque está por debajo del límite.`)
        else if (dso > sup) lines.push(`DSO = ${formatNum(dso)}: No entra en rango [${limInf} - ${limSup}] porque está por encima del límite.`)
      }
      if (rotScoreDso) {
        const sup = rotScoreDso.limite_superior == null || isNaN(Number(rotScoreDso.limite_superior)) ? Infinity : Number(rotScoreDso.limite_superior)
        const inf = rotScoreDso.limite_inferior == null || isNaN(Number(rotScoreDso.limite_inferior)) ? -Infinity : Number(rotScoreDso.limite_inferior)
        lines.push(`DSO = ${formatNum(dso)} entra en rango [${formatNum(inf)} a ${formatNum(sup)}] → Score: ${bestScoreDso}`)
      }
    }
    if (!rotScoreDso) {
      const ruleName = noDso ? 'no reportar saldo en clientes' : 'no reportar saldo en clientes'
      rotScoreDso = rotacionRules.find(r => r.nombre?.toLowerCase().includes(ruleName)) || rotacionRules.find(r => r.nombre?.toLowerCase().includes('no reportar ambos')) || rotacionRules.find(r => r.nombre?.toLowerCase().includes('desconocido'))
      if (noDso) lines.push('DSO sin datos suficientes, se aplica regla de no reportar saldo en clientes.')
      bestScoreDso = Number(algoritmo_v?.v_alritmo) === 2 ? Number(rotScoreDso?.v2) : Number(rotScoreDso?.v1)
    }

    if (!rotScoreDio) {
      const ruleName = noDio ? 'no reportar saldo en inventarios' : 'no reportar saldo en inventarios'
      rotScoreDio = rotacionRules.find(r => r.nombre?.toLowerCase().includes(ruleName)) || rotacionRules.find(r => r.nombre?.toLowerCase().includes('no reportar ambos')) || rotacionRules.find(r => r.nombre?.toLowerCase().includes('desconocido'))
      if (noDio) lines.push('DIO sin datos suficientes, se aplica regla de no reportar saldo en inventarios.')
      bestScoreDio = Number(algoritmo_v?.v_alritmo) === 2 ? Number(rotScoreDio?.v2) : Number(rotScoreDio?.v1)
    }

    if (!rotScoreDio || !rotScoreDso) return { error: true }

    const scoreDio =
      bestScoreDio != null
        ? bestScoreDio
        : Number(algoritmo_v?.v_alritmo) === 2
          ? Number(rotScoreDio.v2)
          : Number(rotScoreDio.v1)
    const scoreDso =
      bestScoreDso != null
        ? bestScoreDso
        : Number(algoritmo_v?.v_alritmo) === 2
          ? Number(rotScoreDso.v2)
          : Number(rotScoreDso.v1)
    const score = Math.max(scoreDio, scoreDso)
    const metricScoreUsed = scoreDio >= scoreDso ? 'DIO' : 'DSO'

    metricUsed = { tipo: 'DIO/DSO', valor: `DIO=${formatNum(dio)}, DSO=${formatNum(dso)}` }

    return {
      score,
      scoreDio,
      scoreDso,
      descripcionDio: rotScoreDio.nombre,
      descripcionDso: rotScoreDso.nombre,
      saldo_cliente_cuenta_x_cobrar: saldoClienteCuentaXCobrar.saldo_cliente_cuenta_x_cobrar,
      ventas_anuales: ventasAnuales.ventas_anuales,
      saldo_inventarios: saldoInventarios.saldo_inventarios,
      costo_ventas_anuales: costoVentasAnuales.costo_ventas_anuales,
      tipo: saldoClienteCuentaXCobrar.tipo,
      dso,
      dio,
      limite_inferior_dio: rotScoreDio.limite_inferior,
      limite_superior_dio: rotScoreDio.limite_superior,
      limite_inferior_dso: rotScoreDso.limite_inferior,
      limite_superior_dso: rotScoreDso.limite_superior,
      limite_inferior: rotScoreDio.limite_inferior,
      limite_superior: rotScoreDio.limite_superior,
      periodo_actual: saldoClienteCuentaXCobrar.periodo_actual,
      periodo_anterior: saldoClienteCuentaXCobrar.periodo_anterior,
      periodo_previo_anterior: saldoClienteCuentaXCobrar.periodo_previo_anterior,
      dsoMayor90,
      dioMayor90,
      explicacion: lines.join('\n'),
      metricUsed,
      metricScoreUsed
    }
  } catch (error) {
    logger.error(`${fileMethod} | ${customUuid} Error general: ${JSON.stringify(error)}`)
    return { error: true }
  }
}


const getScoreReferenciasComercialesFromSummary = async (
  id_certification,
  algoritmo_v,
  parametrosAlgoritmo,
  customUuid
) => {
  const fileMethod =
    `file: src/controllers/api/certification.js - method: getScoreReferenciasComercialesFromSummary`
  try {
    const referencias = await certificationService.getReferenciasComercialesByIdCertificationScore(id_certification);
    if (!referencias) return { error: true };

    const reglas = parametrosAlgoritmo.referenciasProveedoresScore;
    const scoreField = algoritmo_v === 2 && reglas.find(r => r.id === 1)?.has_v2 ? 'v2' : 'v1';

    const reglaSinReferencias = reglas.find(r => r.id === 6);
    if (referencias.length === 0) {
      return {
        score: parseInt(reglaSinReferencias[scoreField]),
        descripcion: reglaSinReferencias.nombre,
      };
    }

    const punishmentScores = [];
    let goodRefsCount = 0;

    const reglaMuyMalas = reglas.find(r => r.id === 4);
    const reglaMalas = reglas.find(r => r.id === 5);

    for (const ref of referencias) {
      if (ref.calificacion_referencia === 'buena') {
        goodRefsCount++;
      } else if (ref.calificacion_referencia === 'mala' || ref.calificacion_referencia === 'regular') {
        // La regla 4 (muy malas) es específica: >90 días de atraso Y >20% de deuda
        if (ref.dias_atraso > 90 && ref.porcentaje_deuda > 20) {
          punishmentScores.push(parseInt(reglaMuyMalas[scoreField]));
        } else {
          punishmentScores.push(parseInt(reglaMalas[scoreField]));
        }
      }
    }

    // Si hay castigos, se aplica el peor de todos (el valor más bajo)
    if (punishmentScores.length > 0) {
      const minScore = Math.min(...punishmentScores);
      const finalRule = minScore === parseInt(reglaMuyMalas[scoreField]) ? reglaMuyMalas : reglaMalas;
      return {
        score: minScore,
        descripcion: finalRule.nombre,
      };
    }

    // Si no hay castigos, se califica según las referencias buenas
    const reglaBuenas4 = reglas.find(r => r.id === 1);
    const reglaBuenas2_3 = reglas.find(r => r.id === 2);
    const reglaBuenas1 = reglas.find(r => r.id === 3);
    
    if (goodRefsCount >= 4) {
      return {
        score: parseInt(reglaBuenas4[scoreField]),
        descripcion: reglaBuenas4.nombre,
      };
    }
    if (goodRefsCount >= 2) { // Cubre los casos de 2 y 3
      return {
        score: parseInt(reglaBuenas2_3[scoreField]),
        descripcion: reglaBuenas2_3.nombre,
      };
    }
    if (goodRefsCount === 1) {
      return {
        score: parseInt(reglaBuenas1[scoreField]),
        descripcion: reglaBuenas1.nombre,
      };
    }

    // Si llegamos aquí, es porque hay referencias pero ninguna fue 'buena', 'mala' o 'regular'.
    // Esto corresponde a la regla 6: "No se obtuvo ningún proveedor..."
    return {
      score: parseInt(reglaSinReferencias[scoreField]),
      descripcion: reglaSinReferencias.nombre,
    };

  } catch (error) {
    logger.error(`${fileMethod} - ${customUuid} - catch: ${error}`)
    return { error: true, score: 0 }
  }
}

const buildCapitalContableReport = (capitalContable, algoritmo_v, fileMethod, customUuid) => {
  if (capitalContable.error) {
    logger.info(`${fileMethod} | ${customUuid} No se pudo obtener información para obtener capital contable en la certificación con ID: ${JSON.stringify(capitalContable)}`)
    logger.info(`${fileMethod} | ${customUuid} Se asigna score 0 para version 2 de algoritmo `)
    return {
      descripcion:
        Number(algoritmo_v?.v_alritmo) === 2 ? 'algoritmo v2' : 'algoritmo v1',
      score: '0',
      parametro: 'null',
      limite_inferior: 'null',
      limite_superior: 'null'
    }
  }

  logger.info(`${fileMethod} | ${customUuid} El capital contable para el algoritmo es: ${JSON.stringify(capitalContable)}`)

  if (Number(algoritmo_v?.v_alritmo) === 2) {
    return {
      descripcion: 'version 2 algoritmo',
      score: '0',
      parametro: 0.0,
      limite_inferior: 0,
      limite_superior: 0
    }
  }

  return {
    descripcion: capitalContable.descripcion,
    score: capitalContable.score,
    parametro: capitalContable.capital_contable_estado_balance_PA,
    limite_inferior: capitalContable.limite_inferior ?? 'null',
    limite_superior: capitalContable.limite_superior ?? 'null'
  }
}

const getScorePayback = async (id_certification, customUuid) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: getScorePayback`
  try {
    let score = null

    const [deudaCortoPlazo, utilidadOperativa] = await Promise.all([
      certificationService.deudaCortoPlazo(id_certification),
      certificationService.utilidadOperativa(id_certification)
    ])

    if (!deudaCortoPlazo || deudaCortoPlazo.length === 0 || !utilidadOperativa || utilidadOperativa.length === 0) {
      logger.warn(`${fileMethod} | ${customUuid} No se ha podido obtener la deuda a corto plazo o la utilidad operativa: ${JSON.stringify({ deudaCortoPlazo, utilidadOperativa })}`)
      return { error: true }
    }

    logger.info(`${fileMethod} | ${customUuid} La deuda a corto plazo de la certificación con ID : ${id_certification} es: ${JSON.stringify(deudaCortoPlazo)}`)
    logger.info(`${fileMethod} | ${customUuid} La utilidad operativa de la certificación con ID : ${id_certification} es: ${JSON.stringify(utilidadOperativa)}`)

    if (utilidadOperativa.utilidad_operativa == 0) score = 'N/A'

    const parseNumber = require('../../utils/number')
    const payback =
      parseNumber(deudaCortoPlazo.deuda_corto_plazo) /
      parseNumber(utilidadOperativa.utilidad_operativa)
    const roundedPayback = Number.isFinite(payback) ? Number(payback.toFixed(2)) : payback
    const getScore = await certificationService.getScorePayback(roundedPayback)
    if (!getScore || getScore.length === 0) {
      logger.warn(`${fileMethod} | ${customUuid} No se ha podido obtener el escore de payback: ${JSON.stringify(payback)}`)
      return { error: true }
    }

    logger.info(`${fileMethod} | ${customUuid} La información del score de payback de certificación con ID : ${id_certification} es: ${JSON.stringify(getScore)}`)

    const result = {
      score: score == null ? getScore.valor_algoritmo : score,
      deuda_corto_plazo_periodo_anterior: deudaCortoPlazo.deuda_corto_plazo,
      periodo_actual: deudaCortoPlazo.periodo_actual,
      periodo_anterior: deudaCortoPlazo.periodo_anterior,
      periodo_previo_anterior: deudaCortoPlazo.periodo_previo_anterior,
      utilida_operativa: utilidadOperativa.utilidad_operativa,
      payback: roundedPayback,
      descripcion: getScore.nombre,
      limite_inferior: getScore.limite_inferior,
      limite_superior: getScore.limite_superior
    }

    logger.info(`${fileMethod} | ${customUuid} La información para el score de payback es: ${JSON.stringify(result)}`)

    return result
  } catch (error) {
    logger.error(`${fileMethod} | ${customUuid} Error general: ${JSON.stringify(error)}`)
    return { error: true }
  }
}

const getScoreRotacionCtasXCobrasScore = async (id_certification, customUuid) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: getScoreRotacionCtasXCobrasScore`
  try {
    let noDso = false
    let noDio = false
    let dso = 0
    let dio = 0
    let dsoMayor90 = false
    let dioMayor90 = false

    const [saldoClienteCuentaXCobrar, ventasAnuales, saldoInventarios, costoVentasAnuales] = await Promise.all([
      certificationService.saldoClienteCuentaXCobrar(id_certification),
      certificationService.ventasAnuales(id_certification),
      certificationService.saldoInventarios(id_certification),
      certificationService.costoVentasAnuales(id_certification)
    ])

    if (!saldoClienteCuentaXCobrar || !ventasAnuales || !saldoInventarios || !costoVentasAnuales) {
      logger.warn(`${fileMethod} | ${customUuid} No se pudo obtener información para calcular rotación: ${JSON.stringify({ saldoClienteCuentaXCobrar, ventasAnuales, saldoInventarios, costoVentasAnuales })}`)
      return { error: true }
    }

    if (parseFloat(ventasAnuales.ventas_anuales) === 0) {
      noDso = true
    } else {
      dso = (parseFloat(saldoClienteCuentaXCobrar.saldo_cliente_cuenta_x_cobrar) / parseFloat(ventasAnuales.ventas_anuales)) * 360
      dsoMayor90 = dso >= 90
    }

    if (parseFloat(costoVentasAnuales.costo_ventas_anuales) === 0) {
      noDio = true
    } else {
      dio = (parseFloat(saldoInventarios.saldo_inventarios) / parseFloat(costoVentasAnuales.costo_ventas_anuales)) * 360
      dioMayor90 = dio >= 90
    }

    const parametrosAlgoritmo = await algorithmService.getGeneralSummary()
    let rotacionRules = parametrosAlgoritmo.rotacionCtasXCobrarScore || []

    const lines = []
    const formatNum = n => isNaN(Number(n)) ? '-' : Number(n).toLocaleString('es-MX', { maximumFractionDigits: 2 })
    let rotScoreDio = null
    let rotScoreDso = null
    let bestScoreDio = null
    let bestScoreDso = null
    // Evaluar ambos indicadores (DSO y DIO) por separado.
    // Obtener el score de cada uno con base en los parámetros dinámicos.
    // NO se deben sumar los scores.
    // Debe seleccionarse y retornarse el score más alto (más positivo) entre los dos.
    // Esta lógica es para evitar castigos excesivos si al menos uno de los indicadores es favorable.

    if (!noDio) {
      for (const r of rotacionRules) {
        if (!r.nombre || r.nombre.toLowerCase().includes('desconocido')) continue
        const sup = r.limite_superior == null || isNaN(Number(r.limite_superior)) ? Infinity : Number(r.limite_superior)
        const inf = r.limite_inferior == null || isNaN(Number(r.limite_inferior)) ? -Infinity : Number(r.limite_inferior)
        const limInf = formatNum(inf)
        const limSup = formatNum(sup)
        const candidateScore = Number(r.v1)
        if (dio >= inf && dio <= sup) {
          if (bestScoreDio == null || candidateScore > bestScoreDio) {
            bestScoreDio = candidateScore
            rotScoreDio = r
          }
        }
        if (dio < inf) lines.push(`DIO = ${formatNum(dio)}: No entra en rango [${limInf} - ${limSup}] porque está por debajo del límite.`)
        else if (dio > sup) lines.push(`DIO = ${formatNum(dio)}: No entra en rango [${limInf} - ${limSup}] porque está por encima del límite.`)
      }
      if (rotScoreDio) {
        const sup = rotScoreDio.limite_superior == null || isNaN(Number(rotScoreDio.limite_superior)) ? Infinity : Number(rotScoreDio.limite_superior)
        const inf = rotScoreDio.limite_inferior == null || isNaN(Number(rotScoreDio.limite_inferior)) ? -Infinity : Number(rotScoreDio.limite_inferior)
        lines.push(`DIO = ${formatNum(dio)} entra en rango [${formatNum(inf)} a ${formatNum(sup)}] → Score: ${bestScoreDio}`)
      }
    }
    if (!rotScoreDio) {
      rotScoreDio = rotacionRules.find(r => r.nombre?.toLowerCase().includes('no reportar saldo en inventarios')) || rotacionRules.find(r => r.nombre?.toLowerCase().includes('no reportar ambos')) || rotacionRules.find(r => r.nombre?.toLowerCase().includes('desconocido'))
      if (noDio) lines.push('DIO sin datos suficientes, se aplica regla de no reportar saldo en inventarios.')
      bestScoreDio = Number(rotScoreDio?.v1)
    }

    if (!noDso) {
      for (const r of rotacionRules) {
        if (!r.nombre || r.nombre.toLowerCase().includes('desconocido')) continue
        const sup = r.limite_superior == null || isNaN(Number(r.limite_superior)) ? Infinity : Number(r.limite_superior)
        const inf = r.limite_inferior == null || isNaN(Number(r.limite_inferior)) ? -Infinity : Number(r.limite_inferior)
        const limInf = formatNum(inf)
        const limSup = formatNum(sup)
        const candidateScore = Number(r.v1)
        if (dso >= inf && dso <= sup) {
          if (bestScoreDso == null || candidateScore > bestScoreDso) {
            bestScoreDso = candidateScore
            rotScoreDso = r
          }
        }
        if (dso < inf) lines.push(`DSO = ${formatNum(dso)}: No entra en rango [${limInf} - ${limSup}] porque está por debajo del límite.`)
        else if (dso > sup) lines.push(`DSO = ${formatNum(dso)}: No entra en rango [${limInf} - ${limSup}] porque está por encima del límite.`)
      }
      if (rotScoreDso) {
        const sup = rotScoreDso.limite_superior == null || isNaN(Number(rotScoreDso.limite_superior)) ? Infinity : Number(rotScoreDso.limite_superior)
        const inf = rotScoreDso.limite_inferior == null || isNaN(Number(rotScoreDso.limite_inferior)) ? -Infinity : Number(rotScoreDso.limite_inferior)
        lines.push(`DSO = ${formatNum(dso)} entra en rango [${formatNum(inf)} a ${formatNum(sup)}] → Score: ${bestScoreDso}`)
      }
    }
    if (!rotScoreDso) {
      rotScoreDso = rotacionRules.find(r => r.nombre?.toLowerCase().includes('no reportar saldo en clientes')) || rotacionRules.find(r => r.nombre?.toLowerCase().includes('no reportar ambos')) || rotacionRules.find(r => r.nombre?.toLowerCase().includes('desconocido'))
      if (noDso) lines.push('DSO sin datos suficientes, se aplica regla de no reportar saldo en clientes.')
      bestScoreDso = Number(rotScoreDso?.v1)
    }

    if (!rotScoreDio || !rotScoreDso) return { error: true }

    const scoreDio = bestScoreDio != null ? bestScoreDio : Number(rotScoreDio.v1)
    const scoreDso = bestScoreDso != null ? bestScoreDso : Number(rotScoreDso.v1)
    const score = Math.max(scoreDio, scoreDso)
    const metricScoreUsed = scoreDio >= scoreDso ? 'DIO' : 'DSO'

    return {
      score,
      scoreDio,
      scoreDso,
      descripcionDio: rotScoreDio.nombre,
      descripcionDso: rotScoreDso.nombre,
      saldo_cliente_cuenta_x_cobrar: saldoClienteCuentaXCobrar.saldo_cliente_cuenta_x_cobrar,
      tipo: saldoClienteCuentaXCobrar.tipo,
      dso,
      dio,
      limite_inferior_dio: rotScoreDio.limite_inferior,
      limite_superior_dio: rotScoreDio.limite_superior,
      limite_inferior_dso: rotScoreDso.limite_inferior,
      limite_superior_dso: rotScoreDso.limite_superior,
      limite_inferior: rotScoreDio.limite_inferior,
      limite_superior: rotScoreDio.limite_superior,
      periodo_actual: saldoClienteCuentaXCobrar.periodo_actual,
      periodo_anterior: saldoClienteCuentaXCobrar.periodo_anterior,
      periodo_previo_anterior: saldoClienteCuentaXCobrar.periodo_previo_anterior,
      dsoMayor90,
      dioMayor90,
      explicacion: lines.join('\n'),
      metricUsed: { tipo: 'DIO/DSO', valor: `DIO=${formatNum(dio)}, DSO=${formatNum(dso)}` },
      metricScoreUsed
    }
  } catch (error) {
    logger.error(`${fileMethod} | ${customUuid} Error general: ${JSON.stringify(error)}`)
    return { error: true }
  }
}

const getScoreReferenciasComerciales = async (id_certification, algoritmo_v, customUuid) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: getScoreReferenciasComerciales`
  try {
    const parametrosAlgoritmo = {
      referenciasProveedoresScore: Object.values(referenciasCatalogo).map(r => ({
        id: r.id_cat_resultado_referencias_proveedores,
        nombre: r.nombre,
        v1: r.valor_algoritmo,
        v2: r.valor_algoritmo_v2
      }))
    }
    return await getScoreReferenciasComercialesFromSummary(
      id_certification,
      algoritmo_v,
      parametrosAlgoritmo,
      customUuid
    )
  } catch (error) {
    logger.error(`${fileMethod} | ${customUuid} Error general: ${error}`)
    return {
      error: true
    }
  }
}

const getScoreIncidenciasLegales = async (id_certification, algoritmo_v, customUuid) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: getScoreIncidenciasLegales`
  try {
    let ninguna = false
    let respuesta = {}
    const incidencias_legales = await certificationService.getDemandas(id_certification)
    if (!incidencias_legales.result || incidencias_legales.result.length == 0) {
      ninguna = true
      logger.warn(`${fileMethod} | ${customUuid} No se han podido obtener incidencias legales: ${JSON.stringify(incidencias_legales)}`)
    }

    logger.info(`${fileMethod} | ${customUuid} Incidencias legales obtenidas: ${JSON.stringify(incidencias_legales)}`)

    let _2incidenciaMercantilUnAnio = false
    let incidenciaPenal = false
    let _1incidenciaMercantilUnAnio = false

    let countIncMerc = 0
    let tipo = null
    let fecha = null

    if (incidencias_legales.result.length > 0) {
      for (let i in incidencias_legales.result) {
        tipo = incidencias_legales.result[i].tipo_demanda
        fecha = incidencias_legales.result[i].fecha_demanda

        if (tipo === 'mercantil') {
          const fechaActual = new Date()
          const diferenciaEnDias = (fechaActual - new Date(fecha)) / (1000 * 60 * 60 * 24)
          if (diferenciaEnDias <= 365) {
            countIncMerc++
            if (countIncMerc == 1) {
              _1incidenciaMercantilUnAnio = true
              _2incidenciaMercantilUnAnio = false
              incidenciaPenal = false
            }
            if (countIncMerc == 2) {
              _2incidenciaMercantilUnAnio = true
              _1incidenciaMercantilUnAnio = false
              incidenciaPenal = false
            }
          }
        } else if (tipo === 'penal') {
          incidenciaPenal = true
          _1incidenciaMercantilUnAnio = false
          _2incidenciaMercantilUnAnio = false
        }
      }
    } else {
      const getScore = await certificationService.getScoreIncidenciasLegales('NINGUNA', algoritmo_v)
      respuesta = {
        score: getScore ? getScore.valor_algoritmo : '0',
        tipo: null,
        fecha: null,
        caso: getScore ? getScore.nombre : 'NINGUNA'
      }
      logger.info(`${fileMethod} | ${customUuid} Incidencias legales obtenidas: ${JSON.stringify(respuesta)}`)
      return respuesta
    }

    if (countIncMerc == 0 && !incidenciaPenal) {
      const getScore = await certificationService.getScoreIncidenciasLegales('NINGUNA', algoritmo_v)
      respuesta = {
        score: getScore ? getScore.valor_algoritmo : '0',
        tipo: null,
        fecha: null,
        caso: getScore ? getScore.nombre : 'NINGUNA'
      }
      logger.info(`${fileMethod} | ${customUuid} Incidencias legales obtenidas: ${JSON.stringify(respuesta)}`)
      return respuesta
    }

    if (incidenciaPenal) {
      const getScore = await certificationService.getScoreIncidenciasLegales('>= 1 INCIDENCIA PENAL ( no importando el año)', algoritmo_v)
      respuesta = {
        score: getScore ? getScore.valor_algoritmo : '-250',
        tipo: tipo,
        fecha: fecha,
        caso: getScore ? getScore.nombre : '>= 1 INCIDENCIA PENAL ( no importando el año)'
      }
      logger.info(`${fileMethod} | ${customUuid} >= 1 INCIDENCIA PENAL ( no importando el año) ${JSON.stringify(respuesta)}`)
      return respuesta
    }

    if (_1incidenciaMercantilUnAnio) {
      const getScore = await certificationService.getScoreIncidenciasLegales('1 INCIDENCIA MERCANTIL <= 1 AÑO', algoritmo_v)
      respuesta = {
        score: getScore ? getScore.valor_algoritmo : Number(algoritmo_v?.v_alritmo) === 2 ? '-40' : '-50',
        tipo: tipo,
        fecha: fecha,
        caso: getScore ? getScore.nombre : '1 INCIDENCIA MERCANTIL <= 1 AÑO'
      }
      logger.info(`${fileMethod} | ${customUuid} 1 INCIDENCIA MERCANTIL <= 1 AÑO ${JSON.stringify(respuesta)}`)
      return respuesta
    }

    if (_2incidenciaMercantilUnAnio) {
      const getScore = await certificationService.getScoreIncidenciasLegales('2 INCIDENCIAS MERCANTILES <= 1 AÑO', algoritmo_v)
      respuesta = {
        score: getScore ? getScore.valor_algoritmo : '-200',
        tipo: tipo,
        fecha: fecha,
        caso: getScore ? getScore.nombre : '2 INCIDENCIAS MERCANTILES <= 1 AÑO'
      }
      logger.info(`${fileMethod} | ${customUuid} 2 INCIDENCIAS MERCANTILES <= 1 AÑO ${JSON.stringify(respuesta)}`)
      return respuesta
    }
  } catch (error) {
    logger.error(`${fileMethod} | ${customUuid} Error general: ${JSON.stringify(error)}`)
    return {
      error: true
    }
  }
}

const getScoreTipoCifras = async (id_certification, customUuid) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: getScoreTipoCifras`
  try {
    const getTipoCifra = await certificationService.getTipoCifra(id_certification)
    if (!getTipoCifra || getTipoCifra.length == 0) {
      logger.warn(`${fileMethod} | ${customUuid} No se ha podido obtener el tipo de cifra: ${JSON.stringify(getTipoCifra)}`)
      return {
        error: true
      }
    }

    logger.info(`${fileMethod} | ${customUuid} El tipo de cifra para certificación con ID : ${id_certification} es: ${JSON.stringify(getTipoCifra)}`)

    const getScore = await certificationService.getScoreTipoCifra(getTipoCifra)
    if (getScore.length == 0 || !getScore) {
      logger.warn(`${fileMethod} | ${customUuid} No se ha podido obtener el score de tipo cifra: ${JSON.stringify(getScore)}`)
      return {
        error: true
      }
    }

    logger.info(`${fileMethod} | ${customUuid} El score para tipo cifra de certificación con ID : ${id_certification} es: ${JSON.stringify(getScore)}`)

    logger.info(`${fileMethod} | ${customUuid} La información para el score de tipo cifras es: ${JSON.stringify({
      id_tipo_cifra: getTipoCifra,
      descripcion: getScore.nombre,
      score: getScore.valor_algoritmo
    })}`)

    return {
      id_tipo_cifra: getTipoCifra,
      descripcion: getScore.nombre,
      score: getScore.valor_algoritmo
    }
  } catch (error) {
    logger.error(`${fileMethod} | ${customUuid} Error general: ${JSON.stringify(error)}`)
    return {
      error: true
    }
  }
}

const getAlertaPromedioPlazoCredito = async (id_certification, customUuid) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: getAlertaPromedioPlazoCredito`
  try {
    let sum = 0
    let acum = 0
    let dias = 0

    const plazo_credito = await certificationService.getPlazoCredito(id_certification)
    if (plazo_credito.length == 0 || !plazo_credito) {
      logger.warn(`${fileMethod} | ${customUuid} No se ha podido obtener plazo de credito: ${JSON.stringify(plazo_credito)}`)
      return {
        error: true
      }
    }

    logger.info(`${fileMethod} | ${customUuid} Los plazos de credito de proveedores son: ${JSON.stringify(plazo_credito)}`)

    for (let i in plazo_credito) {
      if (!isNaN(plazo_credito[i].plazo)) {
        acum++
        sum += parseFloat(plazo_credito[i].plazo)
      }
    }

    dias = sum / acum

    if (isNaN(dias)) {
      return {
        error: true
      }
    }

    logger.info(`${fileMethod} | ${customUuid} Promedio de plazos:  ${JSON.stringify({
      dias: dias,
      texto_reporte: 'DE ACUERDO A NUESTRAS BASES DE  INFORMACIÓN, LA EMPRESA MANTIENE  LINEAS DE CRÉDITO VISIBLES  CON EL SIGUIENTE  PLAZO DE CRÉDITO (DSO) PROMEDIO, POR LO QUE  LO QUE RECOMENDAMOS  NO EXCEDER + DE 7 DÍAS NATURALES ADICIONALES A ESTE PLAZO DE CRÉDITO.'
    })}`)

    return {
      dias: dias,
      texto_reporte: 'DE ACUERDO A NUESTRAS BASES DE  INFORMACIÓN, LA EMPRESA MANTIENE  LINEAS DE CRÉDITO VISIBLES  CON EL SIGUIENTE  PLAZO DE CRÉDITO (DSO) PROMEDIO, POR LO QUE  LO QUE RECOMENDAMOS  NO EXCEDER + DE 7 DÍAS NATURALES ADICIONALES A ESTE PLAZO DE CRÉDITO.'
    }
  } catch (error) {
    logger.error(`${fileMethod} | ${customUuid} Error general: ${JSON.stringify(error)}`)
    return {
      error: true
    }
  }
}

const getAlertaEndeudamientoComercial = async (id_certification, customUuid) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: getAlertaEndeudamientoComercial`
  try {
    const getCostoVentasAnualesPPAAlert = await certificationService.getCostoVentasAnualesPPAAlert(id_certification)
    if (!getCostoVentasAnualesPPAAlert || getCostoVentasAnualesPPAAlert.length == 0) {
      logger.warn(`${fileMethod} | ${customUuid} No se ha podido obtener el costo anual de ventas del periodo previo anterior: ${JSON.stringify(getCostoVentasAnualesPPAAlert)}`)
      return {
        error: true
      }
    }

    logger.info(`${fileMethod} | ${customUuid} El costo de ventas anuales del periodo previo anterior es: ${JSON.stringify(getCostoVentasAnualesPPAAlert)}`)

    const getCostoVentasAnualesPAAlert = await certificationService.getCostoVentasAnualesPAAlert(id_certification)
    if (getCostoVentasAnualesPAAlert.length == 0 || !getCostoVentasAnualesPAAlert) {
      logger.warn(`${fileMethod} | ${customUuid} No se ha podido obtener el costo anual de ventas del periodo anterior: ${JSON.stringify(getCostoVentasAnualesPAAlert)}`)
      return {
        error: true
      }
    }

    logger.info(`${fileMethod} | ${customUuid} El costo de ventas anuales del periodo anterior es: ${JSON.stringify(getCostoVentasAnualesPAAlert)}`)

    let numerador = 0;
    const lineas_credito = await certificationService.getLineasCredito(id_certification)
    if (lineas_credito.length == 0 || !lineas_credito) {
      logger.warn(`${fileMethod} | ${customUuid} No se ha podido obtener lineas de credito: ${JSON.stringify(lineas_credito)}`)
      return {
        error: true
      }
    }

    logger.info(`${fileMethod} | ${customUuid} Las lineas de credito de proveedores son: ${JSON.stringify(lineas_credito)}`)

    for (let i in lineas_credito) {
      if (!isNaN(lineas_credito[i].linea_credito)) {
        numerador += parseFloat(lineas_credito[i].linea_credito)
      }
    }

    const denominador = (parseFloat(getCostoVentasAnualesPAAlert.costo_ventas_anuales) + (parseFloat(getCostoVentasAnualesPPAAlert.costo_ventas_anuales) / 2)) / 3

    if (denominador == 0 || numerador == 0 || isNaN(numerador)) {
      logger.warn(`${fileMethod} | ${customUuid} El denominador es cero y no se puede realizar calculo de alerta de endeudamiento comercial ${JSON.stringify(denominador)}`)
      return {
        error: true
      }
    }

    const cociente = numerador / denominador

    if (cociente > 100) {
      logger.warn(`${fileMethod} | ${customUuid} extremadamente endeudado  ${JSON.stringify(cociente)}`)
      return {
        porcentaje: 100,
        descripcion: 'Endeudamiento al límite en relación a tamaño de preveeduria',
        texto_reporte: 'DE ACUERDO A NUESTRAS BASES DE  INFORMACIÓN. LA EMPRESA SE SITUA EN EL  SIGUIENTE NIVEL DE ENDEUDAMIENTO COMERCIAL ( TOTAL LINEAS DE CRÉDITO VISIBLES OTORGADAS POR PROVEEDORES  EN RELACIÓN A LA FACTURACIÓN TOTAL ANUAL REVOLVENTE  DE TODOS  SUS PROVEEDORES)'
      }
    }

    const endeudamiento_comercial = await certificationService.getRangoEndeudamiento(cociente)

    logger.info(`${fileMethod} | ${customUuid} Endeudamiento:  ${JSON.stringify({
      porcentaje: cociente,
      descripcion: endeudamiento_comercial.nombre,
      texto_reporte: 'DE ACUERDO A NUESTRAS BASES DE  INFORMACIÓN. LA EMPRESA SE SITUA EN EL  SIGUIENTE NIVEL DE ENDEUDAMIENTO COMERCIAL ( TOTAL LINEAS DE CRÉDITO VISIBLES OTORGADAS POR PROVEEDORES  EN RELACIÓN A LA FACTURACIÓN TOTAL ANUAL REVOLVENTE  DE TODOS  SUS PROVEEDORES)'
    })}`)

    return {
      porcentaje: cociente,
      descripcion: endeudamiento_comercial.nombre,
      texto_reporte: 'DE ACUERDO A NUESTRAS BASES DE  INFORMACIÓN. LA EMPRESA SE SITUA EN EL  SIGUIENTE NIVEL DE ENDEUDAMIENTO COMERCIAL ( TOTAL LINEAS DE CRÉDITO VISIBLES OTORGADAS POR PROVEEDORES  EN RELACIÓN A LA FACTURACIÓN TOTAL ANUAL REVOLVENTE  DE TODOS  SUS PROVEEDORES)'
    }
  } catch (error) {
    logger.error(`${fileMethod} | ${customUuid} Error general: ${JSON.stringify(error)}`)
    return {
      error: true
    }
  }
}

const checkInfoAlgoritmo = async (req, res, next) => {
  try {

    const { id_certification } = req.params

    const datosBasicos = await certificationService.getDatosBasicosEmpty(id_certification)
    const estadoBalance = await certificationService.getEstadoBalanceEmpty(id_certification)
    const estadoResultado = await certificationService.getEstadoResultadoEmpty(id_certification)

    const datosBasicosCompleto = datosBasicos.result.length > 0 && datosBasicos.result[0].completo === 1
    const estadoBalanceCompleto = estadoBalance.result.length > 0 && estadoBalance.result[0].completo === 1
    const estadoResultadoCompleto = estadoResultado.result.length > 0 && estadoResultado.result[0].completo === 1

    res.status(200).json({
      datosBasicos: datosBasicosCompleto,
      estadoBalance: estadoBalanceCompleto,
      estadoResultado: estadoResultadoCompleto
    });

  } catch (error) {
    next(error)
  }
}


const obtienePartidasFinancieras = async (id_certification, customUuid) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: obtienePartidasFinancieras`
  const buildResponse = (message, v) => {
    const resp = { message, v_alritmo: v }
    if (v === 2) {
      resp.reason = message
    }
    return resp
  }
  const parseNumber = (val) => {
    if (val === undefined || val === null) return NaN
    const cleaned = String(val).replace(/[$,\s]/g, '')
    return Number(cleaned)
  }
  const isEmpty = (value) =>
    value === null ||
    value === undefined ||
    value === '' ||
    parseNumber(value) === 0;
  try {
    logger.info(`${fileMethod} | ${customUuid} | Inicia proceso de validacion de version del algoritmo con id de certificacion: ${JSON.stringify(id_certification)}`)

    const no_partidas = await certificationService.obtenerPartidasFinancieras(id_certification)
    if (no_partidas[0].bandera == 'false' || no_partidas[0].bandera == undefined) {
      return buildResponse('No existen partidas financieras', 2)
    }

    const [balanceAnterior] = await certificationService.getEstadoBalanceData(
      id_certification,
      'anterior'
    )
    const [balancePrevio] = await certificationService.getEstadoBalanceData(
      id_certification,
      'previo_anterior'
    )
    const [resultadoAnterior] = await certificationService.getEstadoResultadoData(
      id_certification,
      'anterior'
    )
    const [resultadoPrevio] = await certificationService.getEstadoResultadoData(
      id_certification,
      'previo_anterior'
    )
    const [capitalAnterior] = await certificationService.obtieneCapitalAnterior(
      id_certification
    )
    const [capitalPrevio] = await certificationService.obtieneCapitalPrevioAnterior(
      id_certification
    )

    // 1. Capital
    if (isEmpty(capitalAnterior?.capital) || isEmpty(capitalPrevio?.capital)) {
      return buildResponse(
        'Capital - Periodo anterior: Con al menos no tener un período contable se va a algoritmo sin EEFF. Periodo previo anterior: Con al menos no tener un período contable se va a algoritmo sin EEFF',
        2
      )
    }

    // 2. Caja y bancos
    const cajaA = balanceAnterior?.caja_bancos_anterior
    const cajaP = balancePrevio?.caja_bancos_previo_anterior
    if (isEmpty(cajaA) || isEmpty(cajaP)) {
      return buildResponse(
        'Caja y bancos - Periodo anterior: Con al menos no tener un período contable se va a algoritmo sin EEFF. Periodo previo anterior: Con al menos no tener un período contable se va a algoritmo sin EEFF',
        2
      )
    }

    const invA = balanceAnterior?.inventarios_anterior
    const invP = balancePrevio?.inventarios_previo_anterior

    // 3. Clientes y cuentas por cobrar (PARTIDA 4) + Inventarios (PARTIDA 7)
    const cliA = balanceAnterior?.cliente_anterior
    const cliP = balancePrevio?.cliente_previo_anterior
    if (
      isEmpty(cliA) ||
      isEmpty(invA) ||
      isEmpty(cliP) ||
      isEmpty(invP)
    ) {
      return buildResponse(
        'Clientes y cuentas por cobrar + Inventarios - Si no se reportan conjuntamente en al menos uno de los dos periodos contables se va a algoritmo sin EEFF',
        2
      )
    }

    // 4. Proveedores (PARTIDA 13) + Acreedores y préstamos bancarios (PARTIDA 14)
    const provA = balanceAnterior?.proveedores_anterior
    const provP = balancePrevio?.proveedores_previo_anterior
    const acreA = balanceAnterior?.acreedores_anterior
    const acreP = balancePrevio?.acreedores_previo_anterior
    const ambosCerosAnterior = isEmpty(provA) && isEmpty(acreA)
    const ambosCerosPrevio = isEmpty(provP) && isEmpty(acreP)
    if (ambosCerosAnterior && ambosCerosPrevio) {
      return buildResponse(
        'Proveedores (PARTIDA 13) + Acreedores y préstamos bancarios (PARTIDA 14) - Si ambas partidas están en ceros en ambos periodos contables, se va a algoritmo versión 2. Si al menos uno de los dos rubros reporta 1 peso o más en cualquiera de los dos periodos, se va a algoritmo versión 1',
        2
      )
    }

    // 5. Ventas (PARTIDA 27)
    const ventasA = resultadoAnterior?.ventas_anuales_anterior
    const ventasP = resultadoPrevio?.ventas_anuales_previo_anterior
    if (isEmpty(ventasA) || isEmpty(ventasP)) {
      return buildResponse(
        'Ventas (PARTIDA 27) - No presenta esta partida en al menos un período contable',
        2
      )
    }

    // 6. Costo de Ventas (PARTIDA 28)
    const costoA = resultadoAnterior?.costo_ventas_anuales_anterior
    const costoP = resultadoPrevio?.costo_ventas_anuales_previo_anterior
    if (isEmpty(costoA) || isEmpty(costoP)) {
      return buildResponse(
        'Costo de Ventas (PARTIDA 28) - No presenta esta partida en al menos un período contable',
        2
      )
    }

    // 7. Utilidad Bruta (PARTIDA 29)
    const ubA = resultadoAnterior?.utilidad_bruta_anterior
    const ubP = resultadoPrevio?.utilidad_bruta_previo_anterior
    if (isEmpty(ubA) || isEmpty(ubP)) {
      return buildResponse(
        'Utilidad Bruta (PARTIDA 29) - No presenta esta partida en al menos un período contable',
        2
      )
    }

    // 8. Utilidad Operativa (PARTIDA 31)
    const uoA = resultadoAnterior?.utilidad_operativa_anterior
    const uoP = resultadoPrevio?.utilidad_operativa_previo_anterior
    if (isEmpty(uoA) || isEmpty(uoP)) {
      return buildResponse(
        'Utilidad Operativa (PARTIDA 31) - No presenta esta partida en al menos un período contable',
        2
      )
    }

    // 9. Utilidad Neta (PARTIDA 37)
    const unA = resultadoAnterior?.utilidad_neta_anterior
    const unP = resultadoPrevio?.utilidad_neta_previo_anterior
    if (isEmpty(unA) || isEmpty(unP)) {
      return buildResponse(
        'Utilidad Neta (PARTIDA 37) - No presenta esta partida en al menos un período contable',
        2
      )
    }


    return buildResponse('Partidas financieras completas', 1)
  } catch (error) {
    logger.error(`${fileMethod} | ${customUuid} Error general: ${JSON.stringify(error)}`)
    return buildResponse(JSON.stringify(error), 2)
  }
}


const consultaBloc = async (req, res) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: consultaBloc`
  try {
    const { idEmpresa } = req.params

    logger.info(`${fileMethod} | Inicio de la función consultaBloc`)

    const id_certification = await certificationService.getLastIdCertification(idEmpresa)

    logger.info(`${fileMethod} | Usando id_certification: ${id_certification}`)

    logger.info(`${fileMethod} | Iniciando consulta de bloc_concursos_mercantiles`)
    const bloc_concursos_mercantiles = await certificationService.getBloc_concursos_mercantiles(id_certification)
    logger.info(`${fileMethod} | Datos de bloc_concursos_mercantiles obtenidos: ${JSON.stringify(bloc_concursos_mercantiles)}`)

    logger.info(`${fileMethod} | Iniciando consulta de bloc_importadores_exportadores`)
    const bloc_importadores_exportadores = await certificationService.getBloc_importadores_exportadoress(id_certification)
    logger.info(`${fileMethod} | Datos de bloc_importadores_exportadores obtenidos: ${JSON.stringify(bloc_importadores_exportadores)}`)

    logger.info(`${fileMethod} | Iniciando consulta de bloc_lista_69_incumplidos`)
    const bloc_lista_69_incumplidos = await certificationService.getBloc_lista_69_incumplidos(id_certification)
    logger.info(`${fileMethod} | Datos de bloc_lista_69_incumplidos obtenidos: ${JSON.stringify(bloc_lista_69_incumplidos)}`)

    logger.info(`${fileMethod} | Iniciando consulta de bloc_ofac`)
    const bloc_ofac = await certificationService.getBloc_ofac(id_certification)
    logger.info(`${fileMethod} | Datos de bloc_ofac obtenidos: ${JSON.stringify(bloc_ofac)}`)

    logger.info(`${fileMethod} | Iniciando consulta de bloc_proveedores_contratistas`)
    const bloc_proveedores_contratistas = await certificationService.getBloc_proveedores_contratistas(id_certification)
    logger.info(`${fileMethod} | Datos de bloc_proveedores_contratistas obtenidos: ${JSON.stringify(bloc_proveedores_contratistas)}`)

    logger.info(`${fileMethod} | Iniciando consulta de bloc_sat69b`)
    const bloc_sat69b = await certificationService.getBloc_sat69b(id_certification)
    logger.info(`${fileMethod} | Datos de bloc_sat69b obtenidos: ${JSON.stringify(bloc_sat69b)}`)

    logger.info(`${fileMethod} | Devolviendo respuesta con todos los datos obtenidos`)

    return res.json({
      success: true,
      message: 'Data fetched successfully',
      data: {
        bloc_concursos_mercantiles,
        bloc_importadores_exportadores,
        bloc_lista_69_incumplidos,
        bloc_ofac,
        bloc_proveedores_contratistas,
        bloc_sat69b
      }
    })
  } catch (error) {
    logger.error(`${fileMethod} | Error durante la ejecución de consultaBloc: ${JSON.stringify(error)}`)
    next(error)
  }
}

const consultaBlocLocal = async (idEmpresa) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: consultaBloc`
  try {
    //const { idEmpresa } = req.params

    logger.info(`${fileMethod} | Inicio de la función consultaBloc`)

    const id_certification = await certificationService.getLastIdCertification(idEmpresa)

    logger.info(`${fileMethod} | Usando id_certification: ${id_certification}`)

    logger.info(`${fileMethod} | Iniciando consulta de bloc_concursos_mercantiles`)
    const bloc_concursos_mercantiles = await certificationService.getBloc_concursos_mercantiles(id_certification)
    logger.info(`${fileMethod} | Datos de bloc_concursos_mercantiles obtenidos: ${JSON.stringify(bloc_concursos_mercantiles)}`)

    logger.info(`${fileMethod} | Iniciando consulta de bloc_importadores_exportadores`)
    const bloc_importadores_exportadores = await certificationService.getBloc_importadores_exportadoress(id_certification)
    logger.info(`${fileMethod} | Datos de bloc_importadores_exportadores obtenidos: ${JSON.stringify(bloc_importadores_exportadores)}`)

    logger.info(`${fileMethod} | Iniciando consulta de bloc_lista_69_incumplidos`)
    const bloc_lista_69_incumplidos = await certificationService.getBloc_lista_69_incumplidos(id_certification)
    logger.info(`${fileMethod} | Datos de bloc_lista_69_incumplidos obtenidos: ${JSON.stringify(bloc_lista_69_incumplidos)}`)

    logger.info(`${fileMethod} | Iniciando consulta de bloc_ofac`)
    const bloc_ofac = await certificationService.getBloc_ofac(id_certification)
    logger.info(`${fileMethod} | Datos de bloc_ofac obtenidos: ${JSON.stringify(bloc_ofac)}`)

    logger.info(`${fileMethod} | Iniciando consulta de bloc_proveedores_contratistas`)
    const bloc_proveedores_contratistas = await certificationService.getBloc_proveedores_contratistas(id_certification)
    logger.info(`${fileMethod} | Datos de bloc_proveedores_contratistas obtenidos: ${JSON.stringify(bloc_proveedores_contratistas)}`)

    logger.info(`${fileMethod} | Iniciando consulta de bloc_sat69b`)
    const bloc_sat69b = await certificationService.getBloc_sat69b(id_certification)
    logger.info(`${fileMethod} | Datos de bloc_sat69b obtenidos: ${JSON.stringify(bloc_sat69b)}`)

    logger.info(`${fileMethod} | Devolviendo respuesta con todos los datos obtenidos`)

    return {
      bloc_concursos_mercantiles,
      bloc_importadores_exportadores,
      bloc_lista_69_incumplidos,
      bloc_ofac,
      bloc_proveedores_contratistas,
      bloc_sat69b
    }
  } catch (error) {
    logger.error(`${fileMethod} | Error durante la ejecución de consultaBloc: ${JSON.stringify(error)}`)
    return null
  }
}

const validacionBloc = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: validacionBloc`
  try {
    const { body } = req;
    const { nombre, apellido } = body

    let sin_incidencias = true
    let message = 'Sin incidencias'
    const asunto = []

    const {
      bloc_sat69b,
      bloc_ofac,
      bloc_concursos_mercantiles,
      bloc_proveedores_contratistas
    } = await blocController.callAllBlocServices(nombre, apellido)

    console.log(bloc_sat69b)

    if (bloc_sat69b) {
      const data_block_lista_sat_69B_presuntos_inexistentes = bloc_sat69b
      if (
        Array.isArray(data_block_lista_sat_69B_presuntos_inexistentes.inexistentes) &&
        data_block_lista_sat_69B_presuntos_inexistentes.inexistentes.length > 0
      ) {
        sin_incidencias = false
        message = 'Incidencias encontradas'
        asunto.push({
          listado69bInexistentes: data_block_lista_sat_69B_presuntos_inexistentes.inexistentes
        })
        logger.info(`${fileMethod} | Lista 69B response: ${JSON.stringify(data_block_lista_sat_69B_presuntos_inexistentes.inexistentes)}`)
      }
    }

    if (bloc_ofac) {
      const data_bloc_ofac = bloc_ofac
      if (Array.isArray(data_bloc_ofac.ofac) && data_bloc_ofac.ofac.length > 0) {
        sin_incidencias = false
        message = 'Incidencias encontradas'
        asunto.push({
          ofac: data_bloc_ofac.ofac
        })
        logger.info(`${fileMethod} | OFAC response: ${JSON.stringify(data_bloc_ofac.ofac)}`)
      }
    }

    if (bloc_concursos_mercantiles) {
      const data_concursos_mercantiles = bloc_concursos_mercantiles
      if (
        Array.isArray(data_concursos_mercantiles.informe) &&
        data_concursos_mercantiles.informe.length > 0
      ) {
        sin_incidencias = false
        message = 'Incidencias encontradas'
        asunto.push({
          concursosMercantiles: data_concursos_mercantiles.informe
        })
        logger.info(`${fileMethod} | Concursos mercantiles response: ${JSON.stringify(data_concursos_mercantiles.informe)}`)
      }
    }

    if (bloc_proveedores_contratistas) {
      const data_proveedores_contratistas = bloc_proveedores_contratistas
      if (
        Array.isArray(data_proveedores_contratistas.multados) &&
        data_proveedores_contratistas.multados.length > 0
      ) {
        sin_incidencias = false
        message = 'Incidencias encontradas'
        asunto.push({
          proveedores_contratistas: data_proveedores_contratistas.multados
        })
        logger.info(`${fileMethod} | proveedores_contratistas response: ${JSON.stringify(data_proveedores_contratistas.multados)}`)
      }
    }


    return res.json({
      sin_incidencias,
      message,
      asunto,
      bloc_sat69b,
      bloc_ofac,
      bloc_concursos_mercantiles,
      bloc_proveedores_contratistas
    })

  } catch (error) {
    logger.error(`${fileMethod} | Error reporte de credito final: ${JSON.stringify(error)}`)
    next(error)
  }
}

const consultaBlocEmpresaControlanteData = async (nombre, apellido = '') => {
  return blocService.callAll(nombre, apellido)
}

const consultaBlocEmpresaControlante = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: consultaBlocEmpresaControlante`
  try {
    const { nombre, apellido = '' } = req.query

    const data = await consultaBlocEmpresaControlanteData(nombre, apellido)

    return res.json(data)
  } catch (error) {
    logger.error(`${fileMethod} | Error durante la ejecución: ${JSON.stringify(error)}`)
    next(error)
  }
}

const generaReporteInformativoCredito = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: generaReporteInformativoCredito`;
  const consulta_bloc = req.consultaBloc;

  try {
    const { body } = req;
    const { id_cliente, id_proveedor, id_reporte_credito, monto_solicitado, plazo, mensaje_bloc, mensaje_konesh } = body

    if (!id_cliente || !id_reporte_credito || !monto_solicitado || !plazo) return next(boom.badRequest(`Información incompleta`))

    if (!id_cliente || !id_reporte_credito) {
      return next(boom.badRequest("Información incompleta"));
    }

    const id_certification = await certificationService.getLastIdCertification(id_cliente);
    body.id_certification = id_certification;

    if (!id_certification || !monto_solicitado || !plazo) {
      logger.warn(`${fileMethod} | ${customUuid} La información que proporcionas esta incompleta: ${JSON.stringify(body)}`)
      return next(boom.badRequest(`La información que proporcionas esta incompleta: ${JSON.stringify(body)}`))
    }

    const customUuid = new Date().toISOString().replace(/\D/g, '');
    const partidas_financieras = await obtienePartidasFinancieras(id_certification, customUuid);

    logger.info(`${fileMethod} | ${customUuid} Inicia proceso para ejecutar algoritmo: ${JSON.stringify(body)}`);
    const reporteInformativoCredito = {};

    const pais = await certificationService.getPaisAlgoritmoByIdCertification(id_certification);
    if (!pais) {
      logger.warn(`${fileMethod} | ${customUuid} No se pudo obtener información del país.`);
      return next(boom.badRequest(`No se pudo obtener información del país.`));
    }
    reporteInformativoCredito._01_pais_descripcion = {
      descripcion: pais.nombre,
    };

    const sector_riesgo = await certificationService.getSectorRiesgoByIdCertification(id_certification, partidas_financieras);
    if (!sector_riesgo) {
      logger.warn(`${fileMethod} | ${customUuid} No se pudo obtener sector de riesgo.`);
      return next(boom.badRequest(`No se pudo obtener sector de riesgo.`));
    }
    reporteInformativoCredito._02_sector_riesgo_descripcion = {
      descripcion: sector_riesgo.nombre,
    };

    reporteInformativoCredito._03_capital_contable = {
      descripcion: "No definido",
      parametro: 0,
      limite_inferior: 0,
      limite_superior: 0
    };

    const plantilla_laboral = await getScorePlantillaLaboral(id_certification, partidas_financieras, customUuid);
    if (plantilla_laboral.error) {
      logger.warn(`${fileMethod} | ${customUuid} No se pudo obtener información de plantilla laboral.`);
      return next(boom.badRequest(`No se pudo obtener información de plantilla laboral.`));
    }
    reporteInformativoCredito._04_plantilla_laboral = {
      descripcion: plantilla_laboral.descripcion,
      parametro: plantilla_laboral.plantilla_laboral,
      limite_inferior: plantilla_laboral.limite_inferior,
      limite_superior: 0
    };

    const sector_cliente_final = await certificationService.getScoreClienteFinal(id_certification, partidas_financieras);
    if (!sector_cliente_final || sector_cliente_final.length === 0) {
      logger.warn(`${fileMethod} | ${customUuid} No se pudo obtener información de sector cliente final.`);
      return next(boom.badRequest(`No se pudo obtener información de sector cliente final.`));
    }

    reporteInformativoCredito._05_sector_cliente_final = {
      descripcion: sector_cliente_final.nombre
    };

    const tiempo_actividad = await certificationService.getScoreTiempoActividad(id_certification, partidas_financieras);
    if (!tiempo_actividad || tiempo_actividad.length === 0) {
      logger.warn(`${fileMethod} | ${customUuid} No se pudo obtener información de tiempo de actividad.`);
      return next(boom.badRequest(`No se pudo obtener información de tiempo de actividad.`));
    }

    reporteInformativoCredito._06_tiempo_actividad = {
      descripcion: "No definido"
    };

    reporteInformativoCredito._08_ventas_anuales = {
      descripcion: "No definido",
      parametro: 0,
      limite_inferior: 0,
      limite_superior: 0
    };

    reporteInformativoCredito._09_tipo_cifras = {
      descripcion: "algoritmo v2",
    }

    const incidencias_legales = await getScoreIncidenciasLegales(id_certification, partidas_financieras, customUuid);
    if (incidencias_legales.error) {
      logger.warn(`${fileMethod} | ${customUuid} No se pudo obtener información de incidencias legales.`);
      return next(boom.badRequest(`No se pudo obtener información de incidencias legales.`));
    }
    reporteInformativoCredito._10_incidencia_legal_tipo = {
      tipo: "N/A",
      caso: "NINGUNA"
    };

    reporteInformativoCredito._11_evolucion_ventas = {
      descripcion: "No disponible",
      parametro: 0,
      rango: "N/A"
    };

    reporteInformativoCredito._12_apalancamiento = {
      descripcion: "No disponible",
      parametro: 0.00,
      limite_inferior: 0,
      limite_superior: 0
    };

    reporteInformativoCredito._13_flujo_neto = {
      descripcion: "No disponible",
      parametro: 0,
      limite_inferior: 0,
      limite_superior: 0
    };

    reporteInformativoCredito._14_payback = {
      descripcion: "No disponible",
      parametro: 0.0,
      limite_inferior: 0,
      limite_superior: 0
    };

    reporteInformativoCredito._15_rotacion_ctas_x_cobrar = {
      descripcion: "No disponible",
      limite_inferior: 0,
      limite_superior: 0
    };

    reporteInformativoCredito._16_referencias_comerciales = {
      descripcion: "No disponible",
    };

    reporteInformativoCredito.alertas = {
      porcentaje_endeudamiento: 10,  // Asignar un valor adecuado
      dias_plazo_credito: 30,        // Asignar un valor adecuado
      texto_reporte_plazo_credito: 'Texto ejemplo'
    }

    reporteInformativoCredito.monto_solicitado = monto_solicitado
    reporteInformativoCredito.porcentaje_endeudamiento = 0;
    reporteInformativoCredito.dias_plazo_credito = plazo;
    reporteInformativoCredito.texto_reporte_plazo_credito = "No disponible";
    reporteInformativoCredito.wording_underwriting = "No disponible";
    reporteInformativoCredito.dpo = 0;
    reporteInformativoCredito.plazo = plazo;

    logger.info(`${fileMethod} | ${customUuid} El ID del cliente para la empresa es: ${JSON.stringify(id_cliente)}`)

    const calculos_estado_balance = await calculoEstadoBalance(customUuid, id_certification)
    const calculos_estado_resultados = await calculosEstadoResultados(customUuid, id_certification)
    const ratio_financiero = await calculoRatiosFinancieros(customUuid, id_certification, calculos_estado_balance, calculos_estado_resultados)

    reporteInformativoCredito.calculos_estado_balance = calculos_estado_balance
    reporteInformativoCredito.calculos_estado_resultados = calculos_estado_resultados
    reporteInformativoCredito.ratio_financiero = ratio_financiero

    await certificationService.updateSolicitudCredito(monto_solicitado, plazo, id_reporte_credito)

    //console.log('bloc--', consulta_bloc)
    const location = await generarReporteInformativoo(customUuid, id_cliente, id_reporte_credito, reporteInformativoCredito, id_certification, mensaje_bloc, mensaje_konesh);
    reporteInformativoCredito.reporte_pdf = location.archivo;
    logger.info(`${fileMethod} | ${customUuid} Reporte de crédito generado: ${JSON.stringify(location)}`);
    logger.info(`${fileMethod} | ${customUuid} Reporte de credito final-x: ${JSON.stringify(reporteInformativoCredito)}`)
    reporteInformativoCredito.id_reporte_credito = id_reporte_credito;
    await certificationService.insertReporteInformativo(id_certification, reporteInformativoCredito, customUuid);

    if (location?.archivo) {
      const empresa_info = await certificationService.getUsuarioEmail(id_proveedor);
      logger.info(`${fileMethod} | ${customUuid} Inicia empresa_info: ${JSON.stringify(empresa_info)}`);

      const [{ usu_nombre: nombre, usu_email: email }] = empresa_info;
      const templateID = 6967845;

      const cliente = await certificationService.consultaEmpresaInfo(id_cliente);
      const _cliente = cliente?.result?.[0]?.emp_razon_social || 'No encontrado';
      logger.info(`${fileMethod} | ${customUuid} cliente: ${JSON.stringify(_cliente,)}`);

      const proveedor = await certificationService.consultaEmpresaInfo(id_proveedor);
      const _proveedor = proveedor?.result?.[0]?.emp_razon_social || 'No encontrado';
      logger.info(`${fileMethod} | ${customUuid} proveedor: ${JSON.stringify(
        {
          email,
          nombre,
          templateID,
          empresa: _cliente,
          empresa_envia: _proveedor
        }
      )}`);

      const resultado = await sendCompaniEmail({
        email,
        nombre,
        templateID,
        empresa: _cliente,
        empresa_envia: _proveedor
      });

      if (resultado.success) {
        logger.info(`${fileMethod} | ${customUuid} Correo enviado con éxito a ${email}`);
      } else {
        logger.warn(`${fileMethod} | ${customUuid} Error al enviar el correo: ${resultado.error}`);
      }
    }

    return res.json({
      error: false,
      reporteInformativoCredito
    });
  } catch (error) {
    console.error(`${fileMethod} - Error:`, error);
    return res.status(500).json({ error: "Ocurrió un error en el servidor." });
  }
};

const getAlgoritmoResult = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: getAlgoritmoResult`
  try {
    const { body } = req;
    logger.info(`El body es: ${JSON.stringify(body)}`)

    const { id_cliente, id_proveedor, id_reporte_credito, monto_solicitado, plazo } = body

    if (!id_cliente || !id_reporte_credito || !monto_solicitado || !plazo) return next(boom.badRequest(`Información incompleta`))

    const id_certification = await certificationService.getLastIdCertification(id_cliente)
    const customUuid = new Date().toISOString().replace(/\D/g, '')

    if (!id_certification) {
      logger.warn(
        `${fileMethod} | ${customUuid} No se encontró una certificación válida para el cliente ${id_cliente}`
      )
      return next(boom.badRequest(`No se encontró certificación para el cliente ${id_cliente}`))
    }

    const parametrosAlgoritmo = await algorithmService.getGeneralSummary()
    body.id_certification = id_certification

    logger.info(`${fileMethod} | ${customUuid} Inicia proceso para ejecutar algoritmo: ${JSON.stringify(body)}`)

    const algoritmo_v = await obtienePartidasFinancieras(id_certification, customUuid)

    if (!id_certification || !monto_solicitado || !plazo || !algoritmo_v) {
      logger.warn(`${fileMethod} | ${customUuid} La información que proporcionas esta incompleta: ${JSON.stringify(body)}`)
      return next(boom.badRequest(`La información que proporcionas esta incompleta: ${JSON.stringify(body)}`))
    }

    const reporteCredito = {}

    const [
      pais,
      sector_riesgo,
      capital_contable,
      plantilla_laboral,
      sector_cliente_final,
      tiempo_actividad,
      influencia_controlante,
      ventas_anuales,
      tipo_cifras,
      incidencias_legales,
      evolucion_ventas,
      apalancamiento,
      flujo_neto,
      payback,
      rotacion_ctas_x_cobrar,
      referencias_comerciales,
      alerta_endeudamiento_comercial,
      alerta_promedio_plazo_credito
    ] = await Promise.all([
      getPaisScoreFromSummary(id_certification, algoritmo_v, parametrosAlgoritmo, customUuid),
      getSectorRiesgoScoreFromSummary(id_certification, algoritmo_v, parametrosAlgoritmo, customUuid),
      getScoreCapitalContableFromSummary(id_certification, algoritmo_v, parametrosAlgoritmo, customUuid),
      getScorePlantillaLaboralFromSummary(id_certification, algoritmo_v, parametrosAlgoritmo, customUuid),
      getScoreClienteFinalFromSummary(id_certification, algoritmo_v, parametrosAlgoritmo, customUuid),
      getScoreTiempoActividadFromSummary(id_certification, algoritmo_v, parametrosAlgoritmo, customUuid),
      getControlanteScoreFromSummary(id_certification, parametrosAlgoritmo, customUuid),
      getScoreVentasAnualesFromSummary(id_certification, algoritmo_v, parametrosAlgoritmo, customUuid),
      getScoreTipoCifrasFromSummary(id_certification, algoritmo_v, parametrosAlgoritmo, customUuid),
      getScoreIncidenciasLegalesFromSummary(id_certification, algoritmo_v, parametrosAlgoritmo, customUuid),
      getScoreEvolucionVentasFromSummary(id_certification, algoritmo_v, parametrosAlgoritmo, customUuid),
      getScoreApalancamientoFromSummary(id_certification, algoritmo_v, parametrosAlgoritmo, customUuid),
      getScoreCajaBancosFromSummary(id_certification, algoritmo_v, parametrosAlgoritmo, customUuid),
      getScorePaybackFromSummary(id_certification, algoritmo_v, parametrosAlgoritmo, customUuid),
      getScoreRotacionCtasXCobrasScoreFromSummary(id_certification, algoritmo_v, parametrosAlgoritmo, customUuid),
      getScoreReferenciasComercialesFromSummary(id_certification, algoritmo_v, parametrosAlgoritmo, customUuid),
      getAlertaEndeudamientoComercial(id_certification, customUuid),
      getAlertaPromedioPlazoCredito(id_certification, customUuid)
    ])
    if (!pais || pais.error) {
      const msg = 'No se pudo obtener información del país'
      logger.warn(`${fileMethod} | ${customUuid} ${msg} en la certificación`)
      return next(boom.badRequest(msg))
    }

    logger.info(
      `${fileMethod} | ${customUuid} El país para el algoritmo es: ${pais.nombre}`
    )

    reporteCredito._01_pais = {
      descripcion: pais.nombre,
      score: pais.valor_algoritmo
    }

    logger.info(`${fileMethod} | ${customUuid} Reporte de credito 01: ${JSON.stringify(reporteCredito)}`)

    if (sector_riesgo.error) {
      logger.warn(`${fileMethod} | ${customUuid} No se pudo obtener información para obtener sector riesgo en la certificación con ID: ${JSON.stringify(sector_riesgo)}`)
      return next(boom.badRequest(`No se pudo obtener información para obtener sector riesgo en la certificación con ID: ${JSON.stringify(sector_riesgo)}`))
    }

    logger.info(`${fileMethod} | ${customUuid} El sector riesgo para el algoritmo es: ${JSON.stringify(sector_riesgo)}`)

    reporteCredito._02_sector_riesgo = {
      descripcion: sector_riesgo.nombre,
      score: sector_riesgo.valor_algoritmo
    }

    logger.info(`${fileMethod} | ${customUuid} Reporte de credito 02: ${JSON.stringify(reporteCredito)}`)

    reporteCredito._03_capital_contable = buildCapitalContableReport(capital_contable, algoritmo_v, fileMethod, customUuid)

    logger.info(`${fileMethod} | ${customUuid} Reporte de credito 03: ${JSON.stringify(reporteCredito)}`)

    if (plantilla_laboral.error) {
      logger.warn(`${fileMethod} | ${customUuid} No se pudo obtener información para obtener plantilla laboral en la certificación con ID: ${JSON.stringify(plantilla_laboral)}`)
      return next(boom.badRequest(`No se pudo obtener información para obtener plantilla laboral en la certificación con ID: ${JSON.stringify(plantilla_laboral)}`))
    }

    logger.info(`${fileMethod} | ${customUuid} La plantilla laboral para el algoritmo es: ${JSON.stringify(plantilla_laboral)}`)

    reporteCredito._04_plantilla_laboral = {
      descripcion: plantilla_laboral.descripcion,
      score: plantilla_laboral.score,
      parametro: plantilla_laboral.plantilla_laboral,
      limite_inferior: plantilla_laboral.limite_inferior,
      limite_superior: 'null'
    }

    logger.info(`${fileMethod} | ${customUuid} Reporte de credito 04: ${JSON.stringify(reporteCredito)}`)

    if (sector_cliente_final.error) {
      logger.warn(
        `${fileMethod} | ${customUuid} No se pudo obtener información para obtener sector cliente final en la certificación con ID: ${JSON.stringify(sector_cliente_final)}`
      )
      return next(
        boom.badRequest(
          `No se pudo obtener información para obtener sector cliente final en la certificación con ID: ${JSON.stringify(sector_cliente_final)}`
        )
      )
    }

    logger.info(
      `${fileMethod} | ${customUuid} El sector cliente final para el algoritmo es: ${JSON.stringify(sector_cliente_final)}`
    )

    reporteCredito._05_sector_cliente_final = {
      descripcion: sector_cliente_final.nombre,
      score: sector_cliente_final.valor_algoritmo
    }

    logger.info(`${fileMethod} | ${customUuid} Reporte de credito 05: ${JSON.stringify(reporteCredito)}`)

    if (tiempo_actividad.error) {
      logger.warn(
        `${fileMethod} | ${customUuid} No se pudo obtener información para obtener tiempo actividad final en la certificación con ID: ${JSON.stringify(tiempo_actividad)}`
      )
      return next(
        boom.badRequest(
          `No se pudo obtener información para obtener tiempo actividad final en la certificación con ID: ${JSON.stringify(tiempo_actividad)}`
        )
      )
    }

    logger.info(`${fileMethod} | ${customUuid} El tiempo de actividas para el algoritmo es: ${JSON.stringify(tiempo_actividad)}`)

    reporteCredito._06_tiempo_actividad = {
      descripcion: tiempo_actividad.nombre,
      score: tiempo_actividad.valor_algoritmo
    }

    logger.info(`${fileMethod} | ${customUuid} Reporte de credito 06: ${JSON.stringify(reporteCredito)}`)

    logger.info(
      `${fileMethod} | ${customUuid} Influencia controlante para el algoritmo es: ${JSON.stringify(
        influencia_controlante
      )}`
    )

    let resultadoControlante = influencia_controlante.resultado_empresa_controlante || {}
    if (influencia_controlante.error) {
      logger.warn(
        `${fileMethod} | ${customUuid} No se pudo obtener información para obtener influencia controlante en la certificación con ID: ${JSON.stringify(
          influencia_controlante
        )}`
      )

      const desconocido = await certificationService.getInfluenciaControlanteScore(
        'Desconocido'
      )

      reporteCredito._07_influencia_controlante = {
        descripcion: 'Desconocido',
        score: desconocido ? desconocido.valor_algoritmo : '0',
        empresa_controlante: null
      }

      resultadoControlante = {}
      reporteCredito._07_influencia_controlante_score = desconocido ? desconocido.valor_algoritmo : '0'
      reporteCredito._07_influencia_controlante_regla = 'Desconocido'
      reporteCredito._07_influencia_controlante_empresa = null
      reporteCredito._07_influencia_controlante_rfc = null
    } else {
      reporteCredito._07_influencia_controlante = {
        descripcion: influencia_controlante.regla,
        score: influencia_controlante.score,
        empresa_controlante: influencia_controlante.empresa_controlante
      }

      reporteCredito._07_influencia_controlante_score = influencia_controlante.score ?? null
      reporteCredito._07_influencia_controlante_regla = influencia_controlante.regla ?? ''
      reporteCredito._07_influencia_controlante_empresa = influencia_controlante.empresa_controlante ?? ''
      reporteCredito._07_influencia_controlante_rfc = influencia_controlante.rfc ?? ''
    }
    reporteCredito._07_influencia_controlante_demandas_penales = resultadoControlante.demandas_penales ?? null
    reporteCredito._07_influencia_controlante_demandas_mercantiles = resultadoControlante.demandas_mercantiles ?? null
    reporteCredito._07_influencia_controlante_sat_69b = resultadoControlante.sat_69b ?? null
    reporteCredito._07_influencia_controlante_ofac = resultadoControlante.ofac ?? null
    reporteCredito._07_influencia_controlante_mercantiles_proveedores = resultadoControlante.mercantiles_proveedores ?? null
    reporteCredito._07_influencia_controlante_contratistas_boletinados = resultadoControlante.contratistas_boletinados ?? null

    logger.info(`${fileMethod} | ${customUuid} Reporte de credito 07: ${JSON.stringify(reporteCredito)}`)

    if (ventas_anuales.error) {
      logger.info(`${fileMethod} | ${customUuid} No se pudo obtener información para obtener ventas anuales en la certificación con ID: ${JSON.stringify(ventas_anuales)}`)
      logger.info(`${fileMethod} | ${customUuid} Se asigna score 0 para version 2 de algoritmo `)

      reporteCredito._08_ventas_anuales = {
        descripcion:
          Number(algoritmo_v?.v_alritmo) === 2 ? 'algoritmo v2' : 'algoritmo v1',
        score: '0',
        parametro: 'null',
        limite_inferior: 'null',
        limite_superior: 'null'
      }
    } else {
      logger.info(`${fileMethod} | ${customUuid} Ventas anuales para el algoritmo es: ${JSON.stringify(ventas_anuales)}`)

      reporteCredito._08_ventas_anuales = {
        descripcion: Number(algoritmo_v?.v_alritmo) === 2 ? 'version 2 algoritmo' : ventas_anuales.descripcion,
        score: Number(algoritmo_v?.v_alritmo) === 2 ? '0' : ventas_anuales.score,
        parametro: Number(algoritmo_v?.v_alritmo) === 2 ? 0.00 : ventas_anuales.ventas_anuales,
        limite_inferior: Number(algoritmo_v?.v_alritmo) === 2 ? 0 : ventas_anuales.limite_inferior,
        limite_superior: Number(algoritmo_v?.v_alritmo) === 2 ? 0 : ventas_anuales.limite_superior
      }
    }

    logger.info(`${fileMethod} | ${customUuid} Reporte de credito 08: ${JSON.stringify(reporteCredito)}`)

    if (tipo_cifras.error) {
      logger.info(`${fileMethod} | ${customUuid} No se pudo obtener información para obtener tipo cifras en la certificación con ID: ${JSON.stringify(tipo_cifras)}`)
      logger.info(`${fileMethod} | ${customUuid} Se asigna score 0 para version 2 de algoritmo `)

      reporteCredito._09_tipo_cifras = {
        descripcion:
          Number(algoritmo_v?.v_alritmo) === 2 ? 'algoritmo v2' : 'algoritmo v1',
        score: '0'
      }
    } else {
      logger.info(`${fileMethod} | ${customUuid} Las tipo cifras para el algoritmo son: ${JSON.stringify(tipo_cifras)}`)

      reporteCredito._09_tipo_cifras = {
        descripcion: tipo_cifras.descripcion,
        score: tipo_cifras.score
      }
    }

    logger.info(`${fileMethod} | ${customUuid} Reporte de credito 09: ${JSON.stringify(reporteCredito)}`)

    if (incidencias_legales.error) {
      logger.warn(`${fileMethod} | ${customUuid} No se pudo obtener información para obtener incidencias legales en la certificación con ID: ${JSON.stringify(incidencias_legales)}`)
      return next(boom.badRequest(`No se pudo obtener información para obtener incidencias legales en la certificación con ID: ${JSON.stringify(incidencias_legales)}`))
    }

    logger.info(`${fileMethod} | ${customUuid} Las incidencias legales para el algoritmo son: ${JSON.stringify(incidencias_legales)}`)

    reporteCredito._10_incidencias_legales = {
      tipo: incidencias_legales.tipo,
      score: incidencias_legales.score,
      caso: incidencias_legales.caso
    }

    logger.info(`${fileMethod} | ${customUuid} Reporte de credito 10: ${JSON.stringify(reporteCredito)}`)

    if (evolucion_ventas.error) {
      logger.info(`${fileMethod} | ${customUuid} No se pudo obtener información para obtener evolucion ventas en la certificación con ID: ${JSON.stringify(evolucion_ventas)}`)
      logger.info(`${fileMethod} | ${customUuid} Se asigna score 0 para version 2 de algoritmo `)
      const desconocido = parametrosAlgoritmo.evolucionVentasScore.find(
        e => e.nombre && e.nombre.toUpperCase() === 'DESCONOCIDO'
      )
      reporteCredito._11_evolucion_ventas = {
        descripcion: desconocido ? desconocido.nombre : 'DESCONOCIDO',
        score: desconocido
          ? Number(algoritmo_v?.v_alritmo) === 2
            ? desconocido.v2
            : desconocido.v1
          : '0',
        parametro: 'null',
        rango: 'null'
      }
    } else {
      logger.info(`${fileMethod} | ${customUuid} Evolucion de ventas para el algoritmo son: ${JSON.stringify(evolucion_ventas)}`)

      reporteCredito._11_evolucion_ventas = {
        descripcion: Number(algoritmo_v?.v_alritmo) === 2 ? 'version 2 algoritmo' : evolucion_ventas.nombre,
        score: Number(algoritmo_v?.v_alritmo) === 2 ? '0' : evolucion_ventas.score,
        parametro: Number(algoritmo_v?.v_alritmo) === 2 ? 'version 2 algoritmo' : evolucion_ventas.evolucion_ventas,
        rango: Number(algoritmo_v?.v_alritmo) === 2 ? 'version 2 algoritmo' : evolucion_ventas.rango_numerico,
        ventas_anuales_periodo_anterior_estado_resultados:
          evolucion_ventas.ventas_anuales_periodo_anterior_estado_resultados,
        ventas_anuales_periodo_previo_anterior_estado_resultados:
          evolucion_ventas.ventas_anuales_periodo_previo_anterior_estado_resultados,
        operacion:
          `(${evolucion_ventas.ventas_anuales_periodo_anterior_estado_resultados} - ${evolucion_ventas.ventas_anuales_periodo_previo_anterior_estado_resultados}) / ${evolucion_ventas.ventas_anuales_periodo_previo_anterior_estado_resultados} * 100`
      }
    }

    logger.info(`${fileMethod} | ${customUuid} Reporte de credito 11: ${JSON.stringify(reporteCredito)}`)

    if (apalancamiento.error) {
      logger.info(`${fileMethod} | ${customUuid} No se pudo obtener información para apalancamiento en la certificación con ID: ${JSON.stringify(apalancamiento)}`)
      logger.info(`${fileMethod} | ${customUuid} Se asigna score 0 para version 2 de algoritmo `)
      const desconocido = parametrosAlgoritmo.apalancamientoScore.find(
        a => a.nombre && a.nombre.toUpperCase() === 'DESCONOCIDO'
      )

      reporteCredito._12_apalancamiento = {
        descripcion: desconocido ? desconocido.nombre : 'DESCONOCIDO',
        score: desconocido
          ? Number(algoritmo_v?.v_alritmo) === 2
            ? desconocido.v2
            : desconocido.v1
          : '0',
        parametro:
          apalancamiento.apalancamiento == null
            ? 'null'
            : apalancamiento.apalancamiento,
        limite_inferior: 'null',
        limite_superior: 'null',
        deuda_total_estado_balance_periodo_anterior:
          apalancamiento.deuda_total_estado_balance_periodo_anterior,
        capital_contable_estado_balance:
          apalancamiento.capital_contable_estado_balance
      }
    } else {
      logger.info(`${fileMethod} | ${customUuid} apalancamienro para el algoritmo es: ${JSON.stringify(apalancamiento)}`)

      reporteCredito._12_apalancamiento = {
        descripcion: apalancamiento.descripcion_apalancamiento,
        score: apalancamiento.score,
        parametro: apalancamiento.apalancamiento == null ? 'null' : apalancamiento.apalancamiento,
        limite_inferior: apalancamiento.limite_inferior == '' ? 'null' : apalancamiento.limite_inferior,
        limite_superior: apalancamiento.limite_superior == '' ? 'null' : apalancamiento.limite_superior,
        deuda_total_estado_balance_periodo_anterior:
          apalancamiento.deuda_total_estado_balance_periodo_anterior,
        capital_contable_estado_balance:
          apalancamiento.capital_contable_estado_balance,
        operacion: apalancamiento.operacion
      }
      console.log(JSON.stringify(reporteCredito._12_apalancamiento))
    }

    logger.info(`${fileMethod} | ${customUuid} Reporte de credito 12: ${JSON.stringify(reporteCredito)}`)

    if (flujo_neto.error) {
      logger.info(`${fileMethod} | ${customUuid} No se pudo obtener información para flujo neto en la certificación con ID: ${JSON.stringify(flujo_neto)}`)
      logger.info(`${fileMethod} | ${customUuid} Se asigna score 0 para version 2 de algoritmo `)
      const desconocido = parametrosAlgoritmo.flujoNetoScore.find(
        f => f.nombre && f.nombre.toUpperCase() === 'DESCONOCIDO'
      )
      reporteCredito._13_flujo_neto = {
        descripcion: desconocido ? desconocido.nombre : 'DESCONOCIDO',
        score: desconocido
          ? Number(algoritmo_v?.v_alritmo) === 2
            ? desconocido.v2
            : desconocido.v1
          : '0',
        parametro: flujo_neto.caja_bancos_periodo_anterior ?? 'null',
        limite_inferior: 'null',
        limite_superior: 'null'
      }
    } else {
      logger.info(`${fileMethod} | ${customUuid} flujo neto para el algoritmo es: ${JSON.stringify(flujo_neto)}`)

      reporteCredito._13_flujo_neto = {
        descripcion: Number(algoritmo_v?.v_alritmo) === 2 ? 'version 2 algoritmo' : flujo_neto.descripcion,
        score: Number(algoritmo_v?.v_alritmo) === 2 ? '0' : flujo_neto.score,
        parametro: Number(algoritmo_v?.v_alritmo) === 2 ? 'version 2 algoritmo' : flujo_neto.caja_bancos_periodo_anterior,
        limite_inferior: Number(algoritmo_v?.v_alritmo) === 2 ? 0 : flujo_neto.limite_inferior == '' ? 'null' : flujo_neto.limite_inferior,
        limite_superior: Number(algoritmo_v?.v_alritmo) === 2 ? 0 : flujo_neto.limite_superior == '' ? 'null' : flujo_neto.limite_superior
      }
    }

    logger.info(`${fileMethod} | ${customUuid} Reporte de credito 13: ${JSON.stringify(reporteCredito)}`)

    if (payback.error) {
      logger.info(`${fileMethod} | ${customUuid} No se pudo obtener información para payback en la certificación con ID: ${JSON.stringify(payback)}`)
      logger.info(`${fileMethod} | ${customUuid} Se asigna score 0 para version 2 de algoritmo `)

      reporteCredito._14_payback = {
        descripcion:
          Number(algoritmo_v?.v_alritmo) === 2 ? 'algoritmo v2' : 'algoritmo v1',
        score: '0',
        parametro: 'null',
        limite_inferior: 'null',
        limite_superior: 'null'
      }
    } else {
      logger.info(`${fileMethod} | ${customUuid} payback para el algoritmo es: ${JSON.stringify(payback)}`)

      reporteCredito._14_payback = {
        descripcion: Number(algoritmo_v?.v_alritmo) === 2 ? 'version 2 algoritmo' : payback.descripcion,
        score: Number(algoritmo_v?.v_alritmo) === 2 ? '0' : payback.score,
        parametro: Number(algoritmo_v?.v_alritmo) === 2 ? 0 : payback.payback,
        limite_inferior: Number(algoritmo_v?.v_alritmo) === 2 ? 0 : payback.limite_inferior == null ? 'null' : payback.limite_inferior,
        limite_superior: Number(algoritmo_v?.v_alritmo) === 2 ? 0 : payback.limite_superior == null ? 'null' : payback.limite_superior,
        deuda_corto_plazo_periodo_anterior: payback.deuda_corto_plazo_periodo_anterior,
        utilida_operativa: payback.utilida_operativa,
        operacion: payback.operacion ? payback.operacion : `${payback.deuda_corto_plazo_periodo_anterior} / ${payback.utilida_operativa}`
      }
    }

    logger.info(`${fileMethod} | ${customUuid} Reporte de credito 14: ${JSON.stringify(reporteCredito)}`)

    if (rotacion_ctas_x_cobrar.error) {
      logger.info(`${fileMethod} | ${customUuid} No se pudo obtener información para rotacion de cuentas por cobrar en la certificación con ID: ${JSON.stringify(rotacion_ctas_x_cobrar)}`)
      logger.info(`${fileMethod} | ${customUuid} Se asigna score 0 para version 2 de algoritmo `)

      reporteCredito._15_rotacion_ctas_x_cobrar = {
        descripcion:
          Number(algoritmo_v?.v_alritmo) === 2 ? 'algoritmo v2' : 'algoritmo v1',
        score: '0',
        parametro_dso: 'null',
        parametro_dio: 'null',
        limite_inferior: 'null',
        limite_superior: 'null',
        explicacion: 'Sin información',
        metricUsed: { tipo: null, valor: '-' },
        metricScoreUsed: null
      }
    } else {
      logger.info(`${fileMethod} | ${customUuid} Rotacion de cuentas por cobrar para el algoritmo es: ${JSON.stringify(rotacion_ctas_x_cobrar)}`)

      reporteCredito._15_rotacion_ctas_x_cobrar = {
        descripcion: Number(algoritmo_v?.v_alritmo) === 2 ? 'version 2 algoritmo' : `${rotacion_ctas_x_cobrar.descripcionDio} | ${rotacion_ctas_x_cobrar.descripcionDso}`,
        score: Number(algoritmo_v?.v_alritmo) === 2 ? '0' : rotacion_ctas_x_cobrar.score,
        score_dio: rotacion_ctas_x_cobrar.scoreDio,
        score_dso: rotacion_ctas_x_cobrar.scoreDso,
        parametro_dso: Number(algoritmo_v?.v_alritmo) === 2 ? 'version 2 algoritmo' : rotacion_ctas_x_cobrar.dso,
        parametro_dio: Number(algoritmo_v?.v_alritmo) === 2 ? 'version 2 algoritmo' : rotacion_ctas_x_cobrar.dio,
        ventas_anuales: Number(algoritmo_v?.v_alritmo) === 2 ? 0 : rotacion_ctas_x_cobrar.ventas_anuales,
        saldo_inventarios: Number(algoritmo_v?.v_alritmo) === 2 ? 0 : rotacion_ctas_x_cobrar.saldo_inventarios,
        costo_ventas_anuales: Number(algoritmo_v?.v_alritmo) === 2 ? 0 : rotacion_ctas_x_cobrar.costo_ventas_anuales,
        saldo_cliente_cuenta_x_cobrar: rotacion_ctas_x_cobrar.saldo_cliente_cuenta_x_cobrar,
        limite_inferior_dio: Number(algoritmo_v?.v_alritmo) === 2 ? 0 : rotacion_ctas_x_cobrar.limite_inferior_dio,
        limite_superior_dio: Number(algoritmo_v?.v_alritmo) === 2 ? 0 : rotacion_ctas_x_cobrar.limite_superior_dio,
        limite_inferior_dso: Number(algoritmo_v?.v_alritmo) === 2 ? 0 : rotacion_ctas_x_cobrar.limite_inferior_dso,
        limite_superior_dso: Number(algoritmo_v?.v_alritmo) === 2 ? 0 : rotacion_ctas_x_cobrar.limite_superior_dso,
        limite_inferior: Number(algoritmo_v?.v_alritmo) === 2 ? 0 : rotacion_ctas_x_cobrar.limite_inferior_dio,
        limite_superior: Number(algoritmo_v?.v_alritmo) === 2 ? 0 : rotacion_ctas_x_cobrar.limite_superior_dio == null ? 'null' : rotacion_ctas_x_cobrar.limite_superior_dio,
        explicacion: `${rotacion_ctas_x_cobrar.explicacion}`,
        metricUsed: rotacion_ctas_x_cobrar.metricUsed,
        metricScoreUsed: rotacion_ctas_x_cobrar.metricScoreUsed
      }
    }

    logger.info(`${fileMethod} | ${customUuid} Reporte de credito 15: ${JSON.stringify(reporteCredito)}`)

    let dpo = 'N/A'
    if (Number(algoritmo_v?.v_alritmo) !== 2) {
      dpo = await calculaDpo(id_certification, flujo_neto.caja_bancos_periodo_anterior, rotacion_ctas_x_cobrar.dsoMayor90, rotacion_ctas_x_cobrar.dioMayor90)
    }
    reporteCredito.dpo = dpo

    if (referencias_comerciales.error) {
      logger.warn(`${fileMethod} | ${customUuid} No se pudo obtener información para referencias comerciales en la certificación con ID: ${JSON.stringify(referencias_comerciales)}`)
    }

    logger.info(`${fileMethod} | ${customUuid} Referencias comerciales para el algoritmo es: ${JSON.stringify(referencias_comerciales)}`)

    reporteCredito._16_referencias_comerciales = {
      descripcion: referencias_comerciales.descripcion || '',
      score: referencias_comerciales.score !== undefined ? String(referencias_comerciales.score) : '0'
    }

    let referencias_consideradas = []
    let referencias_descartadas = []
    try {
      const todasRaw = await certificationService.getReferenciasComercialesByIdCertification(id_certification)

      const uniqueBy = (arr, keyFn) => {
        const seen = new Set()
        return (arr || []).filter(item => {
          const k = keyFn(item)
          if (seen.has(k)) return false
          seen.add(k)
          return true
        })
      }

      const todas = uniqueBy(todasRaw, r => r.id_certification_referencia_comercial)

      const fetchEmpresaData = async ref => {
        const [empresa] = await certificationService.getEmpresaClienteByIdCertification(ref.id_certification_referencia_comercial)
        return {
          calificacion_referencia: empresa?.calificacion_referencia || null,
          linea_credito: empresa?.linea_credito || null,
          porcentaje_deuda: empresa?.porcentaje_deuda || null,
          dias_atraso: empresa?.dias_atraso || null
        }
      }

      const esConsiderada = r =>
        r.contestada === 'si' &&
        r.referencia_valida === 'true' &&
        (!r.estatus_referencia || r.estatus_referencia !== 'vencida') &&
        (!r.observaciones || r.observaciones.trim() === '')

      referencias_consideradas = uniqueBy(
        await Promise.all(
          todas
            .filter(esConsiderada)
            .map(async r => ({
              ...r,
              ...(await fetchEmpresaData(r))
            }))
        ),
        x => x.id_certification_referencia_comercial
      )

      referencias_descartadas = uniqueBy(
        await Promise.all(
          todas
            .filter(r => !esConsiderada(r))
            .map(async r => {
              let motivo = ''
              if (r.contestada !== 'si') motivo = 'No contestada'
              else if (r.estatus_referencia === 'vencida') motivo = 'Vencida'
              else if (r.referencia_valida !== 'true') motivo = r.observaciones || 'No válida'
              else if (r.observaciones) motivo = r.observaciones
              else motivo = r.estatus_referencia || 'No válida'
              return {
                ...r,
                ...(await fetchEmpresaData(r)),
                motivo_descartada: motivo
              }
            })
        ),
        x => x.id_certification_referencia_comercial
      )
    } catch (err) {
      logger.warn(`${fileMethod} | ${customUuid} Error obteniendo referencias para correo: ${err}`)
    }

    logger.info(`${fileMethod} | ${customUuid} Reporte de credito 16: ${JSON.stringify(reporteCredito)}`)

    let porcentaje_endeudamiento_comercial = null
    let promedio_plazo_credito = null
    if (alerta_endeudamiento_comercial.error) {
      logger.info(`${fileMethod} | ${customUuid} No se obtuvo alerta de endeudamiento comercial : ${JSON.stringify(alerta_endeudamiento_comercial)}`)
    } else {
      porcentaje_endeudamiento_comercial = alerta_endeudamiento_comercial
    }
    if (alerta_promedio_plazo_credito.error) {
      logger.info(`${fileMethod} | ${customUuid} No se obtuvo alerta de endeudamiento comercial : ${JSON.stringify(alerta_promedio_plazo_credito)}`)
    } else {
      promedio_plazo_credito = alerta_promedio_plazo_credito
    }

    reporteCredito.alertas = {
      descripcion_endeudamiento: alerta_endeudamiento_comercial.descripcion,
      porcentaje_endeudamiento: alerta_endeudamiento_comercial.porcentaje,
      texto_reporte_endeudamiento: alerta_endeudamiento_comercial.texto_reporte,
      dias_plazo_credito: alerta_promedio_plazo_credito.dias,
      texto_reporte_plazo_credito: alerta_promedio_plazo_credito.texto_reporte

    }

    const scores = {
      paisScore: pais.valor_algoritmo,
      sectorRiesgoScore: sector_riesgo.valor_algoritmo,
      capitalContableScore: Number(algoritmo_v?.v_alritmo) === 2 ? '0' : capital_contable.score,
      plantillaLaboralScore: plantilla_laboral.score,
      sectorClienteFinalScore: sector_cliente_final.valor_algoritmo,
      tiempoActividadScore: tiempo_actividad.valor_algoritmo,
      influenciaControlanteScore: influencia_controlante.score, //'Pendiente de consumo de api con información de investigacion ante el SAT'// Influencia de empresa controlante
      ventasAnualesScore: Number(algoritmo_v?.v_alritmo) === 2 ? '0' : ventas_anuales.score,
      tipoCifrasScore: reporteCredito._09_tipo_cifras?.score,
      incidenciasLegalesScore: incidencias_legales.score,
      evolucionVentasScore: Number(algoritmo_v?.v_alritmo) === 2 ? '0' : evolucion_ventas.score,
      apalancamientoScore: Number(algoritmo_v?.v_alritmo) === 2 ? '0' : apalancamiento.score,
      flujoNetoScore: Number(algoritmo_v?.v_alritmo) === 2 ? '0' : flujo_neto.score,
      paybackScore: Number(algoritmo_v?.v_alritmo) === 2 ? '0' : payback.score,
      rotacionCtasXCobrarScore: Number(algoritmo_v?.v_alritmo) === 2 ? '0' : rotacion_ctas_x_cobrar.score,
      referenciasProveedoresScore: referencias_comerciales.score,
    }

    logger.info(`${fileMethod} | ${customUuid} Los scors resultantes para el algoritmo son: ${JSON.stringify(scores)}`)

    const g45 = SCORE_KEYS.reduce((acc, key) => {
      const val = parseFloat(scores[SCORE_KEY_MAP[key]])
      return Number.isNaN(val) ? acc : acc + val
    }, 0)

    logger.info(`${fileMethod} | ${customUuid} G45: Sumatoria de scors: ${g45}`)
    scores.sumatoria_scors_g45 = g45
    scores.customUuid = customUuid

    const c46 = monto_solicitado
    logger.info(`${fileMethod} | ${customUuid} C46: Monto solicitado: ${c46}`)
    scores.c46 = c46

    const g46 = g45 * algorithmConstants.logitFactor + algorithmConstants.logitConstant
    logger.info(`${fileMethod} | ${customUuid} G46: Resultado de la operacion  G45 * ${algorithmConstants.logitFactor} + ${algorithmConstants.logitConstant} ${g46}`)
    scores.g46 = g46

    const g49 = parseFloat((1 / (1 + Math.exp(-g46))).toFixed(4))
    logger.info(`${fileMethod} | ${customUuid} G49: Resultado de la operacion  (1 / (1 + EXP(-g46))) ${g49}`)
    scores.g49 = g49

    const g48 = 1 - g49
    logger.info(`${fileMethod} | ${customUuid} G48: Resultado de la operacion  1 - g49 ${g48}`)
    scores.g48 = g48

    const g51 = g48 * 100
    logger.info(`${fileMethod} | ${customUuid} G51: Resultado de la operacion  g48 * 100 ${g51}`)
    scores.g51 = g51

    const g52 = await certificationService.getClass(g51)
    logger.info(`${fileMethod} | ${customUuid} Se obtiene la clase de acuerdo al resultado de G51  ${g52}`)
    scores.g52 = g52

    const wu = await certificationService.getWordingUnderwriting(g52)
    logger.info(`${fileMethod} | ${customUuid} De acuerdo a la clase obtenida en G52 se obtiene de WORDING UNDERWRITING la sguiente conclusión  ${JSON.stringify(wu)}`)
    scores.wu = wu

    const porcentajeLc = await certificationService.getScoreLc(g52)
    logger.info(`${fileMethod} | ${customUuid} Se obtiene el porcentaje LC  ${porcentajeLc}`)

    const c48 = (porcentajeLc / 100) * c46
    logger.info(`${fileMethod} | ${customUuid} C48: Monto de linea sugerida  ${c48}`)
    scores.c48 = c48

    const rangosBD = await certificationService.getAllAlgorithmRanges()

    reporteCredito.monto_solicitado = monto_solicitado
    reporteCredito.plazo = plazo
    reporteCredito.monto_sugerido = c48
    reporteCredito.score = wu.score
    reporteCredito.wording_underwriting = wu.wording_underwriting

    logger.info(`${fileMethod} | ${customUuid} El ID del cliente para la empresa es: ${JSON.stringify(id_cliente)}`)

    const [calculos_estado_balance, calculos_estado_resultados] = await Promise.all([
      calculoEstadoBalance(customUuid, id_certification),
      calculosEstadoResultados(customUuid, id_certification)
    ])
    const [ratio_financiero, alerta_preventiva_reserva] = await Promise.all([
      calculoRatiosFinancieros(customUuid, id_certification, calculos_estado_balance, calculos_estado_resultados),
      calculoVariacionesSignificativasIndicadoresFinancieros(customUuid, id_certification, calculos_estado_balance, calculos_estado_resultados)
    ])

    reporteCredito.alerta_preventiva_reserva = alerta_preventiva_reserva
    reporteCredito.calculos_estado_balance = calculos_estado_balance
    reporteCredito.calculos_estado_resultados = calculos_estado_resultados
    reporteCredito.ratio_financiero = ratio_financiero

    const emailReporteResumenEmail = await sendEmailNodeMailer({
      info_email: {
        scores,
        rangos: reporteCredito,
        razon_algoritmo: algoritmo_v.reason,
        version_algoritmo: algoritmo_v.v_alritmo,
        customUuid,
        referencias_consideradas,
        referencias_descartadas
      },
      rangos_bd: rangosBD,
      id_certification,
      req_body: body
    })
    logger.info(`${fileMethod} | ${customUuid} | Resultado del envío de correo: ${JSON.stringify(emailReporteResumenEmail)}`)
    logger.info(`${fileMethod} | ${customUuid} | Resumen de reporte de credito ejecutado: ${JSON.stringify(scores)}`)

    await certificationService.updateSolicitudCredito(monto_solicitado, plazo, id_reporte_credito)

    // Ejecutar generación de PDF y envío de correo de forma asíncrona
    processReporteCreditoAsync({
      customUuid,
      id_cliente,
      id_proveedor,
      id_reporte_credito,
      reporteCredito,
      id_certification
    }).catch(err => {
      logger.error(`${fileMethod} | ${customUuid} Error en proceso asíncrono: ${err.message}`)
    })

    return res.json({
      error: false,
      paisScore: scores.paisScore,
      sectorRiesgoScore: scores.sectorRiesgoScore,
      capitalContableScore: scores.capitalContableScore,
      plantillaLaboralScore: scores.plantillaLaboralScore,
      sectorClienteFinalScore: scores.sectorClienteFinalScore,
      tiempoActividadScore: scores.tiempoActividadScore,
      influenciaControlanteScore: scores.influenciaControlanteScore,
      ventasAnualesScore: scores.ventasAnualesScore,
      tipoCifrasScore: scores.tipoCifrasScore,
      incidenciasLegalesScore: scores.incidenciasLegalesScore,
      evolucionVentasScore: scores.evolucionVentasScore,
      apalancamientoScore: scores.apalancamientoScore,
      flujoNetoScore: scores.flujoNetoScore,
      paybackScore: scores.paybackScore,
      rotacionCtasXCobrarScore: scores.rotacionCtasXCobrarScore,
      referenciasProveedoresScore: scores.referenciasProveedoresScore,
      g45,
      g46,
      g49,
      g48,
      g51,
      g52,
      wu,
      c48,
      reporteCredito,
      parametrosAlgoritmo,
      alertas: {
        porcentaje_endeudamiento_comercial,
        promedio_plazo_credito
      }
    })
  } catch (error) {
    const errorJSON = serializeError(error)
    errorJSON.origenError = `Error en catch del metodo: ${fileMethod}`
    errorJSON.customUuid = customUuid
    const emailError = await sendEmailNodeMailer({
      info_email_error: errorJSON,
      req_body: body
    })
    logger.info(`${fileMethod} | Error al enviar correo electronico: ${JSON.stringify(emailError)}`)
    logger.error(`${fileMethod} | Error reporte de credito final: ${JSON.stringify(error)}`)
    next(error)
  }
}

function serializeError(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code || null,
      cause: error.cause || null
    };
  }
  return error
}


const sendEmailNodeMailer = async ({
  info_email_error = null,
  info_email = null,
  rangos_bd = null,
  id_certification = null,
  req_body = null
}) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: sendEmailNodeMailer`
  try {
    const globalConfig = await utilitiesService.getParametros()

    let lista_contactos_error_reporte_credito = await globalConfig.find(
      item => item.nombre === 'lista_contactos_error_reporte_credito'
    ).valor
    if (typeof lista_contactos_error_reporte_credito === 'string') {
      try {
        lista_contactos_error_reporte_credito = JSON.parse(lista_contactos_error_reporte_credito.trim())
      } catch (err) {
        logger.error(`${fileMethod} | Error al parsear lista de contactos: ${err.message}`)
        return
      }
    }


    let email_sender_error_reporte_credito = await globalConfig.find(
      item => item.nombre === 'email_sender_error_reporte_credito'
    ).valor

    let password_email_sender_error_reporte_credito = await globalConfig.find(
      item => item.nombre === 'password_email_sender_error_reporte_credito'
    ).valor

    const transporter = nodemailer.createTransport({
      host: 'credibusiness.com',
      port: 465,
      secure: true,
      auth: {
        user: email_sender_error_reporte_credito,
        pass: password_email_sender_error_reporte_credito
      }
    })

    let partidasFinancierasBalance = []
    let partidasFinancierasResultados = []
    const attachments = []

    if (id_certification) {
      try {
        const partidas = await certificationService.getCertificacionPartidaFinanciera(id_certification)
        const data = partidas?.result || []
        const balanceMap = new Map()
        const resultadosMap = new Map()
        data.forEach(obj => {
          const tipoBalance = obj.tipo_periodo_estado_balance
          const tipoResultados = obj.tipo_periodo_estado_resultados
          if (tipoBalance && !balanceMap.has(tipoBalance)) {
            balanceMap.set(tipoBalance, {
              tipo_periodo_estado_balance: tipoBalance,
              ...obj
            })
          }
          if (tipoResultados && !resultadosMap.has(tipoResultados)) {
            resultadosMap.set(tipoResultados, {
              tipo_periodo_estado_resultados: tipoResultados,
              ...obj
            })
          }
        })
        partidasFinancierasBalance = Array.from(balanceMap.values())
        partidasFinancierasResultados = Array.from(resultadosMap.values())
      } catch (err) {
        logger.error(`${fileMethod} | Error al obtener partidas financieras: ${err.message}`)
      }
    }

    let htmlContent = ''
    let subject = ''

    if (info_email_error) {
      subject = '🚨 Error en el reporte de crédito'
      htmlContent = `
        <div style="font-family: Arial, Helvetica, sans-serif; font-size: 10px; line-height: 1.6; color: #333;">
          <h3 style="font-size: 10px; color: #d9534f; margin: 0 0 8px 0;">⚠ Información de Error</h3>
          <pre style="
            background-color: #f5f5f5;
            padding: 10px;
            border: 1px solid #ddd;
            overflow-x: auto;
            white-space: pre;
          ">
${JSON.stringify(info_email_error, null, 2)}
          </pre>
        </div>
      `
    } else if (info_email) {
      subject = '📄 Información del reporte de crédito'
      const {
        scores = {},
        rangos = {},
        razon_algoritmo = '',
        version_algoritmo = '',
        customUuid: uuid = ''
      } = info_email

      let clienteNombre = ''
      let proveedorNombre = ''
      try {
        const { id_cliente, id_proveedor } = req_body || {}
        if (id_cliente) {
          const clienteInfo = await certificationService.consultaEmpresaInfo(id_cliente)
          clienteNombre = clienteInfo?.result?.[0]?.emp_razon_social || '-'
        }
        if (id_proveedor) {
          const proveedorInfo = await certificationService.consultaEmpresaInfo(id_proveedor)
          proveedorNombre = proveedorInfo?.result?.[0]?.emp_razon_social || '-'
        }
      } catch (err) {
        logger.error(`${fileMethod} | Error obteniendo datos de empresas: ${err.message}`)
      }

      const empresasTabla = `
        <table style="border-collapse: collapse; width: 100%; margin-bottom: 10px; font-size: 10px; page-break-inside: avoid; break-inside: avoid;">
          <tbody>
            <tr>
              <td style="padding: 6px 8px; border: 1px solid #ddd;">Comprador</td>
              <td style="padding: 6px 8px; border: 1px solid #ddd;">${clienteNombre}</td>
            </tr>
            <tr>
              <td style="padding: 6px 8px; border: 1px solid #ddd;">Vendedor</td>
              <td style="padding: 6px 8px; border: 1px solid #ddd;">${proveedorNombre}</td>
            </tr>
          </tbody>
        </table>
      `


      const moneyFormatterAlg = new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
      })
      const formatMoneyAlg = value => {
        const num = Number(value)
        return isNaN(num) ? null : moneyFormatterAlg.format(num)
      }

      const balAnterior = partidasFinancierasBalance.find(
        p => p.tipo_periodo_estado_balance === 'anterior'
      ) || {}
      const balPrevio = partidasFinancierasBalance.find(
        p => p.tipo_periodo_estado_balance === 'previo_anterior'
      ) || {}

      const val = (v, periodo) => {
        const fm = formatMoneyAlg(v)
        return fm ?? `<span style="color: red;">Sin dato en ${periodo}</span>`
      }

      const capitalAnterior = val(balAnterior.capital_contable, 'periodo anterior')
      const capitalPrevio = val(balPrevio.capital_contable, 'periodo previo anterior')
      const cajaAnterior = val(balAnterior.caja_bancos, 'periodo anterior')
      const cajaPrevio = val(balPrevio.caja_bancos, 'periodo previo anterior')
      const invAnterior = val(balAnterior.saldo_inventarios, 'periodo anterior')
      const invPrevio = val(balPrevio.saldo_inventarios, 'periodo previo anterior')
      const cxcAnterior = val(balAnterior.saldo_cliente_cuenta_x_cobrar, 'periodo anterior')
      const cxcPrevio = val(balPrevio.saldo_cliente_cuenta_x_cobrar, 'periodo previo anterior')

      const provAnterior = val(balAnterior.proveedores, 'periodo anterior')
      const provPrevio = val(balPrevio.proveedores, 'periodo previo anterior')
      const acreAnterior = val(balAnterior.acreedores, 'periodo anterior')
      const acrePrevio = val(balPrevio.acreedores, 'periodo previo anterior')

      const resAnterior = partidasFinancierasResultados.find(
        p => p.tipo_periodo_estado_resultados === 'anterior'
      ) || {}
      const resPrevio = partidasFinancierasResultados.find(
        p => p.tipo_periodo_estado_resultados === 'previo_anterior'
      ) || {}

      const ventasAnterior = val(resAnterior.ventas_anuales, 'periodo anterior')
      const ventasPrevio = val(resPrevio.ventas_anuales, 'periodo previo anterior')
      const costoAnterior = val(resAnterior.costo_ventas_anuales, 'periodo anterior')
      const costoPrevio = val(resPrevio.costo_ventas_anuales, 'periodo previo anterior')
      const utilidadBrutaAnterior = val(resAnterior.utilidad_bruta, 'periodo anterior')
      const utilidadBrutaPrevio = val(resPrevio.utilidad_bruta, 'periodo previo anterior')
      const utilidadOperativaAnterior = val(resAnterior.utilidad_operativa, 'periodo anterior')
      const utilidadOperativaPrevio = val(resPrevio.utilidad_operativa, 'periodo previo anterior')
      const utilidadNetaAnterior = val(resAnterior.utilidad_neta, 'periodo anterior')
      const utilidadNetaPrevio = val(resPrevio.utilidad_neta, 'periodo previo anterior')

      const extractYear = str => {
        const match = /(\d{4})/.exec(str || '')
        return match ? match[1] : str || '-'
      }

      const periodoAnterior = balAnterior.perioro_anterior_estado_balance || partidasFinancierasBalance[0]?.perioro_anterior_estado_balance
      const periodoPrevio = balPrevio.perioro_previo_anterior_estado_balance || partidasFinancierasBalance[0]?.perioro_previo_anterior_estado_balance
      const yearAnterior = extractYear(periodoAnterior)
      const yearPrevio = extractYear(periodoPrevio)

      const normalizeNumber = value => {
        if (value === undefined || value === null) return NaN
        const cleaned = String(value).replace(/[$,\s]/g, '')
        return Number(cleaned)
      }

      const isMissing = v => {
        if (v === undefined || v === null) return true
        const str = String(v).trim()
        if (str === '' || str.toLowerCase() === 'n/a') return true
        const num = normalizeNumber(str)
        return isNaN(num)
      }
      const isZero = v => normalizeNumber(v) === 0
      const resCapital =
        isMissing(balAnterior.capital_contable) ||
        isMissing(balPrevio.capital_contable)

      const resCaja =
        isMissing(balAnterior.caja_bancos) || isMissing(balPrevio.caja_bancos)

      const resClientesInv =
        isMissing(balAnterior.saldo_cliente_cuenta_x_cobrar) ||
        isMissing(balAnterior.saldo_inventarios) ||
        isMissing(balPrevio.saldo_cliente_cuenta_x_cobrar) ||
        isMissing(balPrevio.saldo_inventarios) ||
        isZero(balAnterior.saldo_cliente_cuenta_x_cobrar) ||
        isZero(balAnterior.saldo_inventarios) ||
        isZero(balPrevio.saldo_cliente_cuenta_x_cobrar) ||
        isZero(balPrevio.saldo_inventarios)

      const resProvAcre =
        (isMissing(balAnterior.proveedores) || isZero(balAnterior.proveedores)) &&
        (isMissing(balAnterior.acreedores) || isZero(balAnterior.acreedores)) &&
        (isMissing(balPrevio.proveedores) || isZero(balPrevio.proveedores)) &&
        (isMissing(balPrevio.acreedores) || isZero(balPrevio.acreedores))
      const resVentas =
        isMissing(resAnterior.ventas_anuales) ||
        isMissing(resPrevio.ventas_anuales) ||
        isZero(resAnterior.ventas_anuales) ||
        isZero(resPrevio.ventas_anuales)
      const resCosto =
        isMissing(resAnterior.costo_ventas_anuales) ||
        isMissing(resPrevio.costo_ventas_anuales) ||
        isZero(resAnterior.costo_ventas_anuales) ||
        isZero(resPrevio.costo_ventas_anuales)
      const resUBruta =
        isMissing(resAnterior.utilidad_bruta) ||
        isMissing(resPrevio.utilidad_bruta) ||
        isZero(resAnterior.utilidad_bruta) ||
        isZero(resPrevio.utilidad_bruta)
      const resUOperativa =
        isMissing(resAnterior.utilidad_operativa) ||
        isMissing(resPrevio.utilidad_operativa) ||
        isZero(resAnterior.utilidad_operativa) ||
        isZero(resPrevio.utilidad_operativa)
      const resUNeta =
        isMissing(resAnterior.utilidad_neta) ||
        isMissing(resPrevio.utilidad_neta) ||
        isZero(resAnterior.utilidad_neta) ||
        isZero(resPrevio.utilidad_neta)


      const msgSin = c => (c ? '✅ Se cumple la condición. Se ejecuta algoritmo sin EEFF.' : '❌ No se cumple la condición.')
      const msgV2 = c => (c ? '✅ Se cumple la condición. Se ejecuta algoritmo V2.' : '❌ No se cumple la condición.')

      const validacionesVersionTable = `
        <h3 style="font-size: 9px; font-family: 'Segoe UI', Arial, sans-serif;">Validaciones para selección de versión de algoritmo</h3>
        <table border="1" cellspacing="0" cellpadding="6" style="border-collapse: collapse; width: 100%; font-family: 'Segoe UI', Arial, sans-serif; font-size: 9px;">
          <thead style="background-color: #f2f2f2;">
            <tr>
              <th>N°</th>
              <th style="background-color: #000; color: #fff;">Variable condicionante</th>
              <th>Periodo anterior (${yearAnterior})</th>
              <th>Periodo previo anterior (${yearPrevio})</th>
              <th>Resultado</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td style="background-color: #000; color: #fff;">Capital<br>Periodo anterior: Con al menos no tener un período contable se va a algoritmo sin EEFF<br>Periodo previo anterior: Con al menos no tener un período contable se va a algoritmo sin EEFF</td>
              <td><strong>Capital:</strong> ${capitalAnterior}</td>
              <td><strong>Capital:</strong> ${capitalPrevio}</td>
              <td>${msgSin(resCapital)}</td>
            </tr>
            <tr>
              <td>2</td>
              <td style="background-color: #000; color: #fff;">Caja y bancos<br>Periodo anterior: Con al menos no tener un período contable se va a algoritmo sin EEFF<br>Periodo previo anterior: Con al menos no tener un período contable se va a algoritmo sin EEFF</td>
              <td><strong>Caja y bancos:</strong> ${cajaAnterior}</td>
              <td><strong>Caja y bancos:</strong> ${cajaPrevio}</td>
              <td>${msgSin(resCaja)}</td>
            </tr>
            <tr>
              <td>3</td>
              <td style="background-color: #000; color: #fff;">Clientes y cuentas por cobrar<br>Periodo anterior: Con no tener este + Inventarios en cualquier período contable, se va a algoritmo sin EEFF<br>Periodo previo anterior: Con no tener este + Inventarios en cualquier período contable, se va a algoritmo sin EEFF</td>
              <td><strong>Clientes y CxC:</strong> ${cxcAnterior}<br><strong>Inventarios:</strong> ${invAnterior}</td>
              <td><strong>Clientes y CxC:</strong> ${cxcPrevio}<br><strong>Inventarios:</strong> ${invPrevio}</td>
              <td>${msgSin(resClientesInv)}</td>
            </tr>
            <tr>
              <td>4</td>
              <td style="background-color: #000; color: #fff;">Proveedores (PARTIDA 13) + Acreedores y préstamos bancarios (PARTIDA 14)<br>Si ambas partidas están en ceros en ambos periodos contables, se va a algoritmo versión 2.<br>Si al menos uno de los dos rubros reporta 1 peso o más en cualquiera de los dos periodos, se va a algoritmo versión 1.</td>
              <td><strong>Proveedores:</strong> ${provAnterior}<br><strong>Acreedores:</strong> ${acreAnterior}</td>
              <td><strong>Proveedores:</strong> ${provPrevio}<br><strong>Acreedores:</strong> ${acrePrevio}</td>
              <td>${msgV2(resProvAcre)}</td>
            </tr>
            <tr>
              <td>5</td>
              <td style="background-color: #000; color: #fff;">Ventas (PARTIDA 27)<br>No presenta esta partida en al menos un período contable.</td>
              <td><strong>Ventas:</strong> ${ventasAnterior}</td>
              <td><strong>Ventas:</strong> ${ventasPrevio}</td>
              <td>${msgV2(resVentas)}</td>
            </tr>
            <tr>
              <td>6</td>
              <td style="background-color: #000; color: #fff;">No presenta Costo de Ventas (PARTIDA 28) en al menos un cierre contable.</td>
              <td><strong>Costo de ventas:</strong> ${costoAnterior}</td>
              <td><strong>Costo de ventas:</strong> ${costoPrevio}</td>
              <td>${msgV2(resCosto)}</td>
            </tr>
            <tr>
              <td>7</td>
              <td style="background-color: #000; color: #fff;">No presenta Utilidad Bruta (PARTIDA 29) en al menos un cierre contable.</td>
              <td><strong>Utilidad bruta:</strong> ${utilidadBrutaAnterior}</td>
              <td><strong>Utilidad bruta:</strong> ${utilidadBrutaPrevio}</td>
              <td>${msgV2(resUBruta)}</td>
            </tr>
            <tr>
              <td>8</td>
              <td style="background-color: #000; color: #fff;">Utilidad Operativa (PARTIDA 31)<br>No presenta esta partida en al menos un período contable.</td>
              <td><strong>Utilidad operativa:</strong> ${utilidadOperativaAnterior}</td>
              <td><strong>Utilidad operativa:</strong> ${utilidadOperativaPrevio}</td>
              <td>${msgV2(resUOperativa)}</td>
            </tr>
            <tr>
              <td>9</td>
              <td style="background-color: #000; color: #fff;">Utilidad Neta (PARTIDA 37)<br>No presenta esta partida en al menos un período contable.</td>
              <td><strong>Utilidad neta:</strong> ${utilidadNetaAnterior}</td>
              <td><strong>Utilidad neta:</strong> ${utilidadNetaPrevio}</td>
              <td>${msgV2(resUNeta)}</td>
            </tr>
          </tbody>
        </table>
      `
      const scoreLcData = await certificationService.getAllScoreLc().catch(() => [])
      const scoreLcRows = Array.isArray(scoreLcData)
        ? scoreLcData
          .map(
            ({ score, porcentaje_lc }, idx) => `
          <tr style="background-color:${idx % 2 === 0 ? '#ffffff' : '#f5f5f5'};">
            <td style="padding: 6px 8px; border: 1px solid #ddd;">${score}</td>
            <td style="padding: 6px 8px; border: 1px solid #ddd;">${porcentaje_lc}%</td>
          </tr>`
          )
          .join('')
        : ''

      const scoreClassData = await certificationService
        .getAllScoreClasses()
        .catch(() => ({ table1: [], table2: [], table3: [] }))
      const { table1: scoreClassA, table2: scoreClassB, table3: scoreClassC } = scoreClassData
      const buildRows = data =>
        Array.isArray(data)
          ? data
            .map(
              ({ score_min, score_max, class: clase }, idx) => `
          <tr style="background-color:${idx % 2 === 0 ? '#ffffff' : '#f5f5f5'};">
            <td style="padding: 6px 8px; border: 1px solid #ddd;">${score_min} - ${score_max}</td>
            <td style="padding: 6px 8px; border: 1px solid #ddd;">${clase}</td>
          </tr>`
            )
            .join('')
          : ''
      const scoreClassRowsA = buildRows(scoreClassA)
      const scoreClassRowsB = buildRows(scoreClassB)
      const scoreClassRowsC = buildRows(scoreClassC)


      const scoreDescripcionData =
        (rangos_bd && rangos_bd.cat_score_descripcion_algoritmo) || []
      const scoreDescripcionRows = Array.isArray(scoreDescripcionData)
        ? scoreDescripcionData
          .map(
            ({ score, wording_underwriting, porcentaje_lc }, idx) => `
          <tr style="background-color:${idx % 2 === 0 ? '#ffffff' : '#f5f5f5'};">
            <td style="padding: 6px 8px; border: 1px solid #ddd;">${score}</td>
            <td style="padding: 6px 8px; border: 1px solid #ddd;">${wording_underwriting}</td>
            <td style="padding: 6px 8px; border: 1px solid #ddd;">${porcentaje_lc}%</td>
          </tr>`
          )
          .join('')
        : ''

      const scoreTables = `
        <div class="table-section">
        <table border="1" cellspacing="0" cellpadding="6" style="border-collapse: collapse; width: 100%; font-family: Arial, Helvetica, sans-serif; font-size: 10px;">
          <caption>score_classes_a</caption>
          <thead style="background-color: #f2f2f2;">
            <tr>
              <th style="background-color: #000; color: #fff;">Score</th>
              <th>Clase</th>
            </tr>
          </thead>
          <tbody>
            ${scoreClassRowsA}
          </tbody>
        </table>
        </div>
        <div class="table-section">
        <table border="1" cellspacing="0" cellpadding="6" style="border-collapse: collapse; width: 100%; font-family: Arial, Helvetica, sans-serif; font-size: 10px;">
          <caption>score_classes_b</caption>
          <thead style="background-color: #f2f2f2;">
            <tr>
              <th style="background-color: #000; color: #fff;">Score</th>
              <th>Clase</th>
            </tr>
          </thead>
          <tbody>
            ${scoreClassRowsB}
          </tbody>
        </table>
        </div>
        <div class="table-section">
        <table border="1" cellspacing="0" cellpadding="6" style="border-collapse: collapse; width: 100%; font-family: Arial, Helvetica, sans-serif; font-size: 10px;">
          <caption>score_classes_c</caption>
          <thead style="background-color: #f2f2f2;">
            <tr>
              <th style="background-color: #000; color: #fff;">Score</th>
              <th>Clase</th>
            </tr>
          </thead>
          <tbody>
            ${scoreClassRowsC}
          </tbody>
        </table>
        </div>
        <div class="table-section">
        <table border="1" cellspacing="0" cellpadding="6" style="border-collapse: collapse; width: 100%; font-family: Arial, Helvetica, sans-serif; font-size: 10px;">
          <caption>Score descripción algoritmo</caption>
          <thead style="background-color: #f2f2f2;">
            <tr>
              <th style="background-color: #000; color: #fff;">Score</th>
              <th>Wording underwriting</th>
              <th>% LC</th>
            </tr>
          </thead>
          <tbody>
            ${scoreDescripcionRows}
          </tbody>
        </table>
        </div>
        <div class="table-section">
        <table border="1" cellspacing="0" cellpadding="6" style="border-collapse: collapse; width: 100%; font-family: Arial, Helvetica, sans-serif; font-size: 10px;">
          <caption>Score vs % LC</caption>
          <thead style="background-color: #f2f2f2;">
            <tr>
              <th style="background-color: #000; color: #fff;">Score</th>
              <th>% LC</th>
            </tr>
          </thead>
          <tbody>
            ${scoreLcRows}
          </tbody>
        </table>
        </div>
      `
      const tableMap = {
        _01_pais: 'cat_pais_algoritmo',
        _02_sector_riesgo: 'cat_sector_riesgo_sectorial_algoritmo',
        _03_capital_contable: 'cat_capital_contable_algoritmo',
        _04_plantilla_laboral: 'cat_plantilla_laboral_algoritmo',
        _05_sector_cliente_final: 'cat_sector_clientes_finales_algoritmo',
        _06_tiempo_actividad: 'cat_tiempo_actividad_comercial_algoritmo',
        _07_influencia_controlante: 'cat_influencia_controlante',
        _08_ventas_anuales: 'cat_ventas_anuales_algoritmo',
        _09_tipo_cifras: 'cat_tipo_cifras_algoritmo',
        _10_incidencias_legales: 'cat_incidencias_legales_algoritmo',
        _11_evolucion_ventas: 'cat_evolucion_ventas_algoritmo',
        _12_apalancamiento: 'cat_apalancamiento_algoritmo',
        _13_flujo_neto: 'cat_flujo_neto_caja_algoritmo',
        _14_payback: 'cat_payback_algoritmo',
        _15_rotacion_ctas_x_cobrar: 'cat_rotacion_cuentas_cobrar_algoritmo',
        _16_referencias_comerciales: 'cat_resultado_referencias_proveedores_algoritmo'
      }

      const tableIdMap = {
        _01_pais: 'pais_table',
        _02_sector_riesgo: 'sector_riesgo_table',
        _03_capital_contable: 'capital_contable_table',
        _04_plantilla_laboral: 'plantilla_laboral_table',
        _05_sector_cliente_final: 'sector_cliente_final_table',
        _06_tiempo_actividad: 'tiempo_actividad_table',
        _07_influencia_controlante: 'influencia_controlante_table',
        _08_ventas_anuales: 'ventas_anuales_table',
        _09_tipo_cifras: 'tipo_cifras_table',
        _10_incidencias_legales: 'incidencias_legales_table',
        _11_evolucion_ventas: 'evolucion_ventas_table',
        _12_apalancamiento: 'apalancamiento_table',
        _13_flujo_neto: 'flujo_neto_table',
        _14_payback: 'payback_table',
        _15_rotacion_ctas_x_cobrar: 'rotacion_ctas_table',
        _16_referencias_comerciales: 'referencias_comerciales_table'
      }

      const sectionIdMap = Object.fromEntries(
        Object.keys(tableIdMap).map(k => [k, `${tableIdMap[k].replace('_table', '')}_section`])
      )

      const labelMap = {
        _03_capital_contable: 'Capital contable',
        _08_ventas_anuales: 'Ventas anuales',
        _09_tipo_cifras: 'Tipo de cifras',
        _11_evolucion_ventas: 'Evoluci\u00F3n ventas',
        _12_apalancamiento: 'Apalancamiento',
        _13_flujo_neto: 'Flujo neto',
        _14_payback: 'Payback',
        _15_rotacion_ctas_x_cobrar: 'Rotaci\u00F3n ctas x cobrar'
      }

      const skipTablesV2 = new Set([
        '_03_capital_contable',
        '_08_ventas_anuales',
        '_11_evolucion_ventas',
        '_12_apalancamiento',
        '_13_flujo_neto',
        '_14_payback',
        '_15_rotacion_ctas_x_cobrar'
      ])

      const moneyFormatter = new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
      })
      const formatMoney = value => {
        const num = Number(value)
        return isNaN(num) ? value : moneyFormatter.format(num)
      }
      const formatDays = value => {
        const num = Number(value)
        return isNaN(num) ? value : `${num} d\u00EDas`
      }

      let referenciasConsideradas = info_email.referencias_consideradas || []
      let referenciasDescartadas = info_email.referencias_descartadas || []

      const allReferencias =
        Array.isArray(info_email.referencias)
          ? info_email.referencias
          : [...referenciasConsideradas, ...referenciasDescartadas]

      if (Array.isArray(allReferencias) && allReferencias.length > 0) {
        const uniqueBy = (arr, keyFn) => {
          const seen = new Set()
          return (arr || []).filter(item => {
            const k = keyFn(item)
            if (seen.has(k)) return false
            seen.add(k)
            return true
          })
        }

        const esConsiderada = r =>
          r.contestada === 'si' &&
          r.referencia_valida === 'true' &&
          (!r.estatus_referencia || r.estatus_referencia !== 'vencida') &&
          (!r.observaciones || r.observaciones.trim() === '')

        const motivoDescartada = r => {
          if (r.contestada !== 'si') return 'No contestada'
          if (r.estatus_referencia === 'vencida') return 'Vencida'
          if (r.referencia_valida !== 'true') return r.observaciones || 'No válida'
          if (r.observaciones) return r.observaciones
          return r.estatus_referencia || 'No válida'
        }

        referenciasConsideradas = uniqueBy(
          allReferencias.filter(esConsiderada),
          x => x.id_certification_referencia_comercial
        )

        referenciasDescartadas = uniqueBy(
          allReferencias
            .filter(r => !esConsiderada(r))
            .map(r => ({ ...r, motivo_descartada: motivoDescartada(r) })),
          x => x.id_certification_referencia_comercial
        )
      }

      const buildRefRowsConsideradas = refs =>
        Array.isArray(refs)
          ? refs
            .map(
              (ref, idx) => `
          <tr style="background-color:${idx % 2 === 0 ? '#ffffff' : '#f5f5f5'};">
            <td style="padding: 4px 6px; border: 1px solid #ddd;">${ref.id_certification_referencia_comercial}</td>
            <td style="padding: 4px 6px; border: 1px solid #ddd;">${ref.calificacion_referencia ?? '-'}</td>
            <td style="padding: 4px 6px; border: 1px solid #ddd;">${ref.linea_credito ?? '-'}</td>
            <td style="padding: 4px 6px; border: 1px solid #ddd;">${ref.porcentaje_deuda ?? '-'}</td>
            <td style="padding: 4px 6px; border: 1px solid #ddd;">${ref.dias_atraso ?? '-'}</td>
          </tr>`
            )
            .join('')
          : ''

      const buildRefRowsDescartadas = refs =>
        Array.isArray(refs)
          ? refs
            .map(
              (ref, idx) => `
          <tr style="background-color:${idx % 2 === 0 ? '#ffffff' : '#f5f5f5'};">
            <td style="padding: 4px 6px; border: 1px solid #ddd;">${ref.id_certification_referencia_comercial}</td>
            <td style="padding: 4px 6px; border: 1px solid #ddd;">${ref.rfc ?? '-'}</td>
            <td style="padding: 4px 6px; border: 1px solid #ddd;">${ref.razon_social ?? '-'}</td>
            <td style="padding: 4px 6px; border: 1px solid #ddd;">${ref.estatus_referencia ?? '-'}</td>
            <td style="padding: 4px 6px; border: 1px solid #ddd;">${ref.motivo_descartada || ref.observaciones || '-'}</td>
          </tr>`
            )
            .join('')
          : ''

      const refConsideradasRows = buildRefRowsConsideradas(referenciasConsideradas)
      const refDescartadasRows = buildRefRowsDescartadas(referenciasDescartadas)

      const refConsideradasTable = `
        <div class="table-section">
        <table border="1" cellspacing="0" cellpadding="4" style="border-collapse: collapse; width: 100%; font-family: Arial, Helvetica, sans-serif; font-size: 8px;">
          <caption style="caption-side: top; margin-bottom: 2px;">Referencias comerciales consideradas</caption>
          <thead style="background-color: #f2f2f2;">
            <tr>
              <th style="background-color: #000; color: #fff;">ID</th>
              <th>Calificación</th>
              <th>Línea de crédito</th>
              <th>Porcentaje de deuda</th>
              <th>Días de atraso</th>
            </tr>
          </thead>
          <tbody>
            ${refConsideradasRows}
          </tbody>
        </table>
        </div>`


      const refDescartadasTable = `
        <div class="table-section">
        <table border="1" cellspacing="0" cellpadding="4" style="border-collapse: collapse; width: 100%; font-family: Arial, Helvetica, sans-serif; font-size: 8px;">
          <caption style="caption-side: top; margin-bottom: 2px;">Referencias comerciales descartadas</caption>
          <thead style="background-color: #f2f2f2;">
            <tr>
              <th style="background-color: #000; color: #fff;">ID</th>
              <th>RFC</th>
              <th>Razón social</th>
              <th>Vigencia</th>
              <th>Motivo descarte</th>
            </tr>
          </thead>
          <tbody>
            ${refDescartadasRows}
          </tbody>
        </table>
        </div>`

      const formatField = v =>
        v === null || v === undefined || v === '' ? 'No disponible' : v
      const formatBool = v =>
        v === null || v === undefined || v === ''
          ? 'No disponible'
          : v === true || v === 1 || v === '1' || v === 'true'
            ? 'Sí'
            : 'No'

      const empresaControlanteTable = `
        <div class="table-section" style="margin-bottom: 10px;">
        <h3 style="font-size: 8px;">7. Influencia de Empresa Controlante</h3>
        <table border="1" cellspacing="0" cellpadding="4" style="border-collapse: collapse; width: 100%; font-family: Arial, Helvetica, sans-serif; font-size: 8px;">
          <tbody>
            <tr><td>Empresa Controlante</td><td>${formatField(rangos._07_influencia_controlante_empresa)}</td></tr>
            <tr><td>RFC</td><td>${formatField(rangos._07_influencia_controlante_rfc)}</td></tr>
            <tr><td>Score de Influencia</td><td>${formatField(rangos._07_influencia_controlante_score)}</td></tr>
            <tr><td>Regla Aplicada</td><td>${formatField(rangos._07_influencia_controlante_regla)}</td></tr>
            <tr><td>¿Demandas Penales? (Sí / No)</td><td>${formatBool(rangos._07_influencia_controlante_demandas_penales)}</td></tr>
            <tr><td>¿Demandas Mercantiles Relevantes? (Sí / No)</td><td>${formatBool(rangos._07_influencia_controlante_demandas_mercantiles)}</td></tr>
          </tbody>
        </table>
        </div>`

      const scoresForTable = {
        paisScore: rangos._01_pais?.score,
        sectorRiesgoScore: rangos._02_sector_riesgo?.score,
        capitalContableScore: Number(version_algoritmo) === 2 ? '0' : rangos._03_capital_contable?.score,
        plantillaLaboralScore: rangos._04_plantilla_laboral?.score,
        sectorClienteFinalScore: rangos._05_sector_cliente_final?.score,
        tiempoActividadScore: rangos._06_tiempo_actividad?.score,
        influenciaControlanteScore: rangos._07_influencia_controlante?.score ?? rangos._07_influencia_controlante_score,
        ventasAnualesScore: Number(version_algoritmo) === 2 ? '0' : rangos._08_ventas_anuales?.score,
        tipoCifrasScore: rangos._09_tipo_cifras?.score,
        incidenciasLegalesScore: rangos._10_incidencias_legales?.score,
        evolucionVentasScore: Number(version_algoritmo) === 2 ? '0' : rangos._11_evolucion_ventas?.score,
        apalancamientoScore: Number(version_algoritmo) === 2 ? '0' : rangos._12_apalancamiento?.score,
        flujoNetoScore: Number(version_algoritmo) === 2 ? '0' : rangos._13_flujo_neto?.score,
        paybackScore: Number(version_algoritmo) === 2 ? '0' : rangos._14_payback?.score,
        rotacionCtasXCobrarScore: Number(version_algoritmo) === 2 ? '0' : rangos._15_rotacion_ctas_x_cobrar?.score,
        referenciasProveedoresScore: rangos._16_referencias_comerciales?.score
      }

      const sumatoriaScores =
        scores.sumatoria_scors_g45 !== undefined
          ? scores.sumatoria_scors_g45
          : SCORE_KEYS.reduce((acc, key) => {
            const val = parseFloat(scoresForTable[SCORE_KEY_MAP[key]])
            return Number.isNaN(val) ? acc : acc + val
          }, 0)

      const scoreLabelMap = {
        _01_pais: '1. País score',
        _02_sector_riesgo: '2. Sector riesgo score',
        _03_capital_contable: '3. Capital contable score',
        _04_plantilla_laboral: '4. Plantilla laboral score',
        _05_sector_cliente_final: '5. Sector cliente final score',
        _06_tiempo_actividad: '6. Tiempo actividad score',
        _07_influencia_controlante: '7. Influencia controlante score',
        _08_ventas_anuales: '8. Ventas anuales score',
        _09_tipo_cifras: '9. Tipo de cifras score',
        _10_incidencias_legales: '10. Incidencias legales score',
        _11_evolucion_ventas: '11. Evolución ventas score',
        _12_apalancamiento: '12. Apalancamiento score',
        _13_flujo_neto: '13. Flujo neto score',
        _14_payback: '14. Payback score',
        _15_rotacion_ctas_x_cobrar: '15. Rotación ctas x cobrar score',
        _16_referencias_comerciales: '16. Referencias comerciales score'
      }

      const sumatoriaScoreRows = SCORE_KEYS.map(key => {
        const label = scoreLabelMap[key] || key
        let value = scoresForTable[SCORE_KEY_MAP[key]]
        if (value === undefined || value === null || value === '') {
          value = '-'
        }
        let descripcion = '-'
        if (Number(version_algoritmo) === 2 && Number(value) === 0) {
          descripcion = 'Se ejecuta v2 de algoritmo el score por default es 0'
        } else if (rangos[key] && typeof rangos[key] === 'object') {
          descripcion =
            rangos[key].descripcion ?? rangos[key].caso ?? rangos[key].tipo ?? '-'
        }
        return `<tr style="background:#e3f2fd;"><td>${label}</td><td>${descripcion}</td><td style="color:#0a3d8e; font-weight:bold;">${value}</td></tr>`
      }).join('')

      const sumatoriaScoresTable = `
        <div class="table-section" style="margin-bottom: 10px;">
        <h3 style="font-size: 8px;">Sumatoria de scores</h3>
        <table border="1" cellspacing="0" cellpadding="4" style="border-collapse: collapse; width: 100%; font-family: Arial, Helvetica, sans-serif; font-size: 8px;">
          <thead style="background-color: #f2f2f2;">
            <tr>
              <th style="background-color: #000; color: #fff;">Etiqueta</th>
              <th>¿Qué se evalúa?</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            ${sumatoriaScoreRows}
            <tr style="background:#0a3d8e; color:#fff; font-weight:bold;">
              <td colspan="2">Total</td>
              <td>${sumatoriaScores}</td>
            </tr>
          </tbody>
        </table>
        </div>`

      const detallesTables = Object.entries(rangos)
        .filter(([key, val]) =>
          SCORE_KEYS.includes(key) && val && typeof val === 'object'
        )
        .map(([key, val]) => {
          const skipV2 = Number(version_algoritmo) === 2 && skipTablesV2.has(key)
          const descripcion = val.descripcion ?? val.caso ?? val.tipo ?? '-'
          const score = val.score ?? '-'
          const tableName = tableMap[key]
          if (tableName && rangos_bd && Array.isArray(rangos_bd[tableName])) {
            rangos_bd[tableName].forEach(opt => {
              if (
                descripcion &&
                opt.nombre &&
                opt.nombre.toLowerCase() === descripcion.toLowerCase()
              ) {
                opt.nombre = `<strong>${opt.nombre ?? ''}</strong>`
              }
            })
          }
          const explicacion = val.explicacion
            ? val.explicacion
            : `El ${key.replace(/_/g, ' ')} es ${descripcion}, por eso el score es ${score}`
          let formula = '-'
          if (
            key === '_15_rotacion_ctas_x_cobrar' &&
            val.parametro_dso !== undefined &&
            val.parametro_dio !== undefined &&
            val.limite_inferior_dio !== undefined &&
            val.limite_superior_dio !== undefined &&
            val.limite_inferior_dso !== undefined &&
            val.limite_superior_dso !== undefined
          ) {
            const etiqueta = labelMap[key] || key.replace(/_/g, ' ')
            formula = `${etiqueta}:\nDSO = (Saldo clientes ${formatMoney(val.saldo_cliente_cuenta_x_cobrar)} / Ventas anuales ${formatMoney(val.ventas_anuales)}) * 360 = ${formatDays(val.parametro_dso)}\nDIO = (Saldo inventarios ${formatMoney(val.saldo_inventarios)} / Costo ventas anuales ${formatMoney(val.costo_ventas_anuales)}) * 360 = ${formatDays(val.parametro_dio)}\nL\u00EDmite inferior DSO: ${formatDays(val.limite_inferior_dso)}\nL\u00EDmite superior DSO: ${formatDays(val.limite_superior_dso)}\nL\u00EDmite inferior DIO: ${formatDays(val.limite_inferior_dio)}\nL\u00EDmite superior DIO: ${formatDays(val.limite_superior_dio)}`
          } else if (
            [
              '_08_ventas_anuales',
              '_03_capital_contable',
              '_09_tipo_cifras',
              '_12_apalancamiento',
              '_13_flujo_neto',
              '_14_payback'
            ].includes(key) &&
            val.parametro !== undefined &&
            val.limite_inferior !== undefined &&
            val.limite_superior !== undefined
          ) {
            const etiqueta = labelMap[key] || key.replace(/_/g, ' ')
            if (key === '_12_apalancamiento') {
              formula = `${etiqueta}: ${val.parametro}\nL\u00EDmite inferior: ${val.limite_inferior}\nL\u00EDmite superior: ${val.limite_superior}`
              if (
                val.deuda_total_estado_balance_periodo_anterior !== undefined &&
                val.capital_contable_estado_balance !== undefined
              ) {
                formula += `\nOperaci\u00F3n: ${formatMoney(val.deuda_total_estado_balance_periodo_anterior)} / ${formatMoney(val.capital_contable_estado_balance)}`
              }
            } else {
              formula = `${etiqueta}: ${formatMoney(val.parametro)}\nL\u00EDmite inferior: ${formatMoney(val.limite_inferior)}\nL\u00EDmite superior: ${formatMoney(val.limite_superior)}`
              if (key === '_14_payback') {
                const op = val.operacion
                  ? val.operacion
                  : `${formatMoney(val.deuda_corto_plazo_periodo_anterior)} / ${formatMoney(val.utilida_operativa)}`
                formula += `\nOperaci\u00F3n: ${op}`
              }
            }
          } else if (
            key === '_11_evolucion_ventas' &&
            val.parametro !== undefined &&
            val.rango !== undefined
          ) {
            const etiqueta = labelMap[key] || key.replace(/_/g, ' ')
            formula = `${etiqueta}: ${formatMoney(val.parametro)}\nRango: ${val.rango}`
            if (
              val.ventas_anuales_periodo_anterior_estado_resultados !== undefined &&
              val.ventas_anuales_periodo_previo_anterior_estado_resultados !== undefined
            ) {
              formula += `\nOperaci\u00F3n: (${formatMoney(
                val.ventas_anuales_periodo_anterior_estado_resultados
              )} - ${formatMoney(
                val.ventas_anuales_periodo_previo_anterior_estado_resultados
              )}) / ${formatMoney(
                val.ventas_anuales_periodo_previo_anterior_estado_resultados
              )} * 100`
            }
          }
          let resultado
          if (val.metricUsed && val.metricUsed.valor !== undefined) {
            resultado = val.metricUsed.valor
          } else {
            resultado =
              val.parametro_dso ??
              val.parametro_dio ??
              val.parametro ??
              val.valor ??
              '-'
          }
          const num = key.match(/_(\d+)_/)?.[1]
          const etiqueta = labelMap[key] || key.replace(/^_\d+_/, '').replace(/_/g, ' ')
          let titulo = num ? `${parseInt(num, 10)}. ${etiqueta}` : etiqueta
          if (num && parseInt(num, 10) <= 16) {
            titulo += ' score'
          }
          const tableId = tableIdMap[key]
          const sectionId = sectionIdMap[key]
          let tituloHtml = tableId ? `<a href="#${tableId}">${titulo}</a>` : titulo
          if (skipV2) {
            return `
            <div class="table-section" style="margin-bottom: 10px;">
            <h3 style="font-size: 8px;">${titulo}</h3>
            <p>No se consideran en la version2 del algoritmo</p>
            </div>`
          }
          const rows = []
          if (formula !== '-' && formula !== null && formula !== '') {
            rows.push(`<tr><td>Fórmula utilizada</td><td style="white-space: pre-line;">${formula}</td></tr>`)
          }
          if (key === '_12_apalancamiento') {
            const format = value =>
              value === undefined || value === null ? '-' : formatMoney(value)
            const pasivo = format(
              val.deuda_total_estado_balance_periodo_anterior
            )
            const capital = format(val.capital_contable_estado_balance)
            const formulaResultado = val.operacion
              ? val.operacion
              : `Deuda total (periodo contable anterior): ${pasivo} / ` +
              `Capital contable (periodo contable anterior): ${capital}`
            rows.push(
              `<tr><td>Fórmula del resultado</td><td>${formulaResultado}</td></tr>`
            )
          } else if (key === '_14_payback') {
            if (val.operacion) {
              rows.push(
                `<tr><td>Operación</td><td>${val.operacion}</td></tr>`
              )
            }
          }
          if (resultado !== '-' && resultado !== null && resultado !== '') {
            rows.push(`<tr><td>Resultado obtenido</td><td>${resultado}</td></tr>`)
          }
          rows.push(`<tr style="background:#e3f2fd;"><td>Score asignado</td><td style="color:#0a3d8e; font-weight:bold;">${score}</td></tr>`)
          if (key === '_15_rotacion_ctas_x_cobrar' && val.metricScoreUsed) {
            rows.push(`<tr><td>Métrica usada para score</td><td>${val.metricScoreUsed}</td></tr>`)
          }
          rows.push(`<tr><td>Árbol de decisión aplicado</td><td>${version_algoritmo ? `Árbol V${version_algoritmo}` : '-'}</td></tr>`)
          if (key !== '_15_rotacion_ctas_x_cobrar') {
            rows.push(
              `<tr><td>Observaciones adicionales</td><td style="white-space: pre-line;">${explicacion}</td></tr>`
            )
          }
          let tableHtml = `
            <div class="table-section" style="margin-bottom: 10px;"${sectionId ? ` id="${sectionId}"` : ''}>
            <h3 style="font-size: 8px;">${tituloHtml}</h3>
            ${tableId ? `<p style="font-size:8px;"><a href="#${tableId}">Ver tabla de parámetros</a></p>` : ''}
            <table border="1" cellspacing="0" cellpadding="4" style="border-collapse: collapse; width: 100%; font-family: Arial, Helvetica, sans-serif; font-size: 8px;">
              <tbody>
                ${rows.join('')}
              </tbody>
            </table>
            </div>`
          if (key === '_16_referencias_comerciales') {
            tableHtml += `${sumatoriaScoresTable}${refConsideradasTable}${refDescartadasTable}`
          }
          if (key === '_07_influencia_controlante') {
            tableHtml += empresaControlanteTable
          }
          return tableHtml
        })
        .join('')

      const ratioData = rangos.ratio_financiero || {}
      const balanceData = rangos.calculos_estado_balance || {}
      const resultsData = rangos.calculos_estado_resultados || {}
      const ratioMap = [
        ['r1_capital_trabajo_numero_veces', 'Capital de trabajo (veces)', 'razon_circulante_anterior', 'razon_circulante_previo_anterior', 'R1'],
        ['r2_capital_trabajo_valor_nominal', 'Capital de trabajo (valor nominal)', 'capital_trabajo_anterior', 'capital_trabajo_previo_anterior', 'R2'],
        ['r3_prueba_acida_numero_veces', 'Prueba ácida (veces)', 'prueba_acida_numero_veces_anterior', 'prueba_acida_numero_veces_previo_anterior', 'R3'],
        ['r4_grado_general_endeudamiento_numero_veces', 'Grado de endeudamiento', 'grado_general_endeudamiento_anterior', 'grado_general_endeudamiento_previo_anterior', 'R4'],
        ['r5_apalancamiento_financiero_numero_veces', 'Apalancamiento financiero', 'apalancamiento_anterior', 'apalancamiento_previo_anterior', 'R5'],
        ['r6_rotacion_inventarios_numero_veces', 'Rotación inventarios (veces)', 'rotacion_inventarios_numero_veces_anterior', 'rotacion_inventarios_numero_veces_previo_anterior', 'R6'],
        ['r7_rotacion_inventarios_dias', 'Rotación inventarios (días)', 'rotacion_inventarios_dias_anterior', 'rotacion_inventarios_dias_previo_anterior', 'R7'],
        ['r8_rotacion_cuentas_x_cobrar_dias', 'Rotación cuentas por cobrar (días)', 'rotacion_cuentas_x_cobrar_dias_anterior', 'rotacion_cuentas_x_cobrar_dias_previo_anterior', 'R8'],
        ['r9_rotacion_pagos_dias', 'Rotación de pagos (días)', 'rotacion_pagos_dias_anterior', 'rotacion_pagos_dias_previo_anterior', 'R9'],
        ['r10_solvencia_deuda_total_sobre_capital', 'Solvencia deuda total sobre capital', 'solvencia_deuda_total_sobre_capital_anterior', 'solvencia_deuda_total_sobre_capital_previo_anterior', 'R10'],
        ['r11_retorno_sobre_capital_acciones', 'Retorno sobre capital', 'retorno_sobre_capital_acciones_anterior', 'retorno_sobre_capital_acciones_previo_anterior', 'R11'],
        ['r12_rendimiento_capital', 'Rendimiento sobre capital', 'rendimiento_capital_anterior', 'rendimiento_capital_previo_anterior', 'R12'],
        ['r13_rendimiento_activos', 'Rendimiento sobre activos', 'rendimiento_activos_anterior', 'rendimiento_activos_previo_anterior', 'R13']
      ]
      const formatRatioValue = v => (v === null || v === undefined ? '-' : v)
      const withLabel = (label, value) => `${label}: ${formatMoney(value)}`
      const withValue = value => formatMoney(value)
      const mathStyle =
        "font-family: 'Courier New', monospace; background:#f8f8f8; padding:2px 4px; border-radius:3px;"
      const ratioOps = {
        r1_capital_trabajo_numero_veces: () => {
          const acA = balanceData.total_activo_circulante?.total_activo_circulante_anterior
          const pcA = balanceData.total_pasivo_circulante?.total_pasivo_circulante_anterior
          const acP = balanceData.total_activo_circulante?.total_activo_circulante_previo_anterior
          const pcP = balanceData.total_pasivo_circulante?.total_pasivo_circulante_previo_anterior
          return `Anterior: ${withLabel('Activo circulante', acA)} / ${withLabel('Pasivo circulante', pcA)}<br/>Previo: ${withLabel('Activo circulante', acP)} / ${withLabel('Pasivo circulante', pcP)}`
        },
        r2_capital_trabajo_valor_nominal: () => {
          const acA = balanceData.total_activo_circulante?.total_activo_circulante_anterior
          const pcA = balanceData.total_pasivo_circulante?.total_pasivo_circulante_anterior
          const acP = balanceData.total_activo_circulante?.total_activo_circulante_previo_anterior
          const pcP = balanceData.total_pasivo_circulante?.total_pasivo_circulante_previo_anterior
          return `Anterior: ${withLabel('Activo circulante', acA)} - ${withLabel('Pasivo circulante', pcA)}<br/>Previo: ${withLabel('Activo circulante', acP)} - ${withLabel('Pasivo circulante', pcP)}`
        },
        r3_prueba_acida_numero_veces: () => {
          const acA = balanceData.total_activo_circulante?.total_activo_circulante_anterior
          const invA = balanceData.estado_balance_anterior?.inventarios_anterior
          const pcA = balanceData.total_pasivo_circulante?.total_pasivo_circulante_anterior
          const acP = balanceData.total_activo_circulante?.total_activo_circulante_previo_anterior
          const invP = balanceData.estado_balance_previo_anterior?.inventarios_previo_anterior
          const pcP = balanceData.total_pasivo_circulante?.total_pasivo_circulante_previo_anterior
          return `Anterior: (${withLabel('Activo circulante', acA)} - ${withLabel('Inventarios', invA)}) / ${withLabel('Pasivo circulante', pcA)}<br/>Previo: (${withLabel('Activo circulante', acP)} - ${withLabel('Inventarios', invP)}) / ${withLabel('Pasivo circulante', pcP)}`
        },
        r4_grado_general_endeudamiento_numero_veces: () => {
          const taA = balanceData.total_activo?.total_activo_anterior
          const plA = balanceData.total_pasivo_largo_plazo?.total_pasivo_largo_plazo_anterior
          const taP = balanceData.total_activo?.total_activo_previo_anterior
          const plP = balanceData.total_pasivo_largo_plazo?.total_pasivo_previo_anterior
          return `Anterior: ${withLabel('Total activo', taA)} / ${withLabel('Pasivo largo plazo', plA)}<br/>Previo: ${withLabel('Total activo', taP)} / ${withLabel('Pasivo largo plazo', plP)}`
        },
        r5_apalancamiento_financiero_numero_veces: () => {
          const plA = balanceData.total_pasivo_largo_plazo?.total_pasivo_largo_plazo_anterior
          const taA = balanceData.total_activo?.total_activo_anterior
          const plP = balanceData.total_pasivo_largo_plazo?.total_pasivo_previo_anterior
          const taP = balanceData.total_activo?.total_activo_previo_anterior
          return `Anterior: ${withLabel('Pasivo largo plazo', plA)} / ${withLabel('Total activo', taA)}<br/>Previo: ${withLabel('Pasivo largo plazo', plP)} / ${withLabel('Total activo', taP)}`
        },
        r6_rotacion_inventarios_numero_veces: () => {
          const cvA = resultsData.estado_resultado_anterior?.costo_ventas_anuales_anterior
          const invA = balanceData.estado_balance_anterior?.inventarios_anterior
          const cvP = resultsData.estado_resultado_previo_anterior?.costo_ventas_anuales_previo_anterior
          const invP = balanceData.estado_balance_previo_anterior?.inventarios_previo_anterior
          return `Anterior: ${withLabel('Inventarios', invA)} / ${withLabel('Costo ventas anuales', cvA)}<br/>Previo: ${withLabel('Inventarios', invP)} / ${withLabel('Costo ventas anuales', cvP)}`
        },
        r7_rotacion_inventarios_dias: () => {
          const invA = balanceData.estado_balance_anterior?.inventarios_anterior
          const cvA = resultsData.estado_resultado_anterior?.costo_ventas_anuales_anterior
          const invP = balanceData.estado_balance_previo_anterior?.inventarios_previo_anterior
          const cvP = resultsData.estado_resultado_previo_anterior?.costo_ventas_anuales_previo_anterior
          return `Anterior: (${withLabel('Inventarios', invA)} / ${withLabel('Costo ventas anuales', cvA)}) * 360<br/>Previo: (${withLabel('Inventarios', invP)} / ${withLabel('Costo ventas anuales', cvP)}) * 360`
        },
        r8_rotacion_cuentas_x_cobrar_dias: () => {
          const cliA = balanceData.estado_balance_anterior?.cliente_anterior
          const vtaA = resultsData.estado_resultado_anterior?.ventas_anuales_anterior
          const cliP = balanceData.estado_balance_previo_anterior?.cliente_previo_anterior
          const vtaP = resultsData.estado_resultado_previo_anterior?.ventas_anuales_previo_anterior
          return `Anterior: (${withLabel('Clientes', cliA)} / ${withLabel('Ventas anuales', vtaA)}) * 360<br/>Previo: (${withLabel('Clientes', cliP)} / ${withLabel('Ventas anuales', vtaP)}) * 360`
        },
        r9_rotacion_pagos_dias: () => {
          const provA = balanceData.estado_balance_anterior?.proveedores_anterior
          const acreA = balanceData.estado_balance_anterior?.acreedores_anterior
          const cvA = resultsData.estado_resultado_anterior?.costo_ventas_anuales_anterior
          const provP = balanceData.estado_balance_previo_anterior?.proveedores_previo_anterior
          const acreP = balanceData.estado_balance_previo_anterior?.acreedores_previo_anterior
          const cvP = resultsData.estado_resultado_previo_anterior?.costo_ventas_anuales_previo_anterior
          return `Anterior: (${withLabel('Proveedores', provA)} + ${withLabel('Acreedores', acreA)}) / ${withLabel('Costo ventas anuales', cvA)} * 360<br/>Previo: (${withLabel('Proveedores', provP)} + ${withLabel('Acreedores', acreP)}) / ${withLabel('Costo ventas anuales', cvP)} * 360`
        },
        r10_solvencia_deuda_total_sobre_capital: () => {
          const dtA = balanceData.deuda_total?.deuda_total_anterior
          const ccA = balanceData.total_capital_contable?.total_capital_contable_anterior
          const dtP = balanceData.deuda_total?.deuda_total_previo_anterior
          const ccP = balanceData.total_capital_contable?.total_capital_contable_previo_anterior
          return `Anterior: ${withLabel('Deuda total', dtA)} / ${withLabel('Capital contable', ccA)}<br/>Previo: ${withLabel('Deuda total', dtP)} / ${withLabel('Capital contable', ccP)}`
        },
        r11_retorno_sobre_capital_acciones: () => {
          const uoA = resultsData.utilidad_operacion?.operacion_utilidad_operacion_anterior
          const ccA = balanceData.total_capital_contable?.total_capital_contable_anterior
          const uoP = resultsData.utilidad_operacion?.operacion_utilidad_operacion_previo_anterior
          const ccP = balanceData.total_capital_contable?.total_capital_contable_previo_anterior
          return `Anterior: ${withLabel('Utilidad operaci\u00F3n', uoA)} / ${withLabel('Capital contable', ccA)} * 100<br/>Previo: ${withLabel('Utilidad operaci\u00F3n', uoP)} / ${withLabel('Capital contable', ccP)} * 100`
        },
        r12_rendimiento_capital: () => {
          const unA = resultsData.utilidad_neta?.utilidad_neta_anterior
          const ccA = balanceData.total_capital_contable?.total_capital_contable_anterior
          const unP = resultsData.utilidad_neta?.utilidad_neta_previo_anterior
          const ccP = balanceData.total_capital_contable?.total_capital_contable_previo_anterior
          return `Anterior: ${withLabel('Utilidad neta', unA)} / ${withLabel('Capital contable', ccA)} * 100<br/>Previo: ${withLabel('Utilidad neta', unP)} / ${withLabel('Capital contable', ccP)} * 100`
        },
        r13_rendimiento_activos: () => {
          const unA = resultsData.utilidad_neta?.utilidad_neta_anterior
          const taA = balanceData.total_activo?.total_activo_anterior
          const unP = resultsData.utilidad_neta?.utilidad_neta_previo_anterior
          const taP = balanceData.total_activo?.total_activo_previo_anterior
          return `Anterior: ${withLabel('Utilidad neta', unA)} / ${withLabel('Total activo', taA)} * 100<br/>Previo: ${withLabel('Utilidad neta', unP)} / ${withLabel('Total activo', taP)} * 100`
        }
      }

      const ratioOpsValues = {
        r1_capital_trabajo_numero_veces: () => {
          const acA = balanceData.total_activo_circulante?.total_activo_circulante_anterior
          const pcA = balanceData.total_pasivo_circulante?.total_pasivo_circulante_anterior
          const acP = balanceData.total_activo_circulante?.total_activo_circulante_previo_anterior
          const pcP = balanceData.total_pasivo_circulante?.total_pasivo_circulante_previo_anterior
          return `Anterior: ${withValue(acA)} / ${withValue(pcA)}<br/>Previo: ${withValue(acP)} / ${withValue(pcP)}`
        },
        r2_capital_trabajo_valor_nominal: () => {
          const acA = balanceData.total_activo_circulante?.total_activo_circulante_anterior
          const pcA = balanceData.total_pasivo_circulante?.total_pasivo_circulante_anterior
          const acP = balanceData.total_activo_circulante?.total_activo_circulante_previo_anterior
          const pcP = balanceData.total_pasivo_circulante?.total_pasivo_circulante_previo_anterior
          return `Anterior: ${withValue(acA)} - ${withValue(pcA)}<br/>Previo: ${withValue(acP)} - ${withValue(pcP)}`
        },
        r3_prueba_acida_numero_veces: () => {
          const acA = balanceData.total_activo_circulante?.total_activo_circulante_anterior
          const invA = balanceData.estado_balance_anterior?.inventarios_anterior
          const pcA = balanceData.total_pasivo_circulante?.total_pasivo_circulante_anterior
          const acP = balanceData.total_activo_circulante?.total_activo_circulante_previo_anterior
          const invP = balanceData.estado_balance_previo_anterior?.inventarios_previo_anterior
          const pcP = balanceData.total_pasivo_circulante?.total_pasivo_circulante_previo_anterior
          return `Anterior: (${withValue(acA)} - ${withValue(invA)}) / ${withValue(pcA)}<br/>Previo: (${withValue(acP)} - ${withValue(invP)}) / ${withValue(pcP)}`
        },
        r4_grado_general_endeudamiento_numero_veces: () => {
          const taA = balanceData.total_activo?.total_activo_anterior
          const plA = balanceData.total_pasivo_largo_plazo?.total_pasivo_largo_plazo_anterior
          const taP = balanceData.total_activo?.total_activo_previo_anterior
          const plP = balanceData.total_pasivo_largo_plazo?.total_pasivo_previo_anterior
          return `Anterior: ${withValue(taA)} / ${withValue(plA)}<br/>Previo: ${withValue(taP)} / ${withValue(plP)}`
        },
        r5_apalancamiento_financiero_numero_veces: () => {
          const plA = balanceData.total_pasivo_largo_plazo?.total_pasivo_largo_plazo_anterior
          const taA = balanceData.total_activo?.total_activo_anterior
          const plP = balanceData.total_pasivo_largo_plazo?.total_pasivo_previo_anterior
          const taP = balanceData.total_activo?.total_activo_previo_anterior
          return `Anterior: ${withValue(plA)} / ${withValue(taA)}<br/>Previo: ${withValue(plP)} / ${withValue(taP)}`
        },
        r6_rotacion_inventarios_numero_veces: () => {
          const cvA = resultsData.estado_resultado_anterior?.costo_ventas_anuales_anterior
          const invA = balanceData.estado_balance_anterior?.inventarios_anterior
          const cvP = resultsData.estado_resultado_previo_anterior?.costo_ventas_anuales_previo_anterior
          const invP = balanceData.estado_balance_previo_anterior?.inventarios_previo_anterior
          return `Anterior: ${withValue(invA)} / ${withValue(cvA)}<br/>Previo: ${withValue(invP)} / ${withValue(cvP)}`
        },
        r7_rotacion_inventarios_dias: () => {
          const invA = balanceData.estado_balance_anterior?.inventarios_anterior
          const cvA = resultsData.estado_resultado_anterior?.costo_ventas_anuales_anterior
          const invP = balanceData.estado_balance_previo_anterior?.inventarios_previo_anterior
          const cvP = resultsData.estado_resultado_previo_anterior?.costo_ventas_anuales_previo_anterior
          return `Anterior: (${withValue(invA)} / ${withValue(cvA)}) * 360<br/>Previo: (${withValue(invP)} / ${withValue(cvP)}) * 360`
        },
        r8_rotacion_cuentas_x_cobrar_dias: () => {
          const cliA = balanceData.estado_balance_anterior?.cliente_anterior
          const vtaA = resultsData.estado_resultado_anterior?.ventas_anuales_anterior
          const cliP = balanceData.estado_balance_previo_anterior?.cliente_previo_anterior
          const vtaP = resultsData.estado_resultado_previo_anterior?.ventas_anuales_previo_anterior
          return `Anterior: (${withValue(cliA)} / ${withValue(vtaA)}) * 360<br/>Previo: (${withValue(cliP)} / ${withValue(vtaP)}) * 360`
        },
        r9_rotacion_pagos_dias: () => {
          const provA = balanceData.estado_balance_anterior?.proveedores_anterior
          const acreA = balanceData.estado_balance_anterior?.acreedores_anterior
          const cvA = resultsData.estado_resultado_anterior?.costo_ventas_anuales_anterior
          const provP = balanceData.estado_balance_previo_anterior?.proveedores_previo_anterior
          const acreP = balanceData.estado_balance_previo_anterior?.acreedores_previo_anterior
          const cvP = resultsData.estado_resultado_previo_anterior?.costo_ventas_anuales_previo_anterior
          return `Anterior: (${withValue(provA)} + ${withValue(acreA)}) / ${withValue(cvA)} * 360<br/>Previo: (${withValue(provP)} + ${withValue(acreP)}) / ${withValue(cvP)} * 360`
        },
        r10_solvencia_deuda_total_sobre_capital: () => {
          const dtA = balanceData.deuda_total?.deuda_total_anterior
          const ccA = balanceData.total_capital_contable?.total_capital_contable_anterior
          const dtP = balanceData.deuda_total?.deuda_total_previo_anterior
          const ccP = balanceData.total_capital_contable?.total_capital_contable_previo_anterior
          return `Anterior: ${withValue(dtA)} / ${withValue(ccA)}<br/>Previo: ${withValue(dtP)} / ${withValue(ccP)}`
        },
        r11_retorno_sobre_capital_acciones: () => {
          const uoA = resultsData.utilidad_operacion?.operacion_utilidad_operacion_anterior
          const ccA = balanceData.total_capital_contable?.total_capital_contable_anterior
          const uoP = resultsData.utilidad_operacion?.operacion_utilidad_operacion_previo_anterior
          const ccP = balanceData.total_capital_contable?.total_capital_contable_previo_anterior
          return `Anterior: ${withValue(uoA)} / ${withValue(ccA)} * 100<br/>Previo: ${withValue(uoP)} / ${withValue(ccP)} * 100`
        },
        r12_rendimiento_capital: () => {
          const unA = resultsData.utilidad_neta?.utilidad_neta_anterior
          const ccA = balanceData.total_capital_contable?.total_capital_contable_anterior
          const unP = resultsData.utilidad_neta?.utilidad_neta_previo_anterior
          const ccP = balanceData.total_capital_contable?.total_capital_contable_previo_anterior
          return `Anterior: ${withValue(unA)} / ${withValue(ccA)} * 100<br/>Previo: ${withValue(unP)} / ${withValue(ccP)} * 100`
        },
        r13_rendimiento_activos: () => {
          const unA = resultsData.utilidad_neta?.utilidad_neta_anterior
          const taA = balanceData.total_activo?.total_activo_anterior
          const unP = resultsData.utilidad_neta?.utilidad_neta_previo_anterior
          const taP = balanceData.total_activo?.total_activo_previo_anterior
          return `Anterior: ${withValue(unA)} / ${withValue(taA)} * 100<br/>Previo: ${withValue(unP)} / ${withValue(taP)} * 100`
        }
      }

      const ratioFormulas = {
        r1_capital_trabajo_numero_veces: 'Activo circulante / Pasivo circulante',
        r2_capital_trabajo_valor_nominal: 'Activo circulante - Pasivo circulante',
        r3_prueba_acida_numero_veces: '(Activo circulante - Inventarios) / Pasivo circulante',
        r4_grado_general_endeudamiento_numero_veces: 'Total activo / Pasivo largo plazo',
        r5_apalancamiento_financiero_numero_veces: 'Pasivo largo plazo / Total activo',
        r6_rotacion_inventarios_numero_veces: 'Inventarios / Costo ventas anuales',
        r7_rotacion_inventarios_dias: '(Inventarios / Costo ventas anuales) * 360',
        r8_rotacion_cuentas_x_cobrar_dias: '(Clientes / Ventas anuales) * 360',
        r9_rotacion_pagos_dias: '(Proveedores + Acreedores) / Costo ventas anuales * 360',
        r10_solvencia_deuda_total_sobre_capital: 'Deuda total / Capital contable',
        r11_retorno_sobre_capital_acciones: 'Utilidad operación / Capital contable * 100',
        r12_rendimiento_capital: 'Utilidad neta / Capital contable * 100',
        r13_rendimiento_activos: 'Utilidad neta / Total activo * 100'
      }
      const ratioRows = ratioMap
        .map(([key, label, a, p, code], idx) => {
          const item = ratioData[key] || {}
          const op = ratioOpsValues[key] ? ratioOpsValues[key]() : '-'
          const formula = ratioFormulas[key] || '-'
          return `
            <tr style="background-color:${idx % 2 === 0 ? '#ffffff' : '#f5f5f5'};">
              <td style="padding: 6px 8px; border: 1px solid #ddd; white-space: pre-line;">${code}</td>
              <td style="padding: 6px 8px; border: 1px solid #ddd; white-space: pre-line;">${label}</td>
              <td style="padding: 6px 8px; border: 1px solid #ddd; white-space: pre-line;">${formatRatioValue(item[a])}</td>
              <td style="padding: 6px 8px; border: 1px solid #ddd; white-space: pre-line;">${formatRatioValue(item[p])}</td>
              <td style="padding: 6px 8px; border: 1px solid #ddd; white-space: pre-line;"><code style="${mathStyle}">${formula}</code></td>
              <td style="padding: 6px 8px; border: 1px solid #ddd; white-space: pre-line;"><code style="${mathStyle}">${op}</code></td>
            </tr>`
        })
        .join('')

      const formatCalcValue = v => (v === null || v === undefined ? '-' : formatMoney(v))

      const balanceMap = [
        ['total_activo_circulante', 'Total activo circulante', 'total_activo_circulante_anterior', 'total_activo_circulante_previo_anterior'],
        ['total_activo', 'Total activo', 'total_activo_anterior', 'total_activo_previo_anterior'],
        ['total_pasivo_circulante', 'Total pasivo circulante', 'total_pasivo_circulante_anterior', 'total_pasivo_circulante_previo_anterior'],
        ['total_pasivo_largo_plazo', 'Total pasivo largo plazo', 'total_pasivo_largo_plazo_anterior', 'total_pasivo_previo_anterior'],
        ['total_capital_contable', 'Total capital contable', 'total_capital_contable_anterior', 'total_capital_contable_previo_anterior']
      ]

      const balanceOps = {
        total_activo_circulante: () => {
          const a = balanceData.estado_balance_anterior || {}
          const p = balanceData.estado_balance_previo_anterior || {}
          return `Anterior: ${withLabel('Caja/bancos', a.caja_bancos_anterior)} + ${withLabel('Clientes', a.cliente_anterior)} + ${withLabel('Inventarios', a.inventarios_anterior)} + ${withLabel('Deudores diversos', a.deudores_diversos_anterior)} + ${withLabel('Otros activos', a.otros_activos_anterior)}<br/>Previo: ${withLabel('Caja/bancos', p.caja_bancos_previo_anterior)} + ${withLabel('Clientes', p.cliente_previo_anterior)} + ${withLabel('Inventarios', p.inventarios_previo_anterior)} + ${withLabel('Deudores diversos', p.deudores_diversos_previo_anterior)} + ${withLabel('Otros activos', p.otros_activos_previo_anterior)}`
        },
        total_activo: () => {
          const a = balanceData.estado_balance_anterior || {}
          const p = balanceData.estado_balance_previo_anterior || {}
          const acA = balanceData.total_activo_circulante?.total_activo_circulante_anterior
          const acP = balanceData.total_activo_circulante?.total_activo_circulante_previo_anterior
          const afA = Number(a.activo_fijo_anterior || 0) + Number(a.activo_intangible_anterior || 0) + Number(a.activo_diferido_anterior || 0) + Number(a.otros_activos_fijos_largo_plazo_anterior || 0)
          const afP = Number(p.activo_fijo_previo_anterior || 0) + Number(p.activo_intangible_previo_anterior || 0) + Number(p.activo_diferido_previo_anterior || 0) + Number(p.otros_activos_fijos_largo_plazo_previo_anterior || 0)
          return `Anterior: ${withLabel('Activo circulante', acA)} + ${withLabel('Activo fijo', afA)}<br/>Previo: ${withLabel('Activo circulante', acP)} + ${withLabel('Activo fijo', afP)}`
        },
        total_pasivo_circulante: () => {
          const a = balanceData.estado_balance_anterior || {}
          const p = balanceData.estado_balance_previo_anterior || {}
          return `Anterior: ${withLabel('Proveedores', a.proveedores_anterior)} + ${withLabel('Acreedores', a.acreedores_anterior)} + ${withLabel('Impuestos por pagar', a.inpuestos_x_pagar_anterior)} + ${withLabel('Otros pasivos', a.otros_pasivos_anterior)}<br/>Previo: ${withLabel('Proveedores', p.proveedores_previo_anterior)} + ${withLabel('Acreedores', p.acreedores_previo_anterior)} + ${withLabel('Impuestos por pagar', p.inpuestos_x_pagar_previo_anterior)} + ${withLabel('Otros pasivos', p.otros_pasivos_previo_anterior)}`
        },
        total_pasivo_largo_plazo: () => {
          const a = balanceData.estado_balance_anterior || {}
          const p = balanceData.estado_balance_previo_anterior || {}
          const pcA = balanceData.total_pasivo_circulante?.total_pasivo_circulante_anterior
          const pcP = balanceData.total_pasivo_circulante?.total_pasivo_circulante_previo_anterior
          return `Anterior: ${withLabel('Pasivo largo plazo', a.pasivo_largo_plazo_anterior)} + ${withLabel('Pasivo diferido', a.pasivo_diferido_anterior)} + ${withLabel('Pasivo circulante', pcA)}<br/>Previo: ${withLabel('Pasivo largo plazo', p.pasivo_largo_plazo_previo_anterior)} + ${withLabel('Pasivo diferido', p.pasivo_diferido_previo_anterior)} + ${withLabel('Pasivo circulante', pcP)}`
        },
        total_capital_contable: () => {
          const a = balanceData.estado_balance_anterior || {}
          const p = balanceData.estado_balance_previo_anterior || {}
          return `Anterior: ${withLabel('Capital social', a.capital_social_anterior)} + ${withLabel('Result. ejer. anteriores', a.resultado_ejercicios_anteriores_anterior)} + ${withLabel('Resultado ejercicios', a.resultado_ejercicios_anterior)} + ${withLabel('Otro capital', a.otro_capital_anterior)}<br/>Previo: ${withLabel('Capital social', p.capital_social_previo_anterior)} + ${withLabel('Result. ejer. anteriores', p.resultado_ejercicios_anteriores_previo_anterior)} + ${withLabel('Resultado ejercicios', p.resultado_ejercicios_previo_anterior)} + ${withLabel('Otro capital', p.otro_capital_previo_anterior)}`
        }
      }

      const balanceOpsValues = {
        total_activo_circulante: () => {
          const a = balanceData.estado_balance_anterior || {}
          const p = balanceData.estado_balance_previo_anterior || {}
          return `Anterior: ${withValue(a.caja_bancos_anterior)} + ${withValue(a.cliente_anterior)} + ${withValue(a.inventarios_anterior)} + ${withValue(a.deudores_diversos_anterior)} + ${withValue(a.otros_activos_anterior)}<br/>Previo: ${withValue(p.caja_bancos_previo_anterior)} + ${withValue(p.cliente_previo_anterior)} + ${withValue(p.inventarios_previo_anterior)} + ${withValue(p.deudores_diversos_previo_anterior)} + ${withValue(p.otros_activos_previo_anterior)}`
        },
        total_activo: () => {
          const a = balanceData.estado_balance_anterior || {}
          const p = balanceData.estado_balance_previo_anterior || {}
          const acA = balanceData.total_activo_circulante?.total_activo_circulante_anterior
          const acP = balanceData.total_activo_circulante?.total_activo_circulante_previo_anterior
          const afA = Number(a.activo_fijo_anterior || 0) + Number(a.activo_intangible_anterior || 0) + Number(a.activo_diferido_anterior || 0) + Number(a.otros_activos_fijos_largo_plazo_anterior || 0)
          const afP = Number(p.activo_fijo_previo_anterior || 0) + Number(p.activo_intangible_previo_anterior || 0) + Number(p.activo_diferido_previo_anterior || 0) + Number(p.otros_activos_fijos_largo_plazo_previo_anterior || 0)
          return `Anterior: ${withValue(acA)} + ${withValue(afA)}<br/>Previo: ${withValue(acP)} + ${withValue(afP)}`
        },
        total_pasivo_circulante: () => {
          const a = balanceData.estado_balance_anterior || {}
          const p = balanceData.estado_balance_previo_anterior || {}
          return `Anterior: ${withValue(a.proveedores_anterior)} + ${withValue(a.acreedores_anterior)} + ${withValue(a.inpuestos_x_pagar_anterior)} + ${withValue(a.otros_pasivos_anterior)}<br/>Previo: ${withValue(p.proveedores_previo_anterior)} + ${withValue(p.acreedores_previo_anterior)} + ${withValue(p.inpuestos_x_pagar_previo_anterior)} + ${withValue(p.otros_pasivos_previo_anterior)}`
        },
        total_pasivo_largo_plazo: () => {
          const a = balanceData.estado_balance_anterior || {}
          const p = balanceData.estado_balance_previo_anterior || {}
          const pcA = balanceData.total_pasivo_circulante?.total_pasivo_circulante_anterior
          const pcP = balanceData.total_pasivo_circulante?.total_pasivo_circulante_previo_anterior
          return `Anterior: ${withValue(a.pasivo_largo_plazo_anterior)} + ${withValue(a.pasivo_diferido_anterior)} + ${withValue(pcA)}<br/>Previo: ${withValue(p.pasivo_largo_plazo_previo_anterior)} + ${withValue(p.pasivo_diferido_previo_anterior)} + ${withValue(pcP)}`
        },
        total_capital_contable: () => {
          const a = balanceData.estado_balance_anterior || {}
          const p = balanceData.estado_balance_previo_anterior || {}
          return `Anterior: ${withValue(a.capital_social_anterior)} + ${withValue(a.resultado_ejercicios_anteriores_anterior)} + ${withValue(a.resultado_ejercicios_anterior)} + ${withValue(a.otro_capital_anterior)}<br/>Previo: ${withValue(p.capital_social_previo_anterior)} + ${withValue(p.resultado_ejercicios_anteriores_previo_anterior)} + ${withValue(p.resultado_ejercicios_previo_anterior)} + ${withValue(p.otro_capital_previo_anterior)}`
        }
      }

      const balanceFormulas = {
        total_activo_circulante: 'Caja/bancos + Clientes + Inventarios + Deudores diversos + Otros activos',
        total_activo: 'Activo circulante + Activo fijo',
        total_pasivo_circulante: 'Proveedores + Acreedores + Impuestos por pagar + Otros pasivos',
        total_pasivo_largo_plazo: 'Pasivo largo plazo + Pasivo diferido + Pasivo circulante',
        total_capital_contable: 'Capital social + Result. ejer. anteriores + Resultado ejercicios + Otro capital'
      }

      const balanceRows = balanceMap
        .map(([key, label, a, p], idx) => {
          const item = balanceData[key] || {}
          const op = balanceOpsValues[key] ? balanceOpsValues[key]() : '-'
          const formula = balanceFormulas[key] || '-'
          return `
            <tr style="background-color:${idx % 2 === 0 ? '#ffffff' : '#f5f5f5'};">
              <td style="padding: 6px 8px; border: 1px solid #ddd; white-space: pre-line;">${label}</td>
              <td style="padding: 6px 8px; border: 1px solid #ddd; white-space: pre-line;">${formatCalcValue(item[a])}</td>
              <td style="padding: 6px 8px; border: 1px solid #ddd; white-space: pre-line;">${formatCalcValue(item[p])}</td>
              <td style="padding: 6px 8px; border: 1px solid #ddd; white-space: pre-line;"><code style="${mathStyle}">${formula}</code></td>
              <td style="padding: 6px 8px; border: 1px solid #ddd; white-space: pre-line;"><code style="${mathStyle}">${op}</code></td>
            </tr>`
        })
        .join('')

      const resultsMap = [
        ['utilidad_bruta', 'Utilidad bruta', 'operacion_utilidad_bruta_anterior', 'operacion_utilidad_bruta_previo_anterior'],
        ['utilidad_operacion', 'Utilidad de operación', 'operacion_utilidad_operacion_anterior', 'operacion_utilidad_operacion_previo_anterior'],
        ['utilidad_neta', 'Utilidad neta', 'utilidad_neta_anterior', 'utilidad_neta_previo_anterior']
      ]

      const resultOps = {
        utilidad_bruta: () => {
          const a = resultsData.estado_resultado_anterior || {}
          const p = resultsData.estado_resultado_previo_anterior || {}
          return `Anterior: ${withLabel('Ventas anuales', a.ventas_anuales_anterior)} - ${withLabel('Costo ventas anuales', a.costo_ventas_anuales_anterior)}<br/>Previo: ${withLabel('Ventas anuales', p.ventas_anuales_previo_anterior)} - ${withLabel('Costo ventas anuales', p.costo_ventas_anuales_previo_anterior)}`
        },
        utilidad_operacion: () => {
          const a = resultsData.estado_resultado_anterior || {}
          const p = resultsData.estado_resultado_previo_anterior || {}
          return `Anterior: ${withLabel('Utilidad bruta', a.utilidad_bruta_anterior)} - ${withLabel('Gastos administración', a.gastos_administracion_anterior)}<br/>Previo: ${withLabel('Utilidad bruta', p.utilidad_bruta_previo_anterior)} - ${withLabel('Gastos administración', p.gastos_administracion_previo_anterior)}`
        },
        utilidad_neta: () => {
          const a = resultsData.estado_resultado_anterior || {}
          const p = resultsData.estado_resultado_previo_anterior || {}
          return `Anterior: ${withLabel('Utilidad operativa', a.utilidad_operativa_anterior)} - ${withLabel('Gastos prod. financieros', a.gastos_productos_financieros_anterior)} - ${withLabel('Depreciación amortización', a.depreciacion_amortizacion_anterior)} + ${withLabel('Otros ingresos', a.otros_ingresos_anterior)} - ${withLabel('Otros egresos', a.otros_egresos_anterior)} - ${withLabel('Otros gastos', a.otros_gastos_anterior)}<br/>Previo: ${withLabel('Utilidad operativa', p.utilidad_operativa_previo_anterior)} - ${withLabel('Gastos prod. financieros', p.gastos_productos_financieros_previo_anterior)} - ${withLabel('Depreciación amortización', p.depreciacion_amortizacion_previo_anterior)} + ${withLabel('Otros ingresos', p.otros_ingresos_previo_anterior)} - ${withLabel('Otros egresos', p.otros_egresos_previo_anterior)} - ${withLabel('Otros gastos', p.otros_gastos_previo_anterior)}`
        }
      }

      const resultOpsValues = {
        utilidad_bruta: () => {
          const a = resultsData.estado_resultado_anterior || {}
          const p = resultsData.estado_resultado_previo_anterior || {}
          return `Anterior: ${withValue(a.ventas_anuales_anterior)} - ${withValue(a.costo_ventas_anuales_anterior)}<br/>Previo: ${withValue(p.ventas_anuales_previo_anterior)} - ${withValue(p.costo_ventas_anuales_previo_anterior)}`
        },
        utilidad_operacion: () => {
          const a = resultsData.estado_resultado_anterior || {}
          const p = resultsData.estado_resultado_previo_anterior || {}
          return `Anterior: ${withValue(a.utilidad_bruta_anterior)} - ${withValue(a.gastos_administracion_anterior)}<br/>Previo: ${withValue(p.utilidad_bruta_previo_anterior)} - ${withValue(p.gastos_administracion_previo_anterior)}`
        },
        utilidad_neta: () => {
          const a = resultsData.estado_resultado_anterior || {}
          const p = resultsData.estado_resultado_previo_anterior || {}
          return `Anterior: ${withValue(a.utilidad_operativa_anterior)} - ${withValue(a.gastos_productos_financieros_anterior)} - ${withValue(a.depreciacion_amortizacion_anterior)} + ${withValue(a.otros_ingresos_anterior)} - ${withValue(a.otros_egresos_anterior)} - ${withValue(a.otros_gastos_anterior)}<br/>Previo: ${withValue(p.utilidad_operativa_previo_anterior)} - ${withValue(p.gastos_productos_financieros_previo_anterior)} - ${withValue(p.depreciacion_amortizacion_previo_anterior)} + ${withValue(p.otros_ingresos_previo_anterior)} - ${withValue(p.otros_egresos_previo_anterior)} - ${withValue(p.otros_gastos_previo_anterior)}`
        }
      }

      const resultFormulas = {
        utilidad_bruta: 'Ventas anuales - Costo ventas anuales',
        utilidad_operacion: 'Utilidad bruta - Gastos administración',
        utilidad_neta: 'Utilidad operativa - Gastos prod. financieros - Depreciación amortización + Otros ingresos - Otros egresos - Otros gastos'
      }

      const resultsRows = resultsMap
        .map(([key, label, a, p], idx) => {
          const item = resultsData[key] || {}
          const op = resultOpsValues[key] ? resultOpsValues[key]() : '-'
          const formula = resultFormulas[key] || '-'
          return `
            <tr style="background-color:${idx % 2 === 0 ? '#ffffff' : '#f5f5f5'};">
              <td style="padding: 6px 8px; border: 1px solid #ddd; white-space: pre-line;">${label}</td>
              <td style="padding: 6px 8px; border: 1px solid #ddd; white-space: pre-line;">${formatCalcValue(item[a])}</td>
              <td style="padding: 6px 8px; border: 1px solid #ddd; white-space: pre-line;">${formatCalcValue(item[p])}</td>
              <td style="padding: 6px 8px; border: 1px solid #ddd; white-space: pre-line;"><code style="${mathStyle}">${formula}</code></td>
              <td style="padding: 6px 8px; border: 1px solid #ddd; white-space: pre-line;"><code style="${mathStyle}">${op}</code></td>
            </tr>`
        })
        .join('')


      const buildFinancialRows = (arr, periodKey, body, prefix) => {
        const map = {}
          ; (arr || []).forEach(item => {
            const period = item[periodKey]
            Object.entries(item || {}).forEach(([k, v]) => {
              if (
                [
                  'id_certification',
                  'id_tipo_cifra',
                  'compartir_balance',
                  'compartir_resultado',
                  'compartir_info_empresa',
                  periodKey
                ].includes(k) ||
                k.startsWith('periodo') ||
                k.startsWith('perioro')
              )
                return
              if (!map[k]) map[k] = {}
              map[k][period] = v
            })
          })
        return Object.entries(map)
          .map(([field, vals], idx) => {
            const label = partidasLabels[field] || field.replace(/_/g, ' ')
            const formLabel = formFieldNames[field] || label
            const anterior = vals.anterior
            const previo = vals.previo_anterior
            let reqPath
            if (field === 'compartir_balance') {
              reqPath = 'compartir_estado_balance'
            } else if (field === 'compartir_resultado') {
              reqPath = 'compartir_estado_resultados'
            } else {
              reqPath = field
            }
            return `
          <tr style="background-color:${idx % 2 === 0 ? '#ffffff' : '#f5f5f5'};">
            <td style="padding: 6px 8px; border: 1px solid #ddd;">${formLabel}</td>
            <td style="padding: 6px 8px; border: 1px solid #ddd;">${reqPath}</td>
            <td style="padding: 6px 8px; border: 1px solid #ddd;">${field}</td>
            <td style="padding: 6px 8px; border: 1px solid #ddd; text-align:right;">${anterior !== undefined && anterior !== null ? formatMoney(anterior) : '-'
              }</td>
            <td style="padding: 6px 8px; border: 1px solid #ddd; text-align:right;">${previo !== undefined && previo !== null ? formatMoney(previo) : '-'
              }</td>
          </tr>`
          })
          .join('')
      }

      const partidasLabels = {
        caja_bancos: 'Caja y bancos',
        saldo_cliente_cuenta_x_cobrar: 'Clientes',
        saldo_inventarios: 'Inventarios',
        deuda_corto_plazo: 'Deuda corto plazo',
        deuda_total: 'Deuda total',
        capital_contable: 'Capital contable',
        deudores_diversos: 'Deudores diversos',
        otros_activos: 'Otros activos',
        otros_activos_fijos_largo_plazo: 'Otros activos fijos largo plazo',
        total_activo_circulante: 'Total activo circulante',
        total_activo_fijo: 'Total activo fijo',
        activo_intangible: 'Activo intangible',
        activo_diferido: 'Activo diferido',
        total_otros_activos: 'Total otros activos',
        activo_total: 'Activo total',
        proveedores: 'Proveedores',
        acreedores: 'Acreedores',
        inpuestos_x_pagar: 'Impuestos por pagar',
        otros_pasivos: 'Otros pasivos',
        total_pasivo_largo_plazo: 'Total pasivo largo plazo',
        pasivo_diferido: 'Pasivo diferido',
        capital_social: 'Capital social',
        resultado_ejercicios_anteriores: 'Resultado ejercicios anteriores',
        resultado_ejercicios: 'Resultado del ejercicio',
        otro_capital: 'Otro capital',
        ventas_anuales: 'Ventas anuales',
        costo_ventas_anuales: 'Costo ventas anuales',
        utilidad_operativa: 'Utilidad operativa',
        utilidad_bruta: 'Utilidad bruta',
        gastos_administracion: 'Gastos de administración',
        gastos_productos_financieros: 'Gastos prod. financieros',
        depreciacion_amortizacion: 'Depreciación y amortización',
        otros_ingresos: 'Otros ingresos',
        otros_egresos: 'Otros egresos',
        otros_gastos: 'Otros gastos',
        utilidad_neta: 'Utilidad neta'
      }

      const formFieldNames = {
        caja_bancos: 'Caja y bancos',
        saldo_cliente_cuenta_x_cobrar: 'Saldo de clientes o cuentas por cobrar',
        saldo_inventarios: 'Inventarios',
        deuda_corto_plazo: 'Deuda corto plazo',
        deuda_total: 'Deuda total',
        capital_contable: 'Capital contable',
        deudores_diversos: 'Deudores diversos',
        otros_activos: 'Otros activos',
        otros_activos_fijos_largo_plazo: 'Otros activos fijos largo plazo',
        total_activo_circulante: 'Total activo circulante',
        total_activo_fijo: 'Total activo fijo',
        activo_intangible: 'Activo intangible',
        activo_diferido: 'Activo diferido',
        total_otros_activos: 'Total otros activos',
        activo_total: 'Activo total',
        proveedores: 'Proveedores',
        acreedores: 'Acreedores',
        inpuestos_x_pagar: 'Impuestos por pagar',
        otros_pasivos: 'Otros pasivos',
        total_pasivo_largo_plazo: 'Total pasivo largo plazo',
        pasivo_diferido: 'Pasivo diferido',
        capital_social: 'Capital social',
        resultado_ejercicios_anteriores: 'Resultado ejercicios anteriores',
        resultado_ejercicios: 'Resultado del ejercicio',
        otro_capital: 'Otro capital',
        ventas_anuales: 'Ventas anuales',
        costo_ventas_anuales: 'Costo ventas anuales',
        utilidad_operativa: 'Utilidad operativa',
        utilidad_bruta: 'Utilidad bruta',
        gastos_administracion: 'Gastos de administración',
        gastos_productos_financieros: 'Gastos prod. financieros',
        depreciacion_amortizacion: 'Depreciación y amortización',
        otros_ingresos: 'Otros ingresos',
        otros_egresos: 'Otros egresos',
        otros_gastos: 'Otros gastos',
        utilidad_neta: 'Utilidad neta'
      }


      const balancePartidasRows = buildFinancialRows(
        partidasFinancierasBalance,
        'tipo_periodo_estado_balance',
        req_body,
        'partida_estado_balance_periodo_contable'
      )
      const resultadosPartidasRows = buildFinancialRows(
        partidasFinancierasResultados,
        'tipo_periodo_estado_resultados',
        req_body,
        'partida_estado_resultado_periodo_contable'
      )

      const periodoAnteriorBalance =
        partidasFinancierasBalance.find(p => p.tipo_periodo_estado_balance === 'anterior')?.perioro_anterior_estado_balance ||
        partidasFinancierasBalance[0]?.perioro_anterior_estado_balance ||
        '-'
      const periodoPrevioBalance =
        partidasFinancierasBalance.find(p => p.tipo_periodo_estado_balance === 'previo_anterior')?.perioro_previo_anterior_estado_balance ||
        partidasFinancierasBalance[0]?.perioro_previo_anterior_estado_balance ||
        '-'

      const periodoAnteriorResultados =
        partidasFinancierasResultados.find(p => p.tipo_periodo_estado_resultados === 'anterior')?.perioro_anterior_estado_resultados ||
        partidasFinancierasResultados[0]?.perioro_anterior_estado_resultados ||
        '-'
      const periodoPrevioResultados =
        partidasFinancierasResultados.find(p => p.tipo_periodo_estado_resultados === 'previo_anterior')?.perioro_previo_anterior_estado_resultados ||
        partidasFinancierasResultados[0]?.perioro_previo_anterior_estado_resultados ||
        '-'

      const financialTables = `
        <div class="table-section">
        <table border="1" cellspacing="0" cellpadding="6" style="border-collapse: collapse; width: 100%; font-family: Arial, Helvetica, sans-serif; font-size: 10px;">
          <caption>Partidas Financieras - Estado de Balance</caption>
          <thead style="background-color: #f2f2f2;">
            <tr>
              <th>Nombre del campo en el formulario</th>
              <th>Nombre de la propiedad en el objeto del request</th>
              <th>Nombre del campo en base de datos</th>
              <th>Periodo anterior (${extractYear(periodoAnteriorBalance)})</th>
              <th>Periodo previo anterior (${extractYear(periodoPrevioBalance)})</th>
            </tr>
          </thead>
          <tbody>
            ${balancePartidasRows}
          </tbody>
        </table>
        </div>
        <div class="table-section">
        <table border="1" cellspacing="0" cellpadding="6" style="border-collapse: collapse; width: 100%; font-family: Arial, Helvetica, sans-serif; font-size: 10px;">
          <caption>Partidas Financieras - Estado de Resultados</caption>
          <thead style="background-color: #f2f2f2;">
            <tr>
              <th>Nombre del campo en el formulario</th>
              <th>Nombre de la propiedad en el objeto del request</th>
              <th>Nombre del campo en base de datos</th>
              <th>Periodo anterior (${extractYear(periodoAnteriorResultados)})</th>
              <th>Periodo previo anterior (${extractYear(periodoPrevioResultados)})</th>
            </tr>
          </thead>
          <tbody>
            ${resultadosPartidasRows}
          </tbody>
        </table>
        </div>
      `

      const variablesReference = [
        ['_01_pais', '1. País', 'cat_pais_algoritmo'],
        ['_02_sector_riesgo', '2. Sector riesgo', 'cat_sector_riesgo_sectorial_algoritmo'],
        ['_03_capital_contable', '3. Capital contable', 'cat_capital_contable_algoritmo'],
        ['_04_plantilla_laboral', '4. Plantilla laboral', 'cat_plantilla_laboral_algoritmo'],
        ['_05_sector_cliente_final', '5. Sector cliente final', 'cat_sector_clientes_finales_algoritmo'],
        ['_06_tiempo_actividad', '6. Tiempo actividad', 'cat_tiempo_actividad_comercial_algoritmo'],
        ['_07_influencia_controlante', '7. Influencia controlante', 'cat_influencia_controlante'],
        ['_08_ventas_anuales', '8. Ventas anuales', 'cat_ventas_anuales_algoritmo'],
        ['_09_tipo_cifras', '9. Tipo cifras', 'cat_tipo_cifras_algoritmo'],
        ['_10_incidencias_legales', '10. Incidencias legales', 'cat_incidencias_legales_algoritmo'],
        ['_11_evolucion_ventas', '11. Evolución de ventas', 'cat_evolucion_ventas_algoritmo'],
        ['_12_apalancamiento', '12. Apalancamiento', 'cat_apalancamiento_algoritmo'],
        ['_13_flujo_neto', '13. Flujo neto', 'cat_flujo_neto_caja_algoritmo'],
        ['_14_payback', '14. Payback', 'cat_payback_algoritmo'],
        ['_15_rotacion_ctas_x_cobrar', '15. Rotación ctas x cobrar', 'cat_rotacion_cuentas_cobrar_algoritmo'],
        ['_16_referencias_comerciales', '16. Referencias comerciales score', 'cat_resultado_referencias_proveedores_algoritmo']
      ]

      const singleScoreTables = [
        'cat_pais_algoritmo',
        'cat_capital_contable_algoritmo',
        'cat_tiempo_actividad_comercial_algoritmo',
        'cat_apalancamiento_algoritmo',
        'cat_flujo_neto_caja_algoritmo',
        'cat_ventas_anuales_algoritmo',
        'cat_tipo_cifras_algoritmo',
        'cat_evolucion_ventas_algoritmo',
        'cat_payback_algoritmo',
        'cat_rotacion_cuentas_cobrar_algoritmo',
        'cat_incidencias_legales_algoritmo',
        'cat_sector_riesgo_sectorial_algoritmo'
      ]

      const referenceTables = variablesReference
        .map(([key, label, table]) => {
          const selected = String(rangos[key]?.descripcion || '').toLowerCase()
          const rowItems = (rangos_bd && Array.isArray(rangos_bd[table]) ? rangos_bd[table] : [])
            .map((opt, idx) => {
              const v1 = opt.valor_algoritmo ?? '-'
              const v2 = opt.valor_algoritmo_v2 ?? opt.valor_algoritmo ?? '-'
              const opcion = opt.nombre ?? opt.descripcion ?? '-'
              const isSel = selected && opcion.toLowerCase() === selected
              const opcionHtml = isSel ? `<strong>${opcion}</strong>` : opcion
              const singleScoreTables = [
                'cat_pais_algoritmo',
                'cat_capital_contable_algoritmo',
                'cat_tiempo_actividad_comercial_algoritmo',
                'cat_apalancamiento_algoritmo',
                'cat_flujo_neto_caja_algoritmo',
                'cat_ventas_anuales_algoritmo',
                'cat_tipo_cifras_algoritmo',
                'cat_evolucion_ventas_algoritmo',
                'cat_payback_algoritmo',
                'cat_rotacion_cuentas_cobrar_algoritmo',
                'cat_incidencias_legales_algoritmo',
                'cat_sector_riesgo_sectorial_algoritmo'
              ]
              const scoreColumn = singleScoreTables.includes(table)
                ? `<td style="padding: 4px 6px; border: 1px solid #ccc;">${v1}</td>`
                : `<td style="padding: 4px 6px; border: 1px solid #ccc;">${v1}</td><td style="padding: 4px 6px; border: 1px solid #ccc;">${v2}</td>`
              return `
                <tr style="background-color:${idx % 2 === 0 ? '#ffffff' : '#f5f5f5'};">
                  <td style="padding: 4px 6px; border: 1px solid #ccc;">${opcionHtml}</td>
                  ${scoreColumn}
                </tr>`
            })
            .join('')
          const colSpan = singleScoreTables.includes(table) ? 2 : 3
          const rows = rowItems || `<tr><td colspan="${colSpan}" style="padding: 4px 6px; border: 1px solid #ccc; text-align: center;">No hay información disponible</td></tr>`
          const header = singleScoreTables.includes(table)
            ? `<tr><th>Opción</th><th>Score</th></tr>`
            : `<tr><th>Opción</th><th>Score V1</th><th>Score V2</th></tr>`
          const tId = tableIdMap[key]
          const sId = sectionIdMap[key]
          return `
            <div class="table-section" style="page-break-inside: avoid; break-inside: avoid;">
            <table border="1" cellspacing="0" cellpadding="4" style="border-collapse: collapse; width: auto; margin: 0 0 10px 0; margin-left: 0; font-family: 'Segoe UI', Arial, sans-serif; font-size: 9px; page-break-inside: avoid; break-inside: avoid;">
              <caption${tId ? ` id="${tId}"` : ''}>${label} (tabla: ${table})${sId ? ` - <a href="#${sId}">Regresar a score y cálculo</a>` : ''}</caption>
              <thead style="background-color: #003366; color: #fff;">
                ${header}
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
            </div>`
        })
        .join('')


      const environmentLabel =
        process.env.NODE_ENV === 'production'
          ? 'Ambiente productivo'
          : 'Ambiente de desarrollo'

      htmlContent = `
        <style>
          .table-section { page-break-inside: avoid; break-inside: avoid; }
        </style>
        <div style="font-family: Arial, Helvetica, sans-serif; font-size: 10px; line-height: 1.6; color: #333;">
          <h1 style="color:#0a3d8e; text-align:center; font-size: 10px;">Reporte de desglose de algoritmo</h1>
          <p style="text-align:center; font-size:10px;">${environmentLabel}</p>
          <h3 style="font-size: 10px; color: #2ba2af; margin: 0 0 8px 0;">ℹ Resumen de resultados</h3>
          ${empresasTabla}
          <table style="border-collapse: collapse; width: 100%; margin-bottom: 10px; font-size: 10px; page-break-inside: avoid; break-inside: avoid;">
            <tbody>
              <tr style="background-color:#ffffff;">
                <td style="padding: 6px 8px; border: 1px solid #ddd; white-space: pre-line;">Score</td>
                <td style="padding: 6px 8px; border: 1px solid #ddd; white-space: pre-line;">${scores.g52 ?? '-'}</td>
              </tr>
              <tr style="background-color:#f5f5f5;">
                <td style="padding: 6px 8px; border: 1px solid #ddd; white-space: pre-line;">Puntaje (G51)</td>
                <td style="padding: 6px 8px; border: 1px solid #ddd; white-space: pre-line;">${scores.g51 ?? '-'}</td>
              </tr>
              <tr style="background-color:#ffffff;">
                <td style="padding: 6px 8px; border: 1px solid #ddd; white-space: pre-line;">Sumatoria de scores (G45)</td>
                <td style="padding: 6px 8px; border: 1px solid #ddd; white-space: pre-line;">${scores.sumatoria_scors_g45 ?? '-'}</td>
              </tr>
              <tr style="background-color:#f5f5f5;">
                <td style="padding: 6px 8px; border: 1px solid #ddd; white-space: pre-line;">Monto solicitado</td>
                <td style="padding: 6px 8px; border: 1px solid #ddd; white-space: pre-line;">${formatMoney(rangos.monto_solicitado ?? '-')}</td>
              </tr>
              <tr style="background-color:#ffffff;">
                <td style="padding: 6px 8px; border: 1px solid #ddd; white-space: pre-line;">Monto sugerido</td>
                <td style="padding: 6px 8px; border: 1px solid #ddd; white-space: pre-line;">${formatMoney(rangos.monto_sugerido ?? '-')}</td>
              </tr>
              <tr style="background-color:#f5f5f5;">
                <td style="padding: 6px 8px; border: 1px solid #ddd; white-space: pre-line;">Wording</td>
                <td style="padding: 6px 8px; border: 1px solid #ddd; white-space: pre-line;">${rangos.wording_underwriting ?? '-'}</td>
              </tr>
              <tr style="background-color:#ffffff;">
                <td style="padding: 6px 8px; border: 1px solid #ddd; white-space: pre-line;">Versión algoritmo</td>
                <td style="padding: 6px 8px; border: 1px solid #ddd; white-space: pre-line;">${version_algoritmo || '-'}</td>
              </tr>
              ${Number(version_algoritmo) === 2 ? `<tr style="background-color:#f5f5f5;">
                <td style="padding: 6px 8px; border: 1px solid #ddd; white-space: pre-line;">Razón algoritmo</td>
                <td style="padding: 6px 8px; border: 1px solid #ddd; white-space: pre-line;">${razon_algoritmo || '-'}</td>
              </tr>` : ''}
              <tr style="background-color:${Number(version_algoritmo) === 2 ? '#ffffff' : '#f5f5f5'};">
                <td style="padding: 6px 8px; border: 1px solid #ddd; white-space: pre-line;">UUID</td>
                <td style="padding: 6px 8px; border: 1px solid #ddd; white-space: pre-line;">${uuid || '-'}</td>
              </tr>
            </tbody>
          </table>
          ${validacionesVersionTable}
          ${detallesTables}
        <div class="table-section">
        <table border="1" cellspacing="0" cellpadding="6" style="border-collapse: collapse; table-layout: auto; font-family: Arial, Helvetica, sans-serif; font-size: 9px;">
          <caption>Ratios financieros</caption>
          <thead style="background-color: #f2f2f2;">
              <tr>
                <th style="background-color: #000; color: #fff;">Etiqueta</th>
                <th style="background-color: #000; color: #fff;">Ratio</th>
                <th>Periodo anterior</th>
              <th>Previo anterior</th>
              <th>Fórmula</th>
              <th>Operación</th>
            </tr>
          </thead>
          <tbody>
            ${ratioRows}
          </tbody>
        </table>
        </div>
        <div class="table-section">
        <table border="1" cellspacing="0" cellpadding="6" style="border-collapse: collapse; width: 100%; font-family: Arial, Helvetica, sans-serif; font-size: 10px;">
          <caption>Cálculos Estado de Balance</caption>
          <thead style="background-color: #f2f2f2;">
            <tr>
              <th style="background-color: #000; color: #fff;">Cálculo</th>
              <th>Periodo anterior</th>
              <th>Previo anterior</th>
              <th>Fórmula</th>
              <th>Operación</th>
            </tr>
          </thead>
          <tbody>
            ${balanceRows}
          </tbody>
        </table>
        </div>
        <div class="table-section">
        <table border="1" cellspacing="0" cellpadding="6" style="border-collapse: collapse; width: 100%; font-family: Arial, Helvetica, sans-serif; font-size: 10px;">
          <caption>Cálculos Estado de Resultados</caption>
          <thead style="background-color: #f2f2f2;">
            <tr>
              <th style="background-color: #000; color: #fff;">Cálculo</th>
              <th>Periodo anterior</th>
              <th>Previo anterior</th>
              <th>Fórmula</th>
              <th>Operación</th>
            </tr>
          </thead>
        <tbody>
            ${resultsRows}
          </tbody>
        </table>
        ${financialTables}
        ${scoreTables}
        ${referenceTables}
          ${rangos_bd ? '' : ''}
        </div>
      `
      logger.info(`${fileMethod} | La información del email es: ${JSON.stringify(info_email)}`)

      try {
        const pdfOptions = { format: 'A4', printBackground: true }
        const pdfFile = { content: htmlContent }
        const pdfBuffer = await html_to_pdf.generatePdf(pdfFile, pdfOptions)
        attachments.push({
          filename: 'reporte_desglose_algoritmo.pdf',
          content: pdfBuffer,
          contentType: 'application/pdf'
        })
        htmlContent = `
        <div style="font-family: Arial, Helvetica, sans-serif; font-size: 10px; line-height: 1.6; color: #333;">
          <p>Se adjunta el Reporte de Desglose del Algoritmo en formato PDF.</p>
        </div>
        `
      } catch (err) {
        logger.error(`${fileMethod} | Error al generar PDF: ${err.message}`)
      }
    } else {
      logger.info(`${fileMethod} | No se proporcionó información para enviar correo`)
      return
    }

    const envLabel = process.env.NODE_ENV === 'production' ? 'Productivo' : 'Desarrollo'
    subject = `[${envLabel}] ${subject}`
    const mailOptions = {
      from: `"credibusiness" <${email_sender_error_reporte_credito}>`,
      to: lista_contactos_error_reporte_credito.map(d => d.Email).join(','),
      subject,
      html: htmlContent
    }
    if (attachments.length) {
      mailOptions.attachments = attachments
    }

    logger.info(`${fileMethod} |Información del correo: ${JSON.stringify(mailOptions)}`)

    const info = await transporter.sendMail(mailOptions)
    return info
  } catch (error) {
    logger.info(`Error en el envio de correo electronico: ${error} - ${fileMethod}`)
  }
}

const sendEmailNodeMailerInformativo = async ({ pdfBuffer }) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: sendEmailNodeMailerInformativo`
  try {
    const globalConfig = await utilitiesService.getParametros()

    let lista_contactos_error_reporte_credito = await globalConfig.find(
      item => item.nombre === 'lista_contactos_error_reporte_credito'
    ).valor
    if (typeof lista_contactos_error_reporte_credito === 'string') {
      try {
        lista_contactos_error_reporte_credito = JSON.parse(lista_contactos_error_reporte_credito.trim())
      } catch (err) {
        logger.error(`${fileMethod} | Error al parsear lista de contactos: ${err.message}`)
        return
      }
    }

    const email_sender_error_reporte_credito = await globalConfig.find(
      item => item.nombre === 'email_sender_error_reporte_credito'
    ).valor

    const password_email_sender_error_reporte_credito = await globalConfig.find(
      item => item.nombre === 'password_email_sender_error_reporte_credito'
    ).valor

    const transporter = nodemailer.createTransport({
      host: 'credibusiness.com',
      port: 465,
      secure: true,
      auth: {
        user: email_sender_error_reporte_credito,
        pass: password_email_sender_error_reporte_credito
      }
    })

    const envLabel = process.env.NODE_ENV === 'production' ? 'Productivo' : 'Desarrollo'
    const mailOptions = {
      from: `"credibusiness" <${email_sender_error_reporte_credito}>`,
      to: lista_contactos_error_reporte_credito.map(d => d.Email).join(','),
      subject: `[${envLabel}] Reporte de crédito informativo`,
      html: `<div style="font-family: Arial, Helvetica, sans-serif; font-size: 10px; line-height: 1.6; color: #333;">` +
        `<p>Se adjunta el Reporte de Crédito Informativo en formato PDF.</p>` +
        `</div>`,
      attachments: [
        {
          filename: 'reporte_credito_informativo.pdf',
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    }

    const info = await transporter.sendMail(mailOptions)
    return info
  } catch (error) {
    logger.info(`Error en el envio de correo electronico: ${error} - ${fileMethod}`)
  }
}

const calculoRatiosFinancieros = async (customUuid, id_certification, calculos_estado_balance, calculos_estado_resultados) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: calculoRatiosFinancieros`
  try {
    const insertData = {}
    logger.info(`${fileMethod} | ${customUuid} Inicio de calculo de ratios financieros`)

    logger.info(`${fileMethod} | ${customUuid} Calculos estado de balance: ${JSON.stringify(calculos_estado_balance)}`)
    logger.info(`${fileMethod} | ${customUuid} Calculos estado de resultado: ${JSON.stringify(calculos_estado_resultados)}`)

    const r1_capital_trabajo_numero_veces = {
      razon_circulante_anterior:
        (calculos_estado_balance.total_pasivo_circulante.total_pasivo_circulante_anterior ?? 0) !== 0
          ? parseFloat(
            (
              (calculos_estado_balance.total_activo_circulante.total_activo_circulante_anterior ?? 0) /
              (calculos_estado_balance.total_pasivo_circulante.total_pasivo_circulante_anterior ?? 1)
            ).toFixed(1)
          )
          : null,
      razon_circulante_previo_anterior:
        (calculos_estado_balance.total_pasivo_circulante.total_pasivo_circulante_previo_anterior ?? 0) !== 0
          ? parseFloat(
            (
              (calculos_estado_balance.total_activo_circulante.total_activo_circulante_previo_anterior ?? 0) /
              (calculos_estado_balance.total_pasivo_circulante.total_pasivo_circulante_previo_anterior ?? 1)
            ).toFixed(1)
          )
          : null
    }
    insertData.r1_capital_trabajo_numero_veces = r1_capital_trabajo_numero_veces
    logger.info(`${fileMethod} | ${customUuid} Ratio R1 capital de trabajo numero veces: ${JSON.stringify(r1_capital_trabajo_numero_veces)}`)

    const r2_capital_trabajo_valor_nominal = {
      capital_trabajo_anterior:
        (calculos_estado_balance.total_activo_circulante.total_activo_circulante_anterior ?? 0) -
        (calculos_estado_balance.total_pasivo_circulante.total_pasivo_circulante_anterior ?? 0),
      capital_trabajo_previo_anterior:
        (calculos_estado_balance.total_activo_circulante.total_activo_circulante_previo_anterior ?? 0) -
        (calculos_estado_balance.total_pasivo_circulante.total_pasivo_circulante_previo_anterior ?? 0)
    }
    insertData.r2_capital_trabajo_valor_nominal = r2_capital_trabajo_valor_nominal
    logger.info(`${fileMethod} | ${customUuid} Ratio R2 capital de trabajo valor nominal: ${JSON.stringify(r2_capital_trabajo_valor_nominal)}`)

    const r3_prueba_acida_numero_veces = {
      prueba_acida_numero_veces_anterior:
        parseFloat(
          (
            ((calculos_estado_balance.total_activo_circulante.total_activo_circulante_anterior ?? 0) -
              parseFloat(calculos_estado_balance.estado_balance_anterior.inventarios_anterior ?? 0)) /
            (calculos_estado_balance.total_pasivo_circulante.total_pasivo_circulante_anterior || 1)
          ).toFixed(1)
        ),
      prueba_acida_numero_veces_previo_anterior:
        parseFloat(
          (
            ((calculos_estado_balance.total_activo_circulante.total_activo_circulante_previo_anterior ?? 0) -
              parseFloat(calculos_estado_balance.estado_balance_previo_anterior.inventarios_previo_anterior ?? 0)) /
            (calculos_estado_balance.total_pasivo_circulante.total_pasivo_circulante_previo_anterior || 1)
          ).toFixed(1)
        )
    }
    insertData.r3_prueba_acida_numero_veces = r3_prueba_acida_numero_veces
    logger.info(`${fileMethod} | ${customUuid} Ratio R3 prueba acida numero de veces: ${JSON.stringify(r3_prueba_acida_numero_veces)}`)

    const r4_grado_general_endeudamiento_numero_veces = {
      grado_general_endeudamiento_anterior:
        (calculos_estado_balance?.total_pasivo_largo_plazo?.total_pasivo_largo_plazo_anterior ?? 0) !== 0
          ? parseFloat(
            (
              (calculos_estado_balance?.total_activo?.total_activo_anterior ?? 0) /
              (calculos_estado_balance?.total_pasivo_largo_plazo?.total_pasivo_largo_plazo_anterior ?? 1)
            ).toFixed(1)
          )
          : null,

      grado_general_endeudamiento_previo_anterior:
        (calculos_estado_balance?.total_pasivo_largo_plazo?.total_pasivo_previo_anterior ?? 0) !== 0
          ? parseFloat(
            (
              (calculos_estado_balance?.total_activo?.total_activo_previo_anterior ?? 0) /
              (calculos_estado_balance?.total_pasivo_largo_plazo?.total_pasivo_previo_anterior ?? 1)
            ).toFixed(1)
          )
          : null
    };
    logger.info(`${fileMethod} | ${customUuid} R4 Grado general de endeudamiento numero_veces: ${r4_grado_general_endeudamiento_numero_veces}`)
    insertData.r4_grado_general_endeudamiento_numero_veces = r4_grado_general_endeudamiento_numero_veces

    const r5_apalancamiento_financiero_numero_veces = {
      apalancamiento_anterior:
        (calculos_estado_balance?.total_activo?.total_activo_anterior ?? 0) !== 0
          ? parseFloat(
            (
              (calculos_estado_balance?.total_pasivo_largo_plazo?.total_pasivo_largo_plazo_anterior ?? 0) /
              (calculos_estado_balance?.total_activo?.total_activo_anterior ?? 1)
            ).toFixed(1)
          )
          : null,

      apalancamiento_previo_anterior:
        (calculos_estado_balance?.total_activo?.total_activo_previo_anterior ?? 0) !== 0
          ? parseFloat(
            (
              (calculos_estado_balance?.total_pasivo_largo_plazo?.total_pasivo_previo_anterior ?? 0) /
              (calculos_estado_balance?.total_activo?.total_activo_previo_anterior ?? 1)
            ).toFixed(1)
          )
          : null
    }
    logger.info(`${fileMethod} | ${customUuid} Apalancamiento financiero numero de veces: ${r5_apalancamiento_financiero_numero_veces}`)
    insertData.r5_apalancamiento_financiero_numero_veces = r5_apalancamiento_financiero_numero_veces

    const r6_rotacion_inventarios_numero_veces = {
      rotacion_inventarios_numero_veces_anterior:
        parseFloat(calculos_estado_balance?.estado_balance_anterior?.inventarios_anterior ?? 0) !== 0 &&
          parseFloat(calculos_estado_resultados?.estado_resultado_anterior?.costo_ventas_anuales_anterior ?? 0) !== 0
          ? parseFloat(
            (
              parseFloat(calculos_estado_balance.estado_balance_anterior.inventarios_anterior ?? 0) /
              parseFloat(calculos_estado_resultados.estado_resultado_anterior.costo_ventas_anuales_anterior ?? 1)
            ).toFixed(1)
          )
          : null,

      rotacion_inventarios_numero_veces_previo_anterior:
        parseFloat(calculos_estado_balance?.estado_balance_previo_anterior?.inventarios_previo_anterior ?? 0) !== 0 &&
          parseFloat(calculos_estado_resultados?.estado_resultado_previo_anterior?.costo_ventas_anuales_previo_anterior ?? 0) !== 0
          ? parseFloat(
            (
              parseFloat(calculos_estado_balance.estado_balance_previo_anterior.inventarios_previo_anterior ?? 0) /
              parseFloat(calculos_estado_resultados.estado_resultado_previo_anterior.costo_ventas_anuales_previo_anterior ?? 1)
            ).toFixed(1)
          )
          : null
    }
    logger.info(`${fileMethod} | ${customUuid} R6 rotacion de inventarios numero veces: ${r6_rotacion_inventarios_numero_veces}`)
    insertData.r6_rotacion_inventarios_numero_veces = r6_rotacion_inventarios_numero_veces

    const r7_rotacion_inventarios_dias = {
      rotacion_inventarios_dias_anterior:
        (parseFloat(calculos_estado_balance.estado_balance_anterior?.inventarios_anterior ?? 0) !== 0 &&
          parseFloat(calculos_estado_resultados.estado_resultado_anterior?.costo_ventas_anuales_anterior ?? 0) !== 0)
          ? parseFloat((
            (parseFloat(calculos_estado_balance.estado_balance_anterior.inventarios_anterior) /
              parseFloat(calculos_estado_resultados.estado_resultado_anterior.costo_ventas_anuales_anterior)) * 360
          ).toFixed(0))
          : null,

      rotacion_inventarios_dias_previo_anterior:
        (parseFloat(calculos_estado_balance.estado_balance_previo_anterior?.inventarios_previo_anterior ?? 0) !== 0 &&
          parseFloat(calculos_estado_resultados.estado_resultado_previo_anterior?.costo_ventas_anuales_previo_anterior ?? 0) !== 0)
          ? parseFloat((
            (parseFloat(calculos_estado_balance.estado_balance_previo_anterior.inventarios_previo_anterior) /
              parseFloat(calculos_estado_resultados.estado_resultado_previo_anterior.costo_ventas_anuales_previo_anterior)) * 360
          ).toFixed(0))
          : null
    }

    logger.info(`${fileMethod} | ${customUuid} R7 rotacion de inventarios dias: ${JSON.stringify(r7_rotacion_inventarios_dias)}`);
    insertData.r7_rotacion_inventarios_dias = r7_rotacion_inventarios_dias



    const r8_rotacion_cuentas_x_cobrar_dias = {
      rotacion_cuentas_x_cobrar_dias_anterior:
        (parseFloat(calculos_estado_balance.estado_balance_anterior.cliente_anterior ?? 0) > 0 &&
          parseFloat(calculos_estado_resultados.estado_resultado_anterior.ventas_anuales_anterior ?? 0) > 0)
          ? parseFloat(
            (
              (parseFloat(calculos_estado_balance.estado_balance_anterior.cliente_anterior ?? 0) /
                parseFloat(calculos_estado_resultados.estado_resultado_anterior.ventas_anuales_anterior ?? 1)) * 360
            ).toFixed(0)
          )
          : null,

      rotacion_cuentas_x_cobrar_dias_previo_anterior:
        (parseFloat(calculos_estado_balance.estado_balance_previo_anterior.cliente_previo_anterior ?? 0) > 0 &&
          parseFloat(calculos_estado_resultados.estado_resultado_previo_anterior.ventas_anuales_previo_anterior ?? 0) > 0)
          ? parseFloat(
            (
              (parseFloat(calculos_estado_balance.estado_balance_previo_anterior.cliente_previo_anterior ?? 0) /
                parseFloat(calculos_estado_resultados.estado_resultado_previo_anterior.ventas_anuales_previo_anterior ?? 1)) * 360
            ).toFixed(0)
          )
          : null
    }
    logger.info(`${fileMethod} | ${customUuid} R8 rotacion de cuentas por cobrar dias: ${JSON.stringify(r8_rotacion_cuentas_x_cobrar_dias)}`)
    insertData.r8_rotacion_cuentas_x_cobrar_dias = r8_rotacion_cuentas_x_cobrar_dias

    const r9_rotacion_pagos_dias = {
      rotacion_pagos_dias_anterior:
        (parseFloat(calculos_estado_resultados.estado_resultado_anterior.costo_ventas_anuales_anterior || 0) > 0)
          ? parseFloat((
            (
              parseFloat(calculos_estado_balance.estado_balance_anterior.proveedores_anterior || 0) +
              parseFloat(calculos_estado_balance.estado_balance_anterior.acreedores_anterior || 0)  // ✅ CORRECTO
            ) /
            parseFloat(calculos_estado_resultados.estado_resultado_anterior.costo_ventas_anuales_anterior || 1)
            * 360
          ).toFixed(0))
          : null,

      rotacion_pagos_dias_previo_anterior:
        (parseFloat(calculos_estado_resultados.estado_resultado_previo_anterior.costo_ventas_anuales_previo_anterior || 0) > 0)
          ? parseFloat((
            (
              parseFloat(calculos_estado_balance.estado_balance_previo_anterior.proveedores_previo_anterior || 0) +
              parseFloat(calculos_estado_balance.estado_balance_previo_anterior.acreedores_previo_anterior || 0)  // ✅ CORRECTO
            ) /
            parseFloat(calculos_estado_resultados.estado_resultado_previo_anterior.costo_ventas_anuales_previo_anterior || 1)
            * 360
          ).toFixed(0))
          : null
    }

    logger.info(`${fileMethod} | ${customUuid} R9 rotacion de pagos dias: ${JSON.stringify(r9_rotacion_pagos_dias)}`);
    insertData.r9_rotacion_pagos_dias = r9_rotacion_pagos_dias;

    const parseNumber = require('../../utils/number')
    const pasivoAnterior = parseNumber(
      calculos_estado_balance.total_pasivo_largo_plazo.total_pasivo_largo_plazo_anterior
    )
    const capitalAnterior = parseNumber(
      calculos_estado_balance.total_capital_contable.total_capital_contable_anterior
    )
    const pasivoPrevio = parseNumber(
      calculos_estado_balance.total_pasivo_largo_plazo.total_pasivo_previo_anterior
    )
    const capitalPrevio = parseNumber(
      calculos_estado_balance.total_capital_contable.total_capital_contable_previo_anterior
    )

    const solvenciaAnterior =
      !isNaN(pasivoAnterior) && !isNaN(capitalAnterior) && capitalAnterior !== 0
        ? parseFloat((pasivoAnterior / capitalAnterior).toFixed(1))
        : capitalAnterior === 0
          ? null
          : NaN
    const solvenciaPrevio =
      !isNaN(pasivoPrevio) && !isNaN(capitalPrevio) && capitalPrevio !== 0
        ? parseFloat((pasivoPrevio / capitalPrevio).toFixed(1))
        : capitalPrevio === 0
          ? null
          : NaN

    const r10_solvencia_deuda_total_sobre_capital = {
      solvencia_deuda_total_sobre_capital_anterior: solvenciaAnterior,
      solvencia_deuda_total_sobre_capital_previo_anterior: solvenciaPrevio
    }
    logger.info(`${fileMethod} | ${customUuid} R10 Solvencia deuda total sobre capital: ${JSON.stringify(r10_solvencia_deuda_total_sobre_capital)}`)
    insertData.r10_solvencia_deuda_total_sobre_capital = r10_solvencia_deuda_total_sobre_capital

    const r11_retorno_sobre_capital_acciones = {
      retorno_sobre_capital_acciones_anterior:
        (parseFloat(calculos_estado_resultados.utilidad_operacion.operacion_utilidad_operacion_anterior || 0) !== 0 &&
          parseFloat(calculos_estado_balance.total_capital_contable.total_capital_contable_anterior || 0) !== 0)
          ? parseFloat(
            (
              parseFloat(calculos_estado_resultados.utilidad_operacion.operacion_utilidad_operacion_anterior || 0) /
              parseFloat(calculos_estado_balance.total_capital_contable.total_capital_contable_anterior || 1) * 100
            ).toFixed(0)
          )
          : null,

      retorno_sobre_capital_acciones_previo_anterior:
        (parseFloat(calculos_estado_resultados.utilidad_operacion.operacion_utilidad_operacion_previo_anterior || 0) !== 0 &&
          parseFloat(calculos_estado_balance.total_capital_contable.total_capital_contable_previo_anterior || 0) !== 0)
          ? parseFloat(
            (
              parseFloat(calculos_estado_resultados.utilidad_operacion.operacion_utilidad_operacion_previo_anterior || 0) /
              parseFloat(calculos_estado_balance.total_capital_contable.total_capital_contable_previo_anterior || 1) * 100
            ).toFixed(0)
          )
          : null
    }
    logger.info(`${fileMethod} | ${customUuid} R11 Retorno sobre capital acciones: ${JSON.stringify(r11_retorno_sobre_capital_acciones)}`)
    insertData.r11_retorno_sobre_capital_acciones = r11_retorno_sobre_capital_acciones


    const r12_rendimiento_capital = {
      rendimiento_capital_anterior:
        (calculos_estado_resultados?.utilidad_neta?.utilidad_neta_anterior ?? 0) !== 0 &&
          (calculos_estado_balance?.total_capital_contable?.total_capital_contable_anterior ?? 0) !== 0
          ? parseFloat(
            (
              (calculos_estado_resultados.utilidad_neta.utilidad_neta_anterior ?? 0) /
              (calculos_estado_balance.total_capital_contable.total_capital_contable_anterior ?? 1) *
              100
            ).toFixed(1)
          )
          : null,

      rendimiento_capital_previo_anterior:
        (calculos_estado_resultados?.utilidad_neta?.utilidad_neta_previo_anterior ?? 0) !== 0 &&
          (calculos_estado_balance?.total_capital_contable?.total_capital_contable_previo_anterior ?? 0) !== 0
          ? parseFloat(
            (
              (calculos_estado_resultados.utilidad_neta.utilidad_neta_previo_anterior ?? 0) /
              (calculos_estado_balance.total_capital_contable.total_capital_contable_previo_anterior ?? 1) *
              100
            ).toFixed(1)
          )
          : null
    }
    logger.info(`${fileMethod} | ${customUuid} R12 Rendimiento capital: ${JSON.stringify(r12_rendimiento_capital)}`)
    insertData.r12_rendimiento_capital = r12_rendimiento_capital

    const r13_rendimiento_activos = {
      rendimiento_activos_anterior:
        parseFloat(calculos_estado_resultados.utilidad_neta.utilidad_neta_anterior ?? 0) !== 0 &&
          parseFloat(calculos_estado_balance.total_activo.total_activo_anterior ?? 0) !== 0
          ? Math.round(
            (
              (parseFloat(calculos_estado_resultados.utilidad_neta.utilidad_neta_anterior) /
                parseFloat(calculos_estado_balance.total_activo.total_activo_anterior)) * 100
            )
          )
          : null,

      rendimiento_activos_previo_anterior:
        parseFloat(calculos_estado_resultados.utilidad_neta.utilidad_neta_previo_anterior ?? 0) !== 0 &&
          parseFloat(calculos_estado_balance.total_activo.total_activo_previo_anterior ?? 0) !== 0
          ? Math.round(
            (
              (parseFloat(calculos_estado_resultados.utilidad_neta.utilidad_neta_previo_anterior) /
                parseFloat(calculos_estado_balance.total_activo.total_activo_previo_anterior)) * 100
            )
          )
          : null
    }

    logger.info(`${fileMethod} | ${customUuid} R13 Rendimiento activos: ${JSON.stringify(r13_rendimiento_activos)}`)
    insertData.r13_rendimiento_activos = r13_rendimiento_activos

    await certificationService.insertCalculoRatiosFinancieros(id_certification, insertData)

    return {
      error: false,
      r1_capital_trabajo_numero_veces,
      r2_capital_trabajo_valor_nominal,
      r3_prueba_acida_numero_veces,
      r4_grado_general_endeudamiento_numero_veces,
      r5_apalancamiento_financiero_numero_veces,
      r6_rotacion_inventarios_numero_veces,
      r7_rotacion_inventarios_dias,
      r8_rotacion_cuentas_x_cobrar_dias,
      r9_rotacion_pagos_dias,
      r10_solvencia_deuda_total_sobre_capital,
      r11_retorno_sobre_capital_acciones,
      r12_rendimiento_capital,
      r13_rendimiento_activos
    }
  } catch (error) {
    return { error: true, message: 'Hubo un error en los calculos de los ratios financieros', msgError: error }
  }
}

const calculoVariacionesSignificativasIndicadoresFinancieros = async (customUuid, id_certification, calculos_estado_balance, calculos_estado_resultados) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: calculoVariacionesSignificativasIndicadoresFinancieros`
  try {
    const insertData = {}
    logger.info(`${fileMethod} | ${customUuid} Inicio de calculo de variaciones significativas de indicadores financieros`)

    logger.info(`${fileMethod} | ${customUuid} Calculos estado de balance: ${JSON.stringify(calculos_estado_balance)}`)
    logger.info(`${fileMethod} | ${customUuid} Calculos estado de resultado: ${JSON.stringify(calculos_estado_resultados)}`)

    const variacion_significativa = await certificationService.consultaVariacionSignificativa()

    const cajaAnterior = Number(
      calculos_estado_balance.estado_balance_anterior?.caja_bancos_anterior ?? 0
    )

    const cajaPrevio = Number(
      calculos_estado_balance.estado_balance_previo_anterior?.caja_bancos_previo_anterior ?? 0
    )

    const variacion_anual_caja_bancos =
      cajaPrevio === 0
        ? null
        : `${Math.round(((cajaAnterior - cajaPrevio) / cajaPrevio) * 100)}`

    logger.info(`${fileMethod} | ${customUuid} Variación anual caja bancos: ${JSON.stringify(variacion_anual_caja_bancos)}`)

    const incremento_caja_bancos = Number(variacion_anual_caja_bancos) > Number(variacion_significativa[0].valor) ? 'SI' : 'NO'
    logger.info(`${fileMethod} | ${customUuid} Incremento de caja y bancos ${variacion_anual_caja_bancos} > ${variacion_significativa[0].valor}% ${JSON.stringify(incremento_caja_bancos)}`)

    insertData.incremento_caja_bancos = incremento_caja_bancos
    insertData.variacion_anual_caja_bancos = variacion_anual_caja_bancos

    const ventasAnualesAnterior = Number(
      calculos_estado_resultados.estado_resultado_anterior?.ventas_anuales_anterior ?? 0
    )

    const ventasAnualesPrevio = Number(
      calculos_estado_resultados.estado_resultado_previo_anterior?.ventas_anuales_previo_anterior ?? 0
    )

    const variacion_anual_ventas_anuales =
      ventasAnualesPrevio === 0
        ? null
        : `${Math.round(((ventasAnualesAnterior - ventasAnualesPrevio) / ventasAnualesPrevio) * 100)}`
    logger.info(`${fileMethod} | ${customUuid} Variación anual ventas anuales: ${JSON.stringify(variacion_anual_ventas_anuales)}`)

    const incremento_ventas_anuales = Number(variacion_anual_ventas_anuales) > Number(variacion_significativa[1].valor) ? 'SI' : 'NO'
    logger.info(`${fileMethod} | ${customUuid} Incremento de  Ventas anuales ${variacion_anual_ventas_anuales} > ${variacion_significativa[1].valor}% ${JSON.stringify(incremento_ventas_anuales)}`)

    insertData.incremento_ventas_anuales = incremento_ventas_anuales
    insertData.variacion_anual_ventas_anuales = variacion_anual_ventas_anuales

    const costoVentasAnualesAnterior = Number(
      calculos_estado_resultados.estado_resultado_anterior?.costo_ventas_anuales_anterior ?? 0
    )

    const costoVentasAnualesPrevio = Number(
      calculos_estado_resultados.estado_resultado_previo_anterior?.costo_ventas_anuales_previo_anterior ?? 0
    )

    const variacion_anual_costo_ventas_anuales =
      costoVentasAnualesPrevio === 0
        ? null
        : `${Math.round(((costoVentasAnualesAnterior - costoVentasAnualesPrevio) / costoVentasAnualesPrevio) * 100)}`
    logger.info(`${fileMethod} | ${customUuid} Variación anual costo ventas anuales: ${JSON.stringify(variacion_anual_costo_ventas_anuales)}`)

    const decremento_costo_ventas_anuales = Number(variacion_anual_costo_ventas_anuales) < -Number(variacion_significativa[2].valor) ? 'SI' : 'NO'
    logger.info(`${fileMethod} | ${customUuid} Decremento de costo de ventas anual ${variacion_anual_costo_ventas_anuales} < -${variacion_significativa[2].valor}% ${JSON.stringify(decremento_costo_ventas_anuales)}`)

    insertData.decremento_costo_ventas_anuales = decremento_costo_ventas_anuales
    insertData.variacion_anual_costo_ventas_anuales = variacion_anual_costo_ventas_anuales

    const gastosAdministracionAnterior = Number(
      calculos_estado_resultados.estado_resultado_anterior?.gastos_administracion_anterior ?? 0
    )

    const gastosAdministracionPrevio = Number(
      calculos_estado_resultados.estado_resultado_previo_anterior?.gastos_administracion_previo_anterior ?? 0
    )

    const variacion_anual_gastos_administracion =
      gastosAdministracionPrevio === 0
        ? null
        : `${Math.round(((gastosAdministracionAnterior - gastosAdministracionPrevio) / gastosAdministracionPrevio) * 100)}`
    logger.info(`${fileMethod} | ${customUuid} Variación anual gastoas administración: ${JSON.stringify(variacion_anual_gastos_administracion)}`)

    const decremento_gastos_administracion = Number(variacion_anual_gastos_administracion) < -Number(variacion_significativa[3].valor) ? 'SI' : 'NO'
    logger.info(`${fileMethod} | ${customUuid} Decremento de Gatos de Administración ${variacion_anual_gastos_administracion} < -${variacion_significativa[3].valor}% ${JSON.stringify(decremento_gastos_administracion)}`)

    insertData.decremento_gastos_administracion = decremento_gastos_administracion
    insertData.variacion_anual_gastos_administracion = variacion_anual_gastos_administracion

    const utilidadOperativaAnterior = Number(
      calculos_estado_resultados.estado_resultado_anterior?.utilidad_operativa_anterior ?? 0
    )

    const utilidadOperativaPrevio = Number(
      calculos_estado_resultados.estado_resultado_previo_anterior?.utilidad_operativa_previo_anterior ?? 0
    )

    const variacion_anual_utilidad_operativa =
      utilidadOperativaPrevio === 0
        ? null
        : `${Math.round(((utilidadOperativaAnterior - utilidadOperativaPrevio) / utilidadOperativaPrevio) * 100)}`
    logger.info(`${fileMethod} | ${customUuid} Variación anual utilidad operativa: ${JSON.stringify(variacion_anual_utilidad_operativa)}`)

    const incremento_utilidad_operativa = Number(variacion_anual_utilidad_operativa) > Number(variacion_significativa[4].valor) ? 'SI' : 'NO'
    logger.info(`${fileMethod} | ${customUuid}Incremento de Utilidad Operativa ${variacion_anual_utilidad_operativa} > ${variacion_significativa[4].valor}% ${JSON.stringify(incremento_utilidad_operativa)}`)

    insertData.incremento_utilidad_operativa = incremento_utilidad_operativa
    insertData.variacion_anual_utilidad_operativa = variacion_anual_utilidad_operativa

    const activoTotalAnterior = Number(
      calculos_estado_balance.total_activo?.total_activo_anterior ?? 0
    )

    const activoTotalPrevio = Number(
      calculos_estado_balance.total_activo?.total_activo_previo_anterior ?? 0
    )

    const variacion_anual_total_activo =
      activoTotalPrevio === 0
        ? null
        : `${Math.round(((activoTotalAnterior - activoTotalPrevio) / activoTotalPrevio) * 100)}`
    logger.info(`${fileMethod} | ${customUuid} Variación anual total activo: ${JSON.stringify(variacion_anual_total_activo)}`)

    const incremento_total_activo = Number(variacion_anual_total_activo) > Number(variacion_significativa[5].valor) ? 'SI' : 'NO'
    logger.info(`${fileMethod} | ${customUuid} Incremento de Activo total ${variacion_anual_total_activo} > ${variacion_significativa[5].valor}% ${JSON.stringify(incremento_total_activo)}`)

    insertData.incremento_total_activo = incremento_total_activo
    insertData.variacion_anual_total_activo = variacion_anual_total_activo

    const pasivoTotalAnterior = Number(
      calculos_estado_balance.total_pasivo_largo_plazo?.total_pasivo_largo_plazo_anterior ?? 0
    )

    const pasivoTotalPrevio = Number(
      calculos_estado_balance.total_pasivo_largo_plazo?.total_pasivo_previo_anterior ?? 0
    )

    const variacion_anual_total_pasivo =
      pasivoTotalPrevio === 0
        ? null
        : `${Math.round(((pasivoTotalAnterior - pasivoTotalPrevio) / pasivoTotalPrevio) * 100)}`
    logger.info(`${fileMethod} | ${customUuid} Variación anual total pasivo: ${JSON.stringify(variacion_anual_total_pasivo)}`)

    const decremento_total_pasivo = Number(variacion_anual_total_pasivo) < -Number(variacion_significativa[6].valor) ? 'SI' : 'NO'
    logger.info(`${fileMethod} | ${customUuid} Decremento de Pasivo Total ${variacion_anual_total_pasivo} < -${variacion_significativa[6].valor}% ${JSON.stringify(decremento_total_pasivo)}`)

    insertData.decremento_total_pasivo = decremento_total_pasivo
    insertData.variacion_anual_total_pasivo = variacion_anual_total_pasivo

    const capitalSocialAnterior = Number(
      calculos_estado_balance.estado_balance_anterior?.capital_social_anterior ?? 0
    )

    const capitalSocialPrevio = Number(
      calculos_estado_balance.estado_balance_previo_anterior?.capital_social_previo_anterior ?? 0
    )

    const variacion_anual_capital_social =
      capitalSocialPrevio === 0
        ? null
        : `${Math.round(((capitalSocialAnterior - capitalSocialPrevio) / capitalSocialPrevio) * 100)}`
    logger.info(`${fileMethod} | ${customUuid} Variación anual capital social: ${JSON.stringify(variacion_anual_capital_social)}`)

    const incremento_capital_social = Number(variacion_anual_capital_social) > Number(variacion_significativa[7].valor) ? 'SI' : 'NO'
    logger.info(`${fileMethod} | ${customUuid} Incremento de Capital Social ${variacion_anual_capital_social} > ${variacion_significativa[7].valor}% ${JSON.stringify(decremento_total_pasivo)}`)

    const decremento_capital_social = Number(variacion_anual_capital_social) < -Number(variacion_significativa[7].valor) ? 'SI' : 'NO'
    logger.info(`${fileMethod} | ${customUuid} Decremento de Capital social ${variacion_anual_capital_social} < -${variacion_significativa[7].valor}% ${JSON.stringify(decremento_capital_social)}`)

    insertData.incremento_capital_social = incremento_capital_social
    insertData.decremento_capital_social = decremento_capital_social
    insertData.variacion_anual_capital_social = variacion_anual_capital_social

    const totalCapitalContableAnterior = Number(
      calculos_estado_balance.total_capital_contable?.total_capital_contable_anterior ?? 0
    )

    const totalCapitalContableSocialPrevio = Number(
      calculos_estado_balance.total_capital_contable?.total_capital_contable_previo_anterior ?? 0
    )

    const variacion_anual_capital_contable =
      totalCapitalContableSocialPrevio === 0
        ? null
        : `${Math.round(((totalCapitalContableAnterior - totalCapitalContableSocialPrevio) / totalCapitalContableSocialPrevio) * 100)}`
    logger.info(`${fileMethod} | ${customUuid} Variación anual capital contable: ${JSON.stringify(variacion_anual_capital_contable)}`)

    const incremento_capital_contable = Number(variacion_anual_capital_contable) > Number(variacion_significativa[8].valor) ? 'SI' : 'NO'
    logger.info(`${fileMethod} | ${customUuid} Incremento de Capital contable o patrimonio ${variacion_anual_capital_contable} > ${variacion_significativa[8].valor}% ${JSON.stringify(incremento_capital_contable)}`)

    const decremento_capital_contable = Number(variacion_anual_capital_contable) < Number(variacion_significativa[8].valor) ? 'SI' : 'NO'
    logger.info(`${fileMethod} | ${customUuid} Decremento de Capital contable o patrimonio ${variacion_anual_capital_contable} < ${variacion_significativa[8].valor}% ${JSON.stringify(decremento_capital_contable)}`)

    insertData.incremento_capital_contable = incremento_capital_contable
    insertData.decremento_capital_contable = decremento_capital_contable
    insertData.variacion_anual_capital_contable = variacion_anual_capital_contable

    logger.info(`${fileMethod} | ${customUuid} Variaciones a insertar: ${JSON.stringify(insertData)}`)

    await certificationService.insertVariacionesSignificativasResultado(id_certification, insertData)
    const [variaciones] = await certificationService.getVariacionesSignificativasByCertification(id_certification)

    return variaciones

  } catch (error) {
    logger.error(`${fileMethod} | ${customUuid} Error en el calculo de Variaciones: ${error}`)
    return { error: true, message: 'Hubo un error en los calculos de variaciones significativas', msgError: error }
  }
}

// const calculoRatiosFinancieros = async (customUuid, id_certification, calculos_estado_balance, calculos_estado_resultados) => {
//   const fileMethod = `file: src/controllers/api/certification.js - method: calculoRatiosFinancieros`
//   try {
//     const insertData = {}
//     logger.info(`${fileMethod} | ${customUuid} Inicio de calculo de ratios financieros`)
//     const { total_activo_circulante, total_actvo, total_pasivo_circulante, total_pasivo, total_capital_contable, estado_balance_anterior, estado_balance_previo_anterior } = calculos_estado_balance
//     const { utilidad_operacion, utilidad_neta, estado_resultado_anterior, estado_resultado_previo_anterior } = calculos_estado_resultados

//     logger.info(`${fileMethod} | ${customUuid} Calculos estado de balance: ${JSON.stringify(calculos_estado_balance)}`)
//     logger.info(`${fileMethod} | ${customUuid} Calculos estado de resultado: ${JSON.stringify(calculos_estado_resultados)}`)

//     // capital_trabajo

//     const formula_1_capital_trabajo_anterior = parseFloat(total_activo_circulante.total_activo_circulante_anterior) / parseFloat(total_pasivo_circulante.total_pasivo_circulante_anterior)
//     logger.info(`${fileMethod} | ${customUuid} Formula 1 capital de trabajo : ${total_activo_circulante.total_activo_circulante_anterior} / ${total_activo_circulante.total_activo_circulante_anterior} = ${JSON.stringify(formula_1_capital_trabajo_anterior)}`)
//     insertData.formula_1_capital_trabajo_anterior = formula_1_capital_trabajo_anterior

//     const formula_1_capital_trabajo_previo_anterior = parseFloat(total_activo_circulante.total_activo_circulante_previo_anterior) / parseFloat(total_pasivo_circulante.total_pasivo_circulante_previo_anterior)
//     logger.info(`${fileMethod} | ${customUuid} Formula 1 capital de trabajo : ${total_activo_circulante.total_activo_circulante_previo_anterior} / ${total_pasivo_circulante.total_pasivo_circulante_previo_anterior} = ${JSON.stringify(formula_1_capital_trabajo_previo_anterior)}`)
//     insertData.formula_1_capital_trabajo_previo_anterior = formula_1_capital_trabajo_previo_anterior

//     const formula_2_capital_trabajo_anterior = parseFloat(total_activo_circulante.total_activo_circulante_anterior) - parseFloat(total_pasivo_circulante.total_pasivo_circulante_anterior)
//     logger.info(`${fileMethod} | ${customUuid} Formula 2 capital de trabajo : ${total_activo_circulante.total_activo_circulante_anterior} - ${total_pasivo_circulante.total_pasivo_circulante_anterior} = ${JSON.stringify(formula_2_capital_trabajo_anterior)}`)
//     insertData.formula_2_capital_trabajo_anterior = formula_2_capital_trabajo_anterior

//     const formula_2_capital_trabajo_previo_anterior = parseFloat(total_activo_circulante.total_activo_circulante_previo_anterior) - parseFloat(total_pasivo_circulante.total_pasivo_circulante_previo_anterior)
//     logger.info(`${fileMethod} | ${customUuid} Formula 2 capital de trabajo : ${total_activo_circulante.total_activo_circulante_previo_anterior} - ${total_pasivo_circulante.total_pasivo_circulante_previo_anterior} = ${JSON.stringify(formula_2_capital_trabajo_previo_anterior)}`)
//     insertData.formula_2_capital_trabajo_previo_anterior = formula_2_capital_trabajo_previo_anterior

//     // prueba acida

//     const prueba_acida_anterior = (parseFloat(total_activo_circulante.total_activo_circulante_anterior) - parseFloat(estado_balance_anterior.inventarios_anterior)) / parseFloat(total_pasivo_circulante.total_pasivo_circulante_anterior)
//     logger.info(`${fileMethod} | ${customUuid} prueba acida : (${total_activo_circulante.total_activo_circulante_anterior} - ${estado_balance_anterior.inventarios_anterior}) / ${total_pasivo_circulante.total_pasivo_circulante_anterior} = ${JSON.stringify(prueba_acida_anterior)}`)
//     insertData.prueba_acida_anterior = prueba_acida_anterior

//     const prueba_acida_previo_anterior = (parseFloat(total_activo_circulante.total_activo_circulante_previo_anterior) - parseFloat(estado_balance_previo_anterior.inventarios_previo_anterior)) / parseFloat(total_pasivo_circulante.total_pasivo_circulante_previo_anterior)
//     logger.info(`${fileMethod} | ${customUuid} prueba acida : (${total_activo_circulante.total_activo_circulante_previo_anterior} - ${estado_balance_previo_anterior.inventarios_previo_anterior}) / ${total_pasivo_circulante.total_pasivo_circulante_previo_anterior} = ${JSON.stringify(prueba_acida_anterior)}`)
//     insertData.prueba_acida_previo_anterior = prueba_acida_previo_anterior

//     // grado general de endeudamiento

//     const grado_general_endeudamiento_anterior = parseFloat(total_actvo.total_activo_anterior) / parseFloat(total_pasivo.total_pasivo_anterior)
//     logger.info(`${fileMethod} | ${customUuid} grado general de endeudamiento : ${total_actvo.total_activo_anterior} / ${total_pasivo.total_pasivo_anterior} = ${JSON.stringify(grado_general_endeudamiento_anterior)}`)
//     insertData.grado_general_endeudamiento_anterior = grado_general_endeudamiento_anterior

//     const grado_general_endeudamiento_previo_anterior = parseFloat(total_actvo.total_activo_previo_anterior) / parseFloat(total_pasivo.total_pasivo_previo_anterior)
//     logger.info(`${fileMethod} | ${customUuid} grado general de endeudamiento : ${total_actvo.total_activo_previo_anterior} / ${total_pasivo.total_pasivo_previo_anterior} = ${JSON.stringify(grado_general_endeudamiento_previo_anterior)}`)
//     insertData.grado_general_endeudamiento_previo_anterior = grado_general_endeudamiento_previo_anterior

//     // apalancamiento financiero

//     const apalancamiento_anterior = parseFloat(total_pasivo.total_pasivo_anterior) / parseFloat(total_actvo.total_activo_anterior)
//     logger.info(`${fileMethod} | ${customUuid} apalancamiento financiero anterior: ${total_pasivo.total_pasivo_anterior} / ${total_actvo.total_activo_anterior} = ${JSON.stringify(apalancamiento_anterior)}`)
//     insertData.apalancamiento_anterior = apalancamiento_anterior

//     const apalancamiento_previo_anterior = parseFloat(total_pasivo.total_pasivo_previo_anterior) / parseFloat(total_actvo.total_activo_previo_anterior)
//     logger.info(`${fileMethod} | ${customUuid} apalancamiento financiero previo anterior: ${total_pasivo.total_pasivo_previo_anterior} / ${total_actvo.total_activo_previo_anterior} = ${JSON.stringify(apalancamiento_previo_anterior)}`)
//     insertData.apalancamiento_previo_anterior = apalancamiento_previo_anterior

//     // inventarios_rotacion

//     const formula_1_inventarios_rotacion_anterior = parseFloat(estado_resultado_anterior.costo_ventas_anuales_anterior) / parseFloat(estado_balance_anterior.inventarios_anterior)
//     logger.info(`${fileMethod} | ${customUuid} formula 1 inventarios rotacion anterior: ${estado_resultado_anterior.costo_ventas_anuales_anterior} / ${estado_balance_anterior.inventarios_anterior} = ${JSON.stringify(formula_1_inventarios_rotacion_anterior)}`)
//     insertData.formula_1_inventarios_rotacion_anterior = formula_1_inventarios_rotacion_anterior

//     const formula_1_inventarios_rotacion_previo_anterior = parseFloat(estado_resultado_previo_anterior.costo_ventas_anuales_previo_anterior) / parseFloat(estado_balance_previo_anterior.inventarios_previo_anterior)
//     logger.info(`${fileMethod} | ${customUuid} formula 1 inventarios rotacion previo anterior: ${estado_resultado_previo_anterior.costo_ventas_anuales_previo_anterior} / ${estado_balance_previo_anterior.inventarios_previo_anterior} = ${JSON.stringify(formula_1_inventarios_rotacion_previo_anterior)}`)
//     insertData.formula_1_inventarios_rotacion_previo_anterior = formula_1_inventarios_rotacion_previo_anterior

//     const formula_2_inventarios_rotacion_anterior = (parseFloat(estado_balance_anterior.inventarios_anterior) / parseFloat(estado_resultado_anterior.costo_ventas_anuales_anterior)) * 360
//     logger.info(`${fileMethod} | ${customUuid} formula 2 inventarios rotacion anterior: (${estado_balance_anterior.inventarios_anterior} / ${estado_resultado_anterior.costo_ventas_anuales_anterior}) * 360 = ${JSON.stringify(formula_2_inventarios_rotacion_anterior)}`)
//     insertData.formula_2_inventarios_rotacion_anterior = formula_2_inventarios_rotacion_anterior

//     const formula_2_inventarios_rotacion_previo_anterior = (parseFloat(estado_balance_previo_anterior.inventarios_previo_anterior) / parseFloat(estado_resultado_previo_anterior.costo_ventas_anuales_previo_anterior)) * 360
//     logger.info(`${fileMethod} | ${customUuid} formula 2 inventarios rotacion previo anterior: (${estado_balance_anterior.inventarios_previo_anterior} / ${estado_resultado_previo_anterior.costo_ventas_anuales_previo_anterior}) * 360 = ${JSON.stringify(formula_2_inventarios_rotacion_previo_anterior)}`)
//     insertData.formula_2_inventarios_rotacion_previo_anterior = formula_2_inventarios_rotacion_previo_anterior

//     // rotacion de cuentas por cobrar

//     const rotacion_ctas_x_cobrar_anterior = parseFloat(estado_balance_anterior.cliente_anterior) / parseFloat(estado_resultado_anterior.ventas_anuales_anterior)
//     logger.info(`${fileMethod} | ${customUuid} rotacion cuentas por cobrar anterior: ${estado_balance_anterior.cliente_anterior} / ${estado_resultado_anterior.ventas_anuales_anterior} = ${JSON.stringify(rotacion_ctas_x_cobrar_anterior)}`)
//     insertData.rotacion_ctas_x_cobrar_anterior = rotacion_ctas_x_cobrar_anterior

//     const rotacion_ctas_x_cobrar_previo_anterior = parseFloat(estado_balance_previo_anterior.cliente_previo_anterior) / parseFloat(estado_resultado_previo_anterior.ventas_anuales_previo_anterior)
//     logger.info(`${fileMethod} | ${customUuid} rotacion cuentas por cobrar previo anterior: ${estado_balance_previo_anterior.cliente_previo_anterior} / ${estado_resultado_previo_anterior.ventas_anuales_previo_anterior} = ${JSON.stringify(rotacion_ctas_x_cobrar_previo_anterior)}`)
//     insertData.rotacion_ctas_x_cobrar_previo_anterior = rotacion_ctas_x_cobrar_previo_anterior

//     // rotacion de pagos

//     const rotacion_pagos_anterior = ((parseFloat(estado_balance_anterior.proveedores_anterior) + parseFloat(estado_balance_anterior.acreedores_anterior)) / parseFloat(estado_resultado_anterior.ventas_anuales_anterior)) * 360
//     logger.info(`${fileMethod} | ${customUuid} rotacion cuentas por cobrar anterior: ((${estado_balance_anterior.proveedores_anterior} + ${estado_balance_anterior.acreedores_anterior}) / ${estado_resultado_anterior.ventas_anuales_anterior} ) * 360 = ${JSON.stringify(rotacion_ctas_x_cobrar_anterior)}`)
//     insertData.rotacion_pagos_anterior = rotacion_pagos_anterior

//     const rotacion_pagos_previo_anterior = ((parseFloat(estado_balance_previo_anterior.proveedores_previo_anterior) + parseFloat(estado_balance_previo_anterior.acreedores_previo_anterior)) / parseFloat(estado_resultado_previo_anterior.costo_ventas_anuales_previo_anterior)) * 360
//     logger.info(`${fileMethod} | ${customUuid} rotacion cuentas por cobrar previo anterior: ((${estado_balance_anterior.proveedores_previo_anterior} + ${estado_balance_anterior.acreedores_previo_anterior}) / ${estado_resultado_anterior.ventas_anuales_previo_anterior} ) * 360 = ${JSON.stringify(rotacion_ctas_x_cobrar_previo_anterior)}`)
//     insertData.rotacion_pagos_previo_anterior = rotacion_pagos_previo_anterior

//     // solvencia

//     const solvencia_anterior = parseFloat(total_pasivo.total_pasivo_anterior) / parseFloat(total_capital_contable.total_capital_contable_anterior)
//     logger.info(`${fileMethod} | ${customUuid} solvencia anterior: ${total_pasivo.total_pasivo_anterior} / ${total_capital_contable.total_capital_contable_anterior} = ${JSON.stringify(solvencia_anterior)}`)
//     insertData.solvencia_anterior = solvencia_anterior

//     const solvencia_previo_anterior = parseFloat(total_pasivo.total_pasivo_previo_anterior) / parseFloat(total_capital_contable.total_capital_contable_previo_anterior)
//     logger.info(`${fileMethod} | ${customUuid} solvencia previo anterior: ${solvencia_previo_anterior} / ${total_capital_contable.total_capital_contable_previo_anterior} = ${JSON.stringify(solvencia_previo_anterior)}`)
//     insertData.solvencia_previo_anterior = solvencia_previo_anterior

//     // retorno capital de acciones

//     const retorno_capital_acciones_anterior = parseFloat(utilidad_operacion.operacion_utilidad_operacion_anterior) / parseFloat(total_capital_contable.total_capital_contable_anterior)
//     logger.info(`${fileMethod} | ${customUuid} retorno capital acciones anterior: ${utilidad_operacion.operacion_utilidad_operacion_anterior} / ${total_capital_contable.total_capital_contable_anterior} = ${JSON.stringify(retorno_capital_acciones_anterior)}`)
//     insertData.retorno_capital_acciones_anterior = retorno_capital_acciones_anterior

//     const retorno_capital_acciones_previo_anterior = parseFloat(utilidad_operacion.operacion_utilidad_operacion_previo_anterior) / parseFloat(total_capital_contable.total_capital_contable_previo_anterior)
//     logger.info(`${fileMethod} | ${customUuid} retorno capital acciones previo anterior: ${utilidad_operacion.operacion_utilidad_operacion_previo_anterior} / ${total_capital_contable.total_capital_contable_previo_anterior} = ${JSON.stringify(retorno_capital_acciones_previo_anterior)}`)
//     insertData.retorno_capital_acciones_previo_anterior = retorno_capital_acciones_previo_anterior

//     // rendimiento del capital

//     const rendimiento_capital_anterior = (parseFloat(utilidad_neta.utilidad_neta_anterior) / parseFloat(total_capital_contable.total_capital_contable_anterior)) * 100
//     logger.info(`${fileMethod} | ${customUuid} rendimiento capital anterior: (${utilidad_operacion.operacion_utilidad_operacion_anterior} / ${total_capital_contable.total_capital_contable_anterior}) * 100 = ${JSON.stringify(retorno_capital_acciones_anterior)}`)
//     insertData.rendimiento_capital_anterior = rendimiento_capital_anterior

//     const rendimiento_capital_previo_anterior = (parseFloat(utilidad_neta.utilidad_neta_previo_anterior) / parseFloat(total_capital_contable.total_capital_contable_previo_anterior)) * 100
//     logger.info(`${fileMethod} | ${customUuid} rendimiento capital previo anterior: (${utilidad_neta.utilidad_neta_previo_anterior} / ${total_capital_contable.total_capital_contable_previo_anterior}) * 100 = ${JSON.stringify(rendimiento_capital_previo_anterior)}`)
//     insertData.rendimiento_capital_previo_anterior = rendimiento_capital_previo_anterior

//     // rendimiento de los activos

//     const rendimiento_activos_anterior = (parseFloat(utilidad_neta.utilidad_neta_anterior) / parseFloat(total_actvo.total_activo_anterior)) * 100
//     logger.info(`${fileMethod} | ${customUuid} rendimiento capital anterior: (${utilidad_neta.utilidad_neta_anterior} / ${total_actvo.total_activo_anterior}) * 100 = ${JSON.stringify(rendimiento_activos_anterior)}`)
//     insertData.rendimiento_activos_anterior = rendimiento_activos_anterior

//     const rendimiento_activos_previo_anterior = (parseFloat(utilidad_neta.utilidad_neta_previo_anterior) / parseFloat(total_actvo.total_activo_previo_anterior)) * 100
//     logger.info(`${fileMethod} | ${customUuid} rendimiento capital anterior: (${utilidad_neta.utilidad_neta_previo_anterior} / ${total_actvo.total_activo_previo_anterior}) * 100 = ${JSON.stringify(rendimiento_activos_anterior)}`)
//     insertData.rendimiento_activos_previo_anterior = rendimiento_activos_previo_anterior

//     await certificationService.insertCalculoRatiosFinancieros(id_certification, insertData)
//     return {
//       error: false,
//       formula_1_capital_trabajo_anterior,
//       formula_1_capital_trabajo_previo_anterior,
//       formula_2_capital_trabajo_anterior,
//       formula_2_capital_trabajo_previo_anterior,
//       prueba_acida_anterior,
//       prueba_acida_previo_anterior,
//       grado_general_endeudamiento_anterior,
//       grado_general_endeudamiento_previo_anterior,
//       apalancamiento_anterior,
//       apalancamiento_previo_anterior,
//       formula_1_inventarios_rotacion_anterior,
//       formula_1_inventarios_rotacion_previo_anterior,
//       formula_2_inventarios_rotacion_anterior,
//       formula_2_inventarios_rotacion_previo_anterior,
//       rotacion_ctas_x_cobrar_anterior,
//       rotacion_ctas_x_cobrar_previo_anterior,
//       rotacion_pagos_anterior,
//       rotacion_pagos_previo_anterior,
//       solvencia_anterior,
//       solvencia_previo_anterior,
//       retorno_capital_acciones_anterior,
//       retorno_capital_acciones_previo_anterior,
//       rendimiento_capital_anterior,
//       rendimiento_capital_previo_anterior,
//       rendimiento_activos_anterior,
//       rendimiento_activos_previo_anterior
//     }


//   } catch (error) {
//     return { error: true, message: 'Hubo un error en los calculos de los ratiosfinancieros', msgError: error }
//   }
// }

const calculosEstadoResultados = async (customUuid, id_certification) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: calculosEstadoResultados`
  try {
    const insertData = {}
    logger.info(`${fileMethod} | ${customUuid} Inician calculos del estado de resultados`)
    const [estado_resultado_anterior] = await certificationService.getEstadoResultadoData(id_certification, 'anterior')
    const [estado_resultado_previo_anterior] = await certificationService.getEstadoResultadoData(id_certification, 'previo_anterior')

    logger.info(`${fileMethod} | ${customUuid} Resultado anterior: ${JSON.stringify(estado_resultado_anterior)}`)
    logger.info(`${fileMethod} | ${customUuid} Resultado previo anterior: ${JSON.stringify(estado_resultado_previo_anterior)}`)

    const parseNumber = require('../../utils/number')
    const toFloat = (value) => parseNumber(value)

    const { ventas_anuales_anterior, costo_ventas_anuales_anterior } = estado_resultado_anterior
    const operacion_utilidad_bruta_anterior = toFloat(ventas_anuales_anterior) - toFloat(costo_ventas_anuales_anterior)

    insertData.operacion_utilidad_bruta_anterior = operacion_utilidad_bruta_anterior

    logger.info(`${fileMethod} | ${customUuid} Utilidad bruta anterior: ${JSON.stringify(operacion_utilidad_bruta_anterior)}`)

    const { ventas_anuales_previo_anterior, costo_ventas_anuales_previo_anterior } = estado_resultado_previo_anterior
    const operacion_utilidad_bruta_previo_anterior = toFloat(ventas_anuales_previo_anterior) - toFloat(costo_ventas_anuales_previo_anterior)
    insertData.operacion_utilidad_bruta_previo_anterior = operacion_utilidad_bruta_previo_anterior

    logger.info(`${fileMethod} | ${customUuid} Utilidad bruta previo anterior: ${JSON.stringify(operacion_utilidad_bruta_previo_anterior)}`)

    const { utilidad_bruta_anterior, gastos_administracion_anterior } = estado_resultado_anterior
    const operacion_utilidad_operacion_anterior = toFloat(utilidad_bruta_anterior) - toFloat(gastos_administracion_anterior)
    insertData.operacion_utilidad_operacion_anterior = operacion_utilidad_operacion_anterior

    logger.info(`${fileMethod} | ${customUuid} Utilidad operacion anterior: ${JSON.stringify(operacion_utilidad_operacion_anterior)}`)

    const { utilidad_bruta_previo_anterior, gastos_administracion_previo_anterior } = estado_resultado_previo_anterior
    const operacion_utilidad_operacion_previo_anterior = toFloat(utilidad_bruta_previo_anterior) - toFloat(gastos_administracion_previo_anterior)
    insertData.operacion_utilidad_operacion_previo_anterior = operacion_utilidad_operacion_previo_anterior

    logger.info(`${fileMethod} | ${customUuid} Utilidad operacion previo anterior: ${JSON.stringify(utilidad_bruta_previo_anterior)}`)

    const { utilidad_operativa_anterior, gastos_productos_financieros_anterior, depreciacion_amortizacion_anterior, otros_ingresos_anterior, otros_egresos_anterior, otros_gastos_anterior } = estado_resultado_anterior
    const utilidad_neta_anterior =
      toFloat(utilidad_operativa_anterior)
      - toFloat(gastos_productos_financieros_anterior)
      - toFloat(depreciacion_amortizacion_anterior)
      + toFloat(otros_ingresos_anterior)
      - toFloat(otros_egresos_anterior)
      - toFloat(otros_gastos_anterior)

    insertData.utilidad_neta_anterior = utilidad_neta_anterior

    logger.info(`${fileMethod} | ${customUuid} Utilidad neta anterior: ${JSON.stringify(utilidad_neta_anterior)}`)

    const { utilidad_operativa_previo_anterior, gastos_productos_financieros_previo_anterior, depreciacion_amortizacion_previo_anterior, otros_ingresos_previo_anterior, otros_egresos_previo_anterior, otros_gastos_previo_anterior } = estado_resultado_previo_anterior
    const utilidad_neta_previo_anterior =
      toFloat(utilidad_operativa_previo_anterior)
      - toFloat(gastos_productos_financieros_previo_anterior)
      - toFloat(depreciacion_amortizacion_previo_anterior)
      + toFloat(otros_ingresos_previo_anterior)
      - toFloat(otros_egresos_previo_anterior)
      - toFloat(otros_gastos_previo_anterior)

    insertData.utilidad_neta_previo_anterior = utilidad_neta_previo_anterior

    logger.info(`${fileMethod} | ${customUuid} Utilidad neta previo anterior: ${JSON.stringify(utilidad_neta_previo_anterior)}`)

    await certificationService.insertCalculoEstadoResultado(id_certification, insertData)

    return {
      error: false,
      utilidad_bruta: {
        operacion_utilidad_bruta_anterior,
        operacion_utilidad_bruta_previo_anterior
      },
      utilidad_operacion: {
        operacion_utilidad_operacion_anterior,
        operacion_utilidad_operacion_previo_anterior
      },
      utilidad_neta: {
        utilidad_neta_anterior,
        utilidad_neta_previo_anterior
      },
      estado_resultado_anterior,
      estado_resultado_previo_anterior
    }

  } catch (error) {
    return { error: true, message: 'Hubo un error en los calculos del estado de resultados', msgError: error }
  }
}

const calculoEstadoBalance = async (customUuid, id_certification) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: calculoEstadoBalance`
  try {
    const insertData = {}
    logger.info(`${fileMethod} | ${customUuid} Inician calculos del estado de balance`)

    const [estado_balance_anterior] = await certificationService.getEstadoBalanceData(id_certification, 'anterior')
    if (!estado_balance_anterior) return { error: true, message: `No existen partidas de estado de balance anterior con el id certificacion: ${id_certification} ` }
    logger.info(`${fileMethod} | ${customUuid} Balance anterior: ${JSON.stringify(estado_balance_anterior)}`)

    const [estado_balance_previo_anterior] = await certificationService.getEstadoBalanceData(id_certification, 'previo_anterior')
    if (!estado_balance_anterior) return { error: true, message: `No existen partidas de estado de balance previo anterior con el id certificacion: ${id_certification} ` }

    logger.info(`${fileMethod} | ${customUuid} Balance previo anterior: ${JSON.stringify(estado_balance_previo_anterior)}`)

    logger.info(`${fileMethod} | ${customUuid} ------------------------  INICIA SECCION DE CALCULO DE ACTIVO CIRCULANTE PARA RATIOS FINANCIEROS  ------------------------`)

    const { caja_bancos_anterior, inventarios_anterior, cliente_anterior, deudores_diversos_anterior, otros_activos_anterior } = estado_balance_anterior
    const parseNumber = require('../../utils/number')
    const toFloat = (value) => parseNumber(value)

    const total_activo_circulante_anterior =
      toFloat(caja_bancos_anterior) +
      toFloat(cliente_anterior) +
      toFloat(inventarios_anterior) +
      toFloat(deudores_diversos_anterior) +
      toFloat(otros_activos_anterior)

    logger.info(`${fileMethod} | ${customUuid} ${total_activo_circulante_anterior} = ${caja_bancos_anterior} + ${cliente_anterior} + ${inventarios_anterior} + ${deudores_diversos_anterior} + ${otros_activos_anterior}`)
    logger.info(`${fileMethod} | ${customUuid} Total activo circulante anterior = caja_bancos_anterior + cliente_anterior + inventarios_anterior + deudores_diversos_anterior + otros_activos_anterior`)

    insertData.total_activo_circulante_anterior = total_activo_circulante_anterior

    logger.info(`${fileMethod} | ${customUuid} Total activo circulante anterior: ${JSON.stringify(total_activo_circulante_anterior)}`)

    const { caja_bancos_previo_anterior, inventarios_previo_anterior, cliente_previo_anterior, deudores_diversos_previo_anterior, otros_activos_previo_anterior } = estado_balance_previo_anterior

    const total_activo_circulante_previo_anterior =
      toFloat(caja_bancos_previo_anterior) +
      toFloat(inventarios_previo_anterior) +
      toFloat(cliente_previo_anterior) +
      toFloat(deudores_diversos_previo_anterior) +
      toFloat(otros_activos_previo_anterior)

    logger.info(`${fileMethod} | ${customUuid} ${total_activo_circulante_previo_anterior} = ${caja_bancos_previo_anterior} + ${cliente_previo_anterior} + ${inventarios_previo_anterior} + ${deudores_diversos_previo_anterior} + ${otros_activos_previo_anterior}`)
    logger.info(`${fileMethod} | ${customUuid} Total activo circulante anterior = caja_bancos_previo_anterior + cliente_previo_anterior + inventarios_previo_anterior + deudores_diversos_previo_anterior + otros_activos_previo_anterior`)

    insertData.total_activo_circulante_previo_anterior = total_activo_circulante_previo_anterior

    logger.info(`${fileMethod} | ${customUuid} Total activo circulante previo anterior: ${JSON.stringify(total_activo_circulante_previo_anterior)}`)

    logger.info(`${fileMethod} | ${customUuid} ------------------------  FINALIZA SECCION DE CALCULO DE ACTIVO CIRCULANTE PARA RATIOS FINANCIEROS  ------------------------`)

    logger.info(`${fileMethod} | ${customUuid} ------------------------  INICIA SECCION DE CALCULO DE ACTIVO FIJO PARA RATIOS FINANCIEROS  ------------------------`)

    const { activo_fijo_anterior, activo_intangible_anterior, activo_diferido_anterior, otros_activos_fijos_largo_plazo_anterior } = estado_balance_anterior

    const total_activo_fijo_anterior =
      toFloat(activo_fijo_anterior) +
      toFloat(activo_intangible_anterior) +
      toFloat(activo_diferido_anterior) +
      toFloat(otros_activos_fijos_largo_plazo_anterior)

    logger.info(`${fileMethod} | ${customUuid} ${total_activo_fijo_anterior} = ${activo_fijo_anterior} + ${activo_intangible_anterior} + ${activo_diferido_anterior} + ${otros_activos_fijos_largo_plazo_anterior}`)
    logger.info(`${fileMethod} | ${customUuid} total_activo_fijo_anterior = activo_fijo_anterior + activo_intangible_anterior + activo_diferido_anterior + otros_activos_fijos_largo_plazo_anterior + otros_activos_fijos_largo_plazo_anterior`)

    insertData.total_activo_fijo_anterior = total_activo_fijo_anterior

    const total_activo_anterior =
      toFloat(total_activo_circulante_anterior) +
      toFloat(total_activo_fijo_anterior)

    logger.info(`${fileMethod} | ${customUuid} ${total_activo_anterior} = ${total_activo_circulante_anterior} + ${total_activo_fijo_anterior} `)
    logger.info(`${fileMethod} | ${customUuid} total_activo_anterior = total_activo_circulante_anterior + total_activo_fijo_anterior`)

    insertData.total_activo_anterior = total_activo_anterior

    logger.info(`${fileMethod} | ${customUuid} Total activo anterior: ${JSON.stringify(total_activo_anterior)}`)


    const { activo_fijo_previo_anterior, activo_intangible_previo_anterior, activo_diferido_previo_anterior, otros_activos_fijos_largo_plazo_previo_anterior } = estado_balance_previo_anterior

    const total_activo_fijo_previo_anterior =
      toFloat(activo_fijo_previo_anterior) +
      toFloat(activo_intangible_previo_anterior) +
      toFloat(activo_diferido_previo_anterior) +
      toFloat(otros_activos_fijos_largo_plazo_previo_anterior)

    logger.info(`${fileMethod} | ${customUuid} ${total_activo_fijo_previo_anterior} = ${activo_fijo_previo_anterior} + ${activo_intangible_previo_anterior} + ${activo_diferido_previo_anterior} + ${otros_activos_fijos_largo_plazo_previo_anterior}`)
    logger.info(`${fileMethod} | ${customUuid} total_activo_fijo_previo_anterior = activo_fijo_previo_anterior + activo_intangible_previo_anterior + activo_diferido_previo_anterior + otros_activos_fijos_largo_plazo_previo_anterior`)

    insertData.total_activo_fijo_previo_anterior = total_activo_fijo_previo_anterior

    const total_activo_previo_anterior =
      toFloat(total_activo_circulante_previo_anterior) +
      toFloat(total_activo_fijo_previo_anterior)

    logger.info(`${fileMethod} | ${customUuid} ${total_activo_previo_anterior} = ${total_activo_circulante_previo_anterior} + ${total_activo_fijo_previo_anterior} `)
    logger.info(`${fileMethod} | ${customUuid} total_activo_previo_anterior = total_activo_circulante_previo_anterior + total_activo_fijo_previo_anterior`)

    insertData.total_activo_previo_anterior = total_activo_previo_anterior

    logger.info(`${fileMethod} | ${customUuid} Total activo previo anterior: ${JSON.stringify(total_activo_previo_anterior)}`)
    logger.info(`${fileMethod} | ${customUuid} ------------------------  FINALIZA SECCION DE CALCULO DE ACTIVO FIJO PARA RATIOS FINANCIEROS  ------------------------`)

    logger.info(`${fileMethod} | ${customUuid} ------------------------  INICIA SECCION DE CALCULO DE PASIVO CIRCULANTE PARA RATIOS FINANCIEROS  ------------------------`)

    const { acreedores_anterior, inpuestos_x_pagar_anterior, otros_pasivos_anterior, proveedores_anterior } = estado_balance_anterior
    const total_pasivo_circulante_anterior =
      toFloat(proveedores_anterior) +
      toFloat(acreedores_anterior) +
      toFloat(inpuestos_x_pagar_anterior) +
      toFloat(otros_pasivos_anterior)

    logger.info(`${fileMethod} | ${customUuid} ${total_pasivo_circulante_anterior} = ${proveedores_anterior} + ${acreedores_anterior} + ${inpuestos_x_pagar_anterior} + ${otros_pasivos_anterior} `)
    logger.info(`${fileMethod} | ${customUuid} total_pasivo_circulante_anterior = proveedores_anterior + acreedores_anterior + inpuestos_x_pagar_anterior + otros_pasivos_anterior`)

    insertData.total_pasivo_circulante_anterior = total_pasivo_circulante_anterior

    logger.info(`${fileMethod} | ${customUuid} Total pasivo circulante anterior: ${JSON.stringify(total_pasivo_circulante_anterior)}`)

    const { acreedores_previo_anterior, inpuestos_x_pagar_previo_anterior, otros_pasivos_previo_anterior, proveedores_previo_anterior } = estado_balance_previo_anterior
    const total_pasivo_circulante_previo_anterior =
      toFloat(proveedores_previo_anterior) +
      toFloat(acreedores_previo_anterior) +
      toFloat(inpuestos_x_pagar_previo_anterior) +
      toFloat(otros_pasivos_previo_anterior)

    logger.info(`${fileMethod} | ${customUuid} ${total_pasivo_circulante_previo_anterior} = ${proveedores_previo_anterior} + ${acreedores_previo_anterior} + ${inpuestos_x_pagar_previo_anterior} + ${otros_pasivos_previo_anterior} `)
    logger.info(`${fileMethod} | ${customUuid} total_pasivo_circulante_previo_anterior = proveedores_previo_anterior + acreedores_previo_anterior + inpuestos_x_pagar_previo_anterior + otros_pasivos_previo_anterior`)

    insertData.total_pasivo_circulante_previo_anterior = total_pasivo_circulante_previo_anterior

    logger.info(`${fileMethod} | ${customUuid} Total pasivo circulante previo anterior: ${JSON.stringify(total_pasivo_circulante_previo_anterior)}`)

    logger.info(`${fileMethod} | ${customUuid} ------------------------  FINALIZA SECCION DE CALCULO DE PASIVO CIRCULANTE PARA RATIOS FINANCIEROS  ------------------------`)

    logger.info(`${fileMethod} | ${customUuid} ------------------------  INICIA SECCION DE CALCULO DE PASIVO LARGO PLAZO PARA RATIOS FINANCIEROS  ------------------------`)

    const { pasivo_largo_plazo_anterior, pasivo_diferido_anterior } = estado_balance_anterior

    const total_pasivo_largo_plazo_anterior =
      toFloat(pasivo_largo_plazo_anterior) +
      toFloat(pasivo_diferido_anterior) +
      toFloat(total_pasivo_circulante_anterior)

    logger.info(`${fileMethod} | ${customUuid} ${total_pasivo_largo_plazo_anterior} = ${pasivo_largo_plazo_anterior} + ${pasivo_diferido_anterior} + ${total_pasivo_circulante_anterior}`)
    logger.info(`${fileMethod} | ${customUuid} total_pasivo_largo_plazo_anterior = pasivo_diferido_anterior + total_pasivo_circulante_anterior`)

    insertData.total_pasivo_largo_plazo_anterior = total_pasivo_largo_plazo_anterior

    logger.info(`${fileMethod} | ${customUuid} Total pasivo largo plazo previo anterior: ${JSON.stringify(total_pasivo_largo_plazo_anterior)}`)

    const { pasivo_largo_plazo_previo_anterior, pasivo_diferido_previo_anterior } = estado_balance_previo_anterior

    const total_pasivo_previo_anterior =
      toFloat(pasivo_largo_plazo_previo_anterior) +
      toFloat(pasivo_diferido_previo_anterior) +
      toFloat(total_pasivo_circulante_previo_anterior)

    logger.info(`${fileMethod} | ${customUuid} ${total_pasivo_previo_anterior} = ${pasivo_largo_plazo_previo_anterior} + ${pasivo_diferido_previo_anterior} + ${total_pasivo_circulante_previo_anterior}`)
    logger.info(`${fileMethod} | ${customUuid} total_pasivo_previo_anterior = pasivo_largo_plazo_previo_anterior + pasivo_diferido_previo_anterior + total_pasivo_circulante_previo_anterior`)

    insertData.total_pasivo_previo_anterior = total_pasivo_previo_anterior

    logger.info(`${fileMethod} | ${customUuid} Total pasivo previo anterior: ${JSON.stringify(total_pasivo_previo_anterior)}`)

    logger.info(`${fileMethod} | ${customUuid} ------------------------  FINALIZA SECCION DE CALCULO DE PASIVO LARGO PLAZO PARA RATIOS FINANCIEROS  ------------------------`)

    logger.info(`${fileMethod} | ${customUuid} ------------------------  INICIA SECCION DE CALCULO DE PASIVO CAPITAL PARA RATIOS FINANCIEROS  ------------------------`)

    const { resultado_ejercicios_anteriores_anterior, resultado_ejercicios_anterior, otro_capital_anterior, capital_social_anterior } = estado_balance_anterior

    const total_capital_contable_anterior =
      toFloat(capital_social_anterior) +
      toFloat(resultado_ejercicios_anteriores_anterior) +
      toFloat(resultado_ejercicios_anterior) +
      toFloat(otro_capital_anterior)

    logger.info(`${fileMethod} | ${customUuid} ${total_capital_contable_anterior} = ${capital_social_anterior} + ${resultado_ejercicios_anteriores_anterior} + ${resultado_ejercicios_anterior} + ${otro_capital_anterior}`)
    logger.info(`${fileMethod} | ${customUuid} total_capital_contable_anterior = capital_social_anterior + resultado_ejercicios_anteriores_anterior + resultado_ejercicios_anterior + otro_capital_anterior`)

    insertData.total_capital_contable_anterior = total_capital_contable_anterior

    logger.info(`${fileMethod} | ${customUuid} Total capital contable anterior: ${JSON.stringify(total_capital_contable_anterior)}`)

    const { resultado_ejercicios_anteriores_previo_anterior, resultado_ejercicios_previo_anterior, otro_capital_previo_anterior, capital_social_previo_anterior } = estado_balance_previo_anterior

    const total_capital_contable_previo_anterior =
      toFloat(capital_social_previo_anterior) +
      toFloat(resultado_ejercicios_anteriores_previo_anterior) +
      toFloat(resultado_ejercicios_previo_anterior) +
      toFloat(otro_capital_previo_anterior)

    logger.info(`${fileMethod} | ${customUuid} ${total_capital_contable_previo_anterior} = ${capital_social_previo_anterior} + ${resultado_ejercicios_anteriores_previo_anterior} + ${resultado_ejercicios_previo_anterior} + ${otro_capital_previo_anterior}`)
    logger.info(`${fileMethod} | ${customUuid} total_capital_contable_previo_anterior = capital_social_previo_anterior + resultado_ejercicios_previo_anteriores_previo_anterior + resultado_ejercicios_anterior + otro_capital_previo_anterior`)

    insertData.total_capital_contable_previo_anterior = total_capital_contable_previo_anterior

    logger.info(`${fileMethod} | ${customUuid} Total capital contable previo anterior: ${JSON.stringify(total_capital_contable_previo_anterior)}`)

    logger.info(`${fileMethod} | ${customUuid} ------------------------  FINALIZA SECCION DE CALCULO DE PASIVO CAPITAL PARA RATIOS FINANCIEROS  ------------------------`)

    await certificationService.insertCalculoEstadoBalance(id_certification, insertData)

    return {
      error: false,
      total_activo_circulante: {
        total_activo_circulante_anterior,
        total_activo_circulante_previo_anterior,
      },
      total_activo: {
        total_activo_anterior,
        total_activo_previo_anterior,
      },
      total_pasivo_circulante: {
        total_pasivo_circulante_anterior,
        total_pasivo_circulante_previo_anterior,
      },
      total_pasivo_largo_plazo: {
        total_pasivo_largo_plazo_anterior,
        total_pasivo_previo_anterior,
      },
      total_capital_contable: {
        total_capital_contable_anterior,
        total_capital_contable_previo_anterior
      },
      estado_balance_anterior,
      estado_balance_previo_anterior
    }


  } catch (error) {
    return { error: true, message: 'Hubo un error en los calculos de ratios del estado de balance', msgError: error }
  }
}

const updateCertificacion = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: updateCertificacion`
  try {
    const { body } = req;
    const { id_empresa, id_certification, accionistas } = body

    if (!id_certification) return next(boom.badRequest('Para la actualización es necesario el id_certification'))

    const updateEmpresaInfo = await certificationService.updateEmpresaInfo(body)
    if (!updateEmpresaInfo.result) {
      logger.warn(`${fileMethod} - No se actualizaron los datos de la empresa para la certificación`)
      return next(boom.badRequest('No se actualizaron los datos de la empresa para la certificación'))
    }

    const updateCertification = await certificationService.updateCertificationAlgoritmo(body)
    if (!updateCertification.result) {
      logger.warn(`${fileMethod} - No se actualizaron los datos de la empresa para la certificación`)
      return next(boom.badRequest('No se actualizaron los datos de la empresa para la certificación'))
    }

    const updateDomicilioCertificacion = await certificationService.updateDomicilioCertificacion(body)
    if (!updateDomicilioCertificacion.result) {
      logger.warn(`${fileMethod} - No se actualizaron los datos de la direccion fiscal de empresa para la certificación`)
      return next(boom.badRequest('No se actualizaron los datos de la direccion fiscal de  la empresa para la certificación'))
    }

    if (accionistas && accionistas.length > 0) {
      if (accionistas.length === 1) {
        accionistas[0].controlante = 1
      } else {
        let controlantes = 0
        for (const accionista of accionistas) {
          if (parseInt(accionista.controlante) === 1) {
            controlantes += 1
            accionista.controlante = 1
          } else {
            accionista.controlante = 0
          }
          if (accionista.razon_sat_rfc === undefined) accionista.razon_sat_rfc = ''
        }
        if (controlantes !== 1) {
          logger.warn(`${fileMethod} - Se debe indicar exactamente un accionista controlante`)
          return next(boom.badRequest('Debe existir un solo accionista controlante'))
        }
      }
    }

    await certificationService.deleteAccionista(id_certification)

    for (let accionista of accionistas) {
      const insertAcci = await certificationService.insertaAccionista(id_certification, accionista);
      if (!insertAcci.result) {
        logger.warn(`${fileMethod} - No se insertó el accionista: ${JSON.stringify(accionista)}`);
        return next(boom.badRequest(`No se insertó el accionista: ${JSON.stringify(accionista)}`));
      }
    }


    return res.json({
      error: false,
      certification: body
    })
  } catch (err) {
    next(err)
  }
}

const updatePartidasFinancieras = async (req, res, next) => {
  try {
    const { body } = req;
    const { id_certification, monto_solicitado } = body
    let actualiza = true

    if (body.partida_estado_balance_periodo_contable_anterior) {
      const anterior = body.partida_estado_balance_periodo_contable_anterior
      const {
        capital_social = 0,
        resultado_ejercicios_anteriores = 0,
        resultado_ejercicios = 0,
        otro_capital = 0
      } = anterior
      anterior.total_capital_contable_pat =
        capital_social +
        resultado_ejercicios_anteriores +
        resultado_ejercicios +
        otro_capital

      anterior.capital_contable =
        capital_social +
        resultado_ejercicios_anteriores +
        resultado_ejercicios +
        otro_capital
    }

    if (body.partida_estado_balance_periodo_contable_previo_anterior) {
      const previo = body.partida_estado_balance_periodo_contable_previo_anterior
      const {
        capital_social = 0,
        resultado_ejercicios_anteriores = 0,
        resultado_ejercicios = 0,
        otro_capital = 0
      } = previo
      previo.total_capital_contable_pat =
        capital_social +
        resultado_ejercicios_anteriores +
        resultado_ejercicios +
        otro_capital

      previo.capital_contable =
        capital_social +
        resultado_ejercicios_anteriores +
        resultado_ejercicios +
        otro_capital
    }


    const updatePEBPCA = await certificationService.updatePEBPCA(body)
    if (!updatePEBPCA.success) {
      logger.warn(`${updatePEBPCA.message}`);
      actualiza = false
      // return next(boom.badRequest('No se pudo actualizar los datos PEBPCA para la certificación'));
    }

    const updatePEBPCPA = await certificationService.updatePEBPCPA(body)
    if (!updatePEBPCPA.success) {
      logger.warn(`${updatePEBPCPA.message}`);
      actualiza = false
      // return next(boom.badRequest('No se pudo actualizar los datos PEBPCPA para la certificación'));
    }

    const updatePERPCPA = await certificationService.updatePERPCPA(body)
    if (!updatePERPCPA.success) {
      logger.warn(`${updatePERPCPA.message}`);
      actualiza = false
      // return next(boom.badRequest('No se pudo actualizar los datos PERPCPA para la certificación'));
    }

    const updatePERPCA = await certificationService.updatePERPCA(body)
    if (!updatePERPCA.success) {
      logger.warn(`${updatePERPCA.message}`);
      actualiza = false
      // return next(boom.badRequest('No se pudo actualizar los datos PERPCA para la certificación'));
    }

    return res.json({
      error: false,
      partidadFinancieras: body
    })
  } catch (err) {
    next(err)
  }
}

const updateReferenciasComerciales = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: updateCertificacion`
  try {
    const { body } = req;
    const { id_certification, referencias_comerciales } = body

    const getReferenciaComercial = await certificationService.getCertificacionReferenciasComerciales(id_certification)

    for (let i in getReferenciaComercial.result) {
      const referenciaComercial = getReferenciaComercial.result[i].id_certification_referencia_comercial
      await certificationService.deleteContactos(referenciaComercial)
    }

    await certificationService.deleteReferenciasComerciales(id_certification)

    for (let i in referencias_comerciales) {
      const rc = await certificationService.insertaReferenciaComercial(referencias_comerciales[i], id_certification)
      if (!rc.result) {
        logger.warn(`${fileMethod} - No se insertó la referencia comercial: ${JSON.stringify(rc)}`);
        return next(boom.badRequest(`No se insertó la referencia comercial: ${JSON.stringify(rc)}`));
      }

      for (let j in referencias_comerciales[i].contactos) {
        const contacto = await certificationService.insertaContacto(referencias_comerciales[i].contactos[j], rc.result.insertId)
        if (!contacto.result) {
          logger.warn(`${fileMethod} - No se insertó el contacto: ${JSON.stringify(contacto)}`);
          return next(boom.badRequest(`No se insertó el contacto: ${JSON.stringify(contacto)}`));
        }
      }
    }

    return res.json({
      error: false,
      referenciasContactos: body
    })
  } catch (err) {
    next(err)
  }
}

const getCertification = async (req, res, next) => {
  try {
    const { idEmpresa } = req.params;
    // 
    const certificacion = await consultaCertificacion('', idEmpresa)
    if (!certificacion) {
      return next(boom.badRequest(`No se pudo obtener información de la certificación`));
    }

    return res.json({
      error: false,
      certificacion: certificacion.certificacion,
      demandas: certificacion.demandas,
      partidasFinancieras: certificacion.partidasFinancieras,
      mercadoObjetivo: certificacion.mercadoObjetivo,
      referenciasComerciales: certificacion.referenciasComerciales,
      reporteCredito: certificacion.reporteCredito,
      calculoEstadoBalance: certificacion.calculoEstadoBalance,
      calculoEstadoResultado: certificacion.calculoEstadoResultado,
      calculoRatiosFinancieros: certificacion.calculoRatiosFinancieros
    })
  } catch (err) {
    next(err)
  }
}

const getCertificationStatus = async (req, res, next) => {
  try {
    const { idEmpresa } = req.params;

    const certificacion = await certificationService.getCertificacionByEmpresa(idEmpresa)
    if (certificacion.result.length == 0) {
      return next(boom.badRequest(`No se pudo obtener información de la certificación`));
    }

    const estatusCertificacion = certificacion.result[0].estatus_certificacion


    return res.json({
      error: false,
      estatusCertificacion
    })
  } catch (err) {
    next(err)
  }
}

const deleteDocumento = async (req, res, next) => {
  try {
    const { body } = req
    const { id_documento } = body
    if (!id_documento) return next(boom.badRequest('Información incompleta'))

    const pathActual = await certificationService.getPathToDelete(id_documento)
    if (pathActual.result.length == 0) {
      return next(boom.badRequest('No existe el archivo en el bucket'))
    }

    const deleteDoc = await certificationService.deleteDocumento(id_documento)
    const deleteObjetcAWS = await uploadImageS3.deleteFileFromS3(pathActual.result[0].ruta)

    return res.json({
      error: false,
      deleteDoc,
      deleteObjetcAWS
    })
  } catch (error) {
    next(err)
  }
}

const updateDocumento = async (req, res, next) => {
  try {
    const { body } = req
    const { documento, nombre_documento, fecha_vencimiento, size, id_documento } = body

    if (!documento || !nombre_documento || !fecha_vencimiento || !size || !id_documento) return next(boom.badRequest('Información incompleta'))

    if (!documento) return next(boom.badRequest('Documento Vacio'))

    const pathActual = await certificationService.getPathToDelete(id_documento)
    if (pathActual.result.length == 0) {
      return next(boom.badRequest('No existe el archivo en el bucket'))
    }

    const pathBucket = 'certificacionDocs';
    const Location = await uploadImageS3.uploadPdf(documento, pathBucket)
    body.ruta = Location
    const documentUpdate = await certificationService.actualizaDocumento(body)
    console.log(pathActual.result[0].ruta)
    const deleteDoc = await uploadImageS3.deleteFileFromS3(pathActual.result[0].ruta)

    res.status(200).json({
      error: false,
      results: 'OK'
    })

  } catch (error) {
    next(err)
  }
}

const uploadDocumento = async (req, res, next) => {
  try {
    const { id_empresa, documento, nombre_documento, fecha_vencimiento, size } = req.body

    if (!id_empresa || !documento || !nombre_documento || !fecha_vencimiento || !size) return next(boom.badRequest('Información incompleta'))

    const documentos = await certificationService.getDocumentosByIdEmpresa(id_empresa)
    if (documentos.result.length > 0) {
      const foundDocument = documentos.result.find(doc => doc.nombre_documento === nombre_documento)
      if (foundDocument) return next(boom.badRequest('Ese documento ya se encuentra cargado'))
    }

    if (documento) {
      const pathBucket = 'certificacionDocs';
      const Location = await uploadImageS3.uploadPdf(documento, pathBucket)
      await certificationService.guardaDocumento(id_empresa, nombre_documento, fecha_vencimiento, size, Location)
    }

    res.status(200).json({
      error: false,
      results: 'OK'
    })
  } catch (err) {
    next(err)
  }
}

const consultaDocumento = async (req, res, next) => {
  try {
    const { id_empresa } = req.params

    if (!id_empresa) return next(boom.badRequest('id_certification Vacio'))

    const documentos = await certificationService.getDocumentosByIdEmpresa(id_empresa)

    res.status(200).json({
      error: false,
      documentos: documentos.result
    })
  } catch (err) {
    next(err)
  }
}

const consultaCronos = async (req, res, next) => {
  try {
    const { rfc } = req.body;

    if (!rfc) return next(boom.badRequest('RFC Vacio'))

    const cronosHeaders = { headers: { "X-API-Key": secretKeyCronos } }
    const { data } = await axios.post(URLConsultaCronos, { rfc }, cronosHeaders)

    logger.info(` Respuesta cronos: ${JSON.stringify(data)}`);

    res.status(200).json({
      error: false,
      results: data
    })
  } catch (err) {
    next(err)
  }
}

const saveLog = async (req, res, next) => {
  try {
    const { body } = req
    const { mensaje, tipo } = body

    if (tipo == 'info') {
      logger.info(`${JSON.stringify(mensaje)}`)
    } else {
      logger.error(`${JSON.stringify(mensaje)}`);
    }

    res.status(200).json({
      error: false,
      results: 'OK'
    })

  } catch (err) {
    next(err)
  }
}

const consultaMailjet = async (req, res, next) => {
  try {
    const { body } = req
    const secretKeyMailjet = 'OTZmNWU1OGIyZmY4YjJkNTNhODZjNDcwZTBlZjdhNjI6MzZjYTkyZDY0ZWY5MDY2NjJlNDUyMzg3YzI5MDhjMGE=';

    const mailjetHeaders = { headers: { "Content-Type": "application/json", "Authorization": `Basic ${secretKeyMailjet}` } }
    const { data } = await axios.post('https://api.mailjet.com/v3/REST/listrecipient', body, mailjetHeaders)

    logger.info(` Respuesta mailjet: ${JSON.stringify(data)}`)

    res.status(200).json({
      error: false,
      results: data
    })
  } catch (err) {
    logger.error(`Error en consultaMailjet: ${err.message}`)
    if (err.response) {
      logger.error(`Respuesta del servidor: ${err.response.data}`)
      logger.error(`Código de estado: ${err.response.status}`)

      return res.status(err.response.status).json({
        error: true,
        message: 'Error en la solicitud a Mailjet',
        details: err.response.data
      })
    }
    res.status(500).json({
      error: true,
      message: 'Error en la solicitud a Mailjet',
      details: err.message
    })

    next(err)
  }
}

const setStatusCertification = async (req, res, next) => {
  try {
    const { id_empresa, estatus } = req.body;


    // validar que la empresa exista
    const [empresa] = await companiesService.getEmpresa(id_empresa)

    if (!empresa) {
      logger.warn(`${fileMethod} - La empresa con ID ${id_empresa} no existe`)
      return next(boom.badRequest('La empresa no existe'))
    }

    const certificacion = await certificationService.getCertificacionByEmpresa(id_empresa)

    await certificationService.updateEstatusCertificacion(certificacion.result[0].id_certification, estatus)

    const certificacion_estatus = await certificationService.getCertificacionByEmpresa(id_empresa)



    // inicial    
    // proceso
    // vencida
    // cancelada

    res.status(200).json({
      error: false,
      certificacion_estatus
    })
  } catch (err) {
    next(err)
  }
}

const downloadLogs = async (req, res, next) => {
  try {
    const { fecha } = req.body;

    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return res.status(400).json({ message: 'Formato de fecha inválido. Use el formato YYYY-MM-DD.' })
    }

    const filePath = process.platform === 'linux'
      ? path.join('/home/ubuntu/logs', `${fecha}.log`)
      : path.join(__dirname, '../../../logs', `${fecha}.log`)

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Archivo no encontrado.' })
    }

    res.setHeader('Content-Disposition', `attachment; filename=${fecha}.log`)
    res.setHeader('Content-Type', 'application/octet-stream')

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res)

  } catch (error) {
    next(err)
  }
}

const getInformacionContacto = async (req, res, next) => {
  try {
    const { id_contacto } = req.params
    const getReferenciaComercial = await certificationService.getReferenciaComercialByIdContacto(id_contacto)

    res.status(200).json({
      error: false,
      contacto: getReferenciaComercial.result
    })
  } catch (error) {
    next(error)
  }
}

const seteaEstatusSolicitudCredito = async (req, res, next) => {
  try {
    const { body } = req
    const { id_solicitud_credito, estatus } = body

    const getSolicitudCredito = await certificationService.getSolicitudCredito(id_solicitud_credito)
    if (getSolicitudCredito[0].solicitud == 0) return next(boom.badRequest(`La solicitud de credito no existe`))

    await certificationService.actualizaEstatusSolicitudCredito(body)

    const estatusSolicitud = await certificationService.getEstatusSolicitudCredito(id_solicitud_credito)
    if (estatusSolicitud[0].estatus != estatus) return next(boom.badRequest(`La solicitud de credito no se actualizo correctamente`))

    res.status(200).json({
      error: false,
      reult: 'OK'
    })

  } catch (error) {
    next(error)
  }
}

const getMontoPlazo = async (req, res, next) => {
  const fileMethod = '[Certification.js/getMontoPlazo]'
  try {
    logger.info(`${fileMethod} | Iniciando obtener monto y plazo`)
    const { id_proveedor, id_cliente, id_solicitud_credito } = req.params

    const [getMontoPlazo] = await certificationService.getMontoPlazo(id_proveedor, id_cliente, id_solicitud_credito)
    logger.info(`${fileMethod} | Resultado Monto y Plazo: ${JSON.stringify(getMontoPlazo)}`)

    if (!getMontoPlazo) return next(boom.badRequest(`La solicitud de credito no existe`))

    return res.status(200).json({
      error: false,
      result: getMontoPlazo
    })
  } catch (error) {
    next(error)
  }
}


const solicitarCredito = async (req, res, next) => {
  const fileMethod = '[Certification.js/solicitarCredito]'
  try {
    logger.info(`${fileMethod} | Iniciando solicitud de crédito`)

    const { body } = req;
    const { id_proveedor, id_cliente, plazo, monto_solicitado } = body

    logger.info(`${fileMethod} | Datos recibidos: ${JSON.stringify(body)}`)

    const getIdProveedor = await certificationService.getEmpresa(id_proveedor)
    logger.info(`${fileMethod} | Resultado proveedor: ${JSON.stringify(getIdProveedor)}`)

    if (getIdProveedor[0].empresas == 0) {
      logger.warn(`${fileMethod} | El proveedor no existe`)
      return next(boom.badRequest(`El proveedor no existe`))
    }

    const getIdCliente = await certificationService.getEmpresa(id_cliente)
    logger.info(`${fileMethod} | Resultado cliente: ${JSON.stringify(getIdCliente)}`)

    if (getIdCliente[0].empresas == 0) {
      logger.warn(`${fileMethod} | El cliente no existe`)
      return next(boom.badRequest(`El cliente no existe`))
    }

    logger.info(`${fileMethod} | Guardando relación comprador-vendedor`)
    await certificationService.guardaRelacionCompradorVendedor(body)
    logger.info(`${fileMethod} | Relación guardada correctamente`)

    res.status(200).json({
      error: false,
      result: 'OK'
    })
    logger.info(`${fileMethod} | Respuesta enviada con éxito`)

  } catch (error) {
    logger.error(`${fileMethod} | Error en solicitarCredito: ${error.message}`, error)
    next(error)
  }
};


const getInfoContactoReferido = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: getInfoContactoReferido`
  try {
    const { id_contacto } = req.params
    const response = {}
    const datos_contacto = {}
    const datos_empresa_contacto = {}
    const direccion_fiscal = {}
    const datos_cliente = {}


    logger.info(`${fileMethod} | Consulta Información referido: ${JSON.stringify(id_contacto)}`)
    const [datos_contacto_res] = await certificationService.getContacto(id_contacto)
    const [referencia_comercial] = await certificationService.getReferenciaComercialByIdReferencia(datos_contacto_res.id_certification_referencia_comercial)
    const [direccion] = await certificationService.getDireccionByIdDireccion(referencia_comercial.id_direccion)
    const [empresa_cliente] = await certificationService.getEmpresaClienteByIdCertification(datos_contacto_res.id_certification_referencia_comercial)

    datos_cliente.id_empresa_cliente_contacto = empresa_cliente.id_empresa_cliente_contacto
    datos_cliente.razon_social = empresa_cliente.razon_social
    datos_cliente.denominacion = empresa_cliente.denominacion
    datos_cliente.rfc = empresa_cliente.rfc
    datos_cliente.homoclave = empresa_cliente.homoclave
    datos_cliente.calificacion_referencia = empresa_cliente.calificacion_referencia
    datos_cliente.email = empresa_cliente.email
    datos_cliente.moneda = empresa_cliente.moneda
    datos_cliente.linea_credito_otorgada = empresa_cliente.linea_credito
    datos_cliente.plazo_credito_dso = empresa_cliente.plazo
    datos_cliente.fecha_otorgamiento_linea_credito = empresa_cliente.fecha_otorgamiento_linea_credito
    datos_cliente.saldo_vigente_linea_credito = empresa_cliente.monto_saldo_vigente_linea_credito
    datos_cliente.saldo_vencido_linea_credito = empresa_cliente.monto_saldo_vencido_linea_credito
    datos_cliente.dias_atraso = empresa_cliente.dias_atraso
    datos_cliente.antiguedad_relacion = empresa_cliente.antiguedad_relacion

    direccion_fiscal.id_direccion = referencia_comercial.id_direccion
    direccion_fiscal.calle = direccion.calle
    direccion_fiscal.numero = direccion.numero
    direccion_fiscal.ciudad = direccion.ciudad
    direccion_fiscal.estado = direccion.estado
    direccion_fiscal.codigo_postal = direccion.codigo_postal
    direccion_fiscal.pais = direccion.pais

    response.id_certification = referencia_comercial.id_certification
    response.recibir_emails = true
    datos_contacto.id_contacto = id_contacto
    datos_contacto.nombre_contacto = datos_contacto_res.nombre_contacto
    datos_contacto.correo_contacto = datos_contacto_res.correo_contacto
    response.datos_contacto = datos_contacto
    datos_empresa_contacto.id_referencia = referencia_comercial.id_certification_referencia_comercial
    datos_empresa_contacto.razon_social = referencia_comercial.razon_social
    datos_empresa_contacto.denominacion = referencia_comercial.denominacion
    datos_empresa_contacto.rfc = referencia_comercial.rfc
    datos_empresa_contacto.direccion_fiscal = direccion_fiscal
    response.datos_empresa_contacto = datos_empresa_contacto
    response.datos_cliente = datos_cliente


    res.status(200).json({
      error: false,
      reult: response
    })
  } catch (error) {
    next(error)
  }
}

const cifra_konesh = async (str) => {
  try {
    logger.info(`El texto a cifrar: ${str}`)
    if (!str || typeof str !== 'string' || str.trim() === '') {
      throw new Error('La cadena de entrada es inválida o está vacía')
    }

    const globalConfig = await utilitiesService.getParametros()
    const keyCrypDecrypt = await globalConfig.find(item => item.nombre === 'konesh_keyCrypDecrypt').valor

    logger.info(`Se obtiene la llave para cifrar de la BD: ${keyCrypDecrypt}`)

    if (!keyCrypDecrypt) {
      logger.error(`No se encontró la llave de desencriptación`)
      throw new Error('No se encontró la llave de desencriptación')
    }

    const hashedKey = CryptoJS.SHA512(keyCrypDecrypt).toString(CryptoJS.enc.Hex)
    logger.info(`Se obtiene el hash de la llave ${hashedKey}`)

    const keyBytes = CryptoJS.enc.Hex.parse(hashedKey.substring(0, 64))
    logger.info(`Se convierte a bytes: ${keyBytes}`)

    const ciphertext = CryptoJS.AES.encrypt(
      str,
      keyBytes,
      { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 }
    )

    logger.info(`Cadena cifrada sin codificar: ${ciphertext}`)

    const encryptedText = ciphertext.ciphertext.toString(CryptoJS.enc.Base64)
    logger.info(`Cadena cifrada codificada: ${encryptedText}`)

    if (!encryptedText) {
      logger.info(`No se pudo cifrar el texto: ${encryptedText}`)
      throw new Error('No se pudo cifrar el texto')
    }

    return encryptedText

  } catch (error) {
    logger.info(`Ocurrio un error al ifrar cadena: ${error} -  ${fileMethod}`)
    return null
  }
}

const descifra_konesh = async (str) => {
  try {
    if (!str || typeof str !== 'string' || str.trim() === '') {
      throw new Error('La cadena de entrada es inválida o está vacía')
    }

    const globalConfig = await utilitiesService.getParametros()
    const keyCrypDecrypt = await globalConfig.find(item => item.nombre === 'konesh_keyCrypDecrypt').valor

    if (!keyCrypDecrypt) {
      throw new Error('No se encontró la llave de desencriptación');
    }

    const hashedKey = CryptoJS.SHA512(keyCrypDecrypt).toString(CryptoJS.enc.Hex)
    const keyBytes = CryptoJS.enc.Hex.parse(hashedKey.substring(0, 64))

    const encryptedBytes = CryptoJS.enc.Base64.parse(str)
    const decryptedBytes = CryptoJS.AES.decrypt(
      { ciphertext: encryptedBytes },
      keyBytes,
      { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 }
    )

    const originalText = decryptedBytes.toString(CryptoJS.enc.Utf8)

    if (!originalText) {
      throw new Error('No se pudo desencriptar el texto')
    }

    return originalText

  } catch (error) {
    return null
  }
}

const validacionesReferenciasComercialesValidas = async (data, empresa_referencia_comercial) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: validacionesReferenciasComercialesValidas`
  try {
    logger.info(`${fileMethod} | Inicia proceso de validacion de referncia comercial ${JSON.stringify(data)} - ${JSON.stringify(empresa_referencia_comercial)}`)
    let causa_referencia_invalida = []
    const regexFisico = /^[A-Za-z]{4}\d{6}[A-Za-z0-9]{3}$/
    const regexMoral = /^[A-Za-z]{3}\d{6}[A-Za-z0-9]{3}$/

    const globalConfig = await utilitiesService.getParametros()
    const dominiosNoInstitucionales = JSON.parse(await globalConfig.find(item => item.nombre === 'dominios_no_permitidos_email_referencias').valor)
    const konesh_url_valid_rfc = await globalConfig.find(item => item.nombre === 'konesh_url_valid_rfc').valor
    const tiempo_minimo_inscrito_sat = await globalConfig.find(item => item.nombre === 'tiempo_minimo_inscrito_sat').valor

    let razon_social_konesh
    let referencia_valida = true

    const { datos_cliente, datos_contacto, datos_empresa_contacto } = data
    const { rfc, homoclave, antiguedad_relacion, unidad_antiguedad_relacion, denominacion, fecha_inscripcion_sat } = datos_cliente
    const { correo_contacto, id_contacto } = datos_contacto
    const { id_referencia, denominacion: denominacion_contacto, razon_social: razon_social_contacto, rfc: rfc_contacto } = datos_empresa_contacto
    const { empresa_nombre } = empresa_referencia_comercial

    logger.info(`${fileMethod} | Datos para validar Konesh, RFC: ${JSON.stringify(rfc_contacto)}, razon_social: ${JSON.stringify(razon_social_contacto)}`)

    let denominaciones = await certificationService.getDenominaciones()
    const esPAE = denominaciones.result.some(item =>
      item.id === denominacion_contacto &&
      item.denominacion?.toUpperCase().includes('PAE')
    )


    logger.info(`${fileMethod} | Razon social obtenida de KONESH: ${JSON.stringify(razon_social_konesh)}`)

    const activa_api_sat = await globalConfig.find(item => item.nombre === 'activa_api_sat').valor
    if (activa_api_sat == 'true') {
      const textCifrado = await cifra_konesh(`${rfc_contacto}`)
      const request = {
        "credentials": {
          "usuario": await globalConfig.find(item => item.nombre === 'konesh_usuario').valor,
          "token": await globalConfig.find(item => item.nombre === 'konesh_token').valor,
          "password": await globalConfig.find(item => item.nombre === 'konesh_password').valor,
          "cuenta": await globalConfig.find(item => item.nombre === 'konesh_cuenta').valor,
        },
        "issuer": {
          "rfc": await globalConfig.find(item => item.nombre === 'konesh_issuer').valor,
        },
        "list": {
          "list": [textCifrado]
        }
      }

      const konesh_api = await callKoneshApi(rfc_contacto, globalConfig)
      if (konesh_api.status === 200) {
        razon_social_konesh = await descifra_konesh(konesh_api.data.transactionResponse01[0].data04)
        logger.info(`${fileMethod} | Razon social obtenida de KONESH: ${JSON.stringify(razon_social_konesh)}`)
      }
    }


    // RFC invalido
    if (!regexFisico.test(`${rfc_contacto}`) && !regexMoral.test(`${rfc_contacto}`)) {
      const mensaje_rfc_invalido = await globalConfig.find(item => item.nombre === 'mensaje_rfc_invalido').valor
      causa_referencia_invalida.push(mensaje_rfc_invalido)
      referencia_valida = false

      logger.info(`${fileMethod} | Referencia valida por RFC: ${JSON.stringify(causa_referencia_invalida)}`)
    }

    if (activa_api_sat == 'true') {
      // RFC y Razon Social concuerdan
      const razonSocialUpper = razon_social_contacto ? razon_social_contacto.toUpperCase() : razon_social_contacto
      if (razon_social_konesh !== razonSocialUpper) {
        const mensaje_rfc_vs_razon_social_false = await globalConfig.find(item => item.nombre === 'mensaje_rfc_vs_razon_social_false').valor
        causa_referencia_invalida.push(mensaje_rfc_vs_razon_social_false)
        referencia_valida = false
        logger.info(`${fileMethod} | RFC y Razon Social: ${JSON.stringify(razon_social_konesh)} y ${JSON.stringify(razon_social_contacto)}`)
        logger.info(`${fileMethod} | RFC no pertenece a razon social: ${JSON.stringify(causa_referencia_invalida)}`)
      }
    }

    if (esPAE) {
      const startDate = new Date(fecha_inscripcion_sat)
      const today = new Date()

      let years = today.getFullYear() - startDate.getFullYear()
      if (
        today.getMonth() < startDate.getMonth() ||
        (today.getMonth() === startDate.getMonth() && today.getDate() < startDate.getDate())
      ) {
        years--
      }

      if (years < tiempo_minimo_inscrito_sat) {
        const mensaje_razon_social_no_cumple_tiempo_inscripcion_sat = await globalConfig.find(item => item.nombre === 'mensaje_razon_social_no_cumple_tiempo_inscripcion_sat').valor
        causa_referencia_invalida.push(mensaje_razon_social_no_cumple_tiempo_inscripcion_sat)
        referencia_valida = false

        logger.info(`${fileMethod} | Razón social con menos de ${tiempo_minimo_inscrito_sat} años de antiguedad: ${JSON.stringify(causa_referencia_invalida)}`)
      }
    } else {
      const rfcCompleto = `${rfc_contacto}`
      const match = rfcCompleto.match(/^([A-ZÑ&]{3,4})(\d{2})(\d{2})(\d{2})/i)

      let [, , yy, mm, dd] = match
      let year = parseInt(yy, 10)

      const hoy = new Date()
      const añoActual = hoy.getFullYear()
      const sigloActual = Math.floor(añoActual / 100) * 100
      let fechaRFC = new Date(`${sigloActual + year}-${mm}-${dd}`)
      if (fechaRFC > hoy) {
        fechaRFC = new Date(`${(sigloActual - 100) + year}-${mm}-${dd}`)
      }

      let antiguedad = hoy.getFullYear() - fechaRFC.getFullYear()
      if (
        hoy.getMonth() < fechaRFC.getMonth() ||
        (hoy.getMonth() === fechaRFC.getMonth() && hoy.getDate() < fechaRFC.getDate())
      ) {
        antiguedad--
      }

      if (antiguedad < tiempo_minimo_inscrito_sat) {
        const mensaje_razon_social_no_cumple_tiempo_inscripcion_sat = await globalConfig.find(item => item.nombre === 'mensaje_razon_social_no_cumple_tiempo_inscripcion_sat').valor
        causa_referencia_invalida.push(mensaje_razon_social_no_cumple_tiempo_inscripcion_sat)
        referencia_valida = false

        logger.info(`${fileMethod} | Razón social con menos de ${tiempo_minimo_inscrito_sat} años de antiguedad: ${JSON.stringify(causa_referencia_invalida)}`)
      }
    }

    // Validacion para relacion < 6 meses (Se debe de modificar a meses para realizar la valdacion correcta)
    const meses_antiguedad_relacion_referencia_comercial = await globalConfig.find(item => item.nombre === 'meses_antiguedad_relacion_referencia_comercial').valor
    if (unidad_antiguedad_relacion == 'meses') {
      if (antiguedad_relacion < meses_antiguedad_relacion_referencia_comercial) {
        const mensaje_antiguedad_relacion_comercial = await globalConfig.find(item => item.nombre === 'mensaje_antiguedad_relacion_comercial').valor
        causa_referencia_invalida.push(mensaje_antiguedad_relacion_comercial)
        referencia_valida = false

        logger.info(`${fileMethod} | Antiguedad de relación comercial menor a ${meses_antiguedad_relacion_referencia_comercial} meses: ${JSON.stringify(causa_referencia_invalida)}`)
      }
    }
    // Validacion para cuando el contacto no tenga dominio institucional
    const dominio_email = correo_contacto.split("@")[1]?.toLowerCase()
    if (dominiosNoInstitucionales.includes(dominio_email)) {
      const mensaje_email_contacto_no_institucional = await globalConfig.find(item => item.nombre === 'mensaje_email_contacto_no_institucional').valor
      causa_referencia_invalida.push(mensaje_email_contacto_no_institucional)
      referencia_valida = false

      logger.info(`${fileMethod} | Email de contacto sin dominio institucional: ${JSON.stringify(causa_referencia_invalida)}`)
    }

    // Validacion para que el numero telefonico no pertenezca a otro contacto
    const [telefono_contacto_bd] = await certificationService.getTelefonoContacto(id_contacto)
    const [telefonos_contacto_bd] = await certificationService.getTelefonosContacto(telefono_contacto_bd, id_referencia)
    if (telefonos_contacto_bd.referencias_telefonicas > 0) {
      const mensaje_telefono_contacto_repetido = await globalConfig.find(item => item.nombre === 'mensaje_telefono_contacto_repetido').valor
      causa_referencia_invalida.push(mensaje_telefono_contacto_repetido)
      referencia_valida = false

      logger.info(`${fileMethod} | Teléfono de contacto sea similar al de otro proveedor proporcionado: ${JSON.stringify(causa_referencia_invalida)}`)
    }

    const mensajeFinal = causa_referencia_invalida.join(", ")

    logger.info(`${fileMethod} | Referencia valida: ${JSON.stringify(referencia_valida)}`)
    logger.info(`${fileMethod} | Observaciones para validar referencia: ${JSON.stringify(mensajeFinal)}`)

    return {
      referencia_valida,
      causas_referencia_no_valida: mensajeFinal
    }

  } catch (error) {
    console.log(error)
    return false
  }
}


const updateInformacionContacto = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: updateInformacionContacto`
  try {
    const { body } = req
    const { datos_contacto, datos_empresa_contacto, datos_cliente, ip_cliente } = body
    let { id_certification } = body
    logger.info(`${fileMethod} | Inicia proceso de actualizacion de datos de refernciado: ${JSON.stringify(body)}`)

    const {
      linea_credito_otorgada,
      saldo_vigente_linea_credito,
      saldo_vencido_linea_credito,
      plazo_credito_dso,
      dias_atraso
    } = datos_cliente ?? {};

    const saldoTotal = saldo_vigente_linea_credito + saldo_vencido_linea_credito;

    const pctDeuda = +(saldoTotal / linea_credito_otorgada * 100).toFixed(2);

    const globalConfig = await utilitiesService.getParametros()

    const [referencia_contestada] = await certificationService.obtieneEstatusRespuesta(datos_empresa_contacto.id_referencia)

    if (referencia_contestada.contestada === 'si') {
      logger.info(`${fileMethod} | Esta referencia ya ha sido contestada: ${JSON.stringify(referencia_contestada)}`)
      return res.status(200).json({
        error: false,
        reult: 'OK',
        message: 'Esta referencia ya fue contestada'
      })
    }


    // Obtenemos el id_cliente de la certificacion que aqui se  pasa como parametro
    const [get_id_empresa] = await certificationService.obtieneIdEmpresaByIdCertification(id_certification)


    // Se valida si el id_certification es el ultimo
    const [get_last_id_certification] = await certificationService.obtieneUltimoIdCertification(get_id_empresa.id_empresa)

    id_certification = get_last_id_certification.id_certification
    body.id_certification = id_certification

    body.porcentaje_deuda = pctDeuda

    await certificationService.actualizaContacto(body)
    await certificationService.actualizaDireccionReferenciaComercial(body)
    await certificationService.actualizaReferenciaComercial(body)
    await certificationService.insertEmpresaCliente(body)

    const [empresa_cliente_referencia_comercial] = await companiesService.getEmpresaByIdCertification(id_certification)
    logger.info(`${fileMethod} | empresa_cliente_referencia_comercial: ${JSON.stringify(empresa_cliente_referencia_comercial)}`)
    const [email_empresa_cliente] = await companiesService.getUserEmailByIdEmpresa(empresa_cliente_referencia_comercial.id_empresa)
    logger.info(`${fileMethod} | email_empresa_cliente: ${JSON.stringify(email_empresa_cliente)}`)
    const [empresa_referencia_comercial] = await companiesService.getEmpresaByIdContacto(datos_empresa_contacto.id_referencia)
    logger.info(`${fileMethod} | empresa_referencia_comercial: ${JSON.stringify(empresa_referencia_comercial)}`)
    const [empresa_investigada] = await companiesService.getEmpresaById(empresa_cliente_referencia_comercial.id_empresa)
    logger.info(`${fileMethod} | empresa_investigada: ${JSON.stringify(empresa_investigada)}`)

    // const [user_email] = await companiesService.getUserEmailByIdEmpresa(empresa_investigada.emp_id )

    const referencia_valida = await validacionesReferenciasComercialesValidas(body, empresa_referencia_comercial)
    logger.info(`${fileMethod} | La referencia es valida: ${JSON.stringify(referencia_valida)}`)
    await certificationService.actualizaReferenciaValida(
      referencia_valida,
      datos_empresa_contacto.id_referencia,
      ip_cliente
    )
    const [reporte_credito_fecha] = await certificationService.getFechaReporteCredito(id_certification)
    const [reporte_credito_descriptivo] = await certificationService.getDataReporteCreditoDescriptivo(id_certification)
    if (!reporte_credito_fecha && !reporte_credito_descriptivo) {
      logger.info(`${fileMethod} | No se han ejecutado reportes previos`)
      return res.status(200).json({
        error: false,
        reult: 'OK',
        message: 'No se han generado reportes previos, por lo que el cliente debe ejecutar el algoritmo manualmente',
      })
    }
    const fechaInicio = new Date(reporte_credito_fecha?.fecha_generado || reporte_credito_descriptivo?.fecha_generado)
    const fechaHoy = new Date()
    const diferenciaMs = fechaHoy - fechaInicio
    const diasTranscurridos = Math.floor(diferenciaMs / (1000 * 60 * 60 * 24))
    logger.info(`${fileMethod} | Dias Transcurridos desde laultima generacion de reporte de credito: ${JSON.stringify(diasTranscurridos)}`)

    const dias_tolerancia_generar_reporte = JSON.parse(await globalConfig.find(item => item.nombre === 'dias_tolerancia_generar_reporte').valor)

    // Prepara respuesta para que el front llame getResultAlgoritmo
    const [reporte_credito_data] = await certificationService.getDataReporteCredito(id_certification)
    logger.info(`${fileMethod} | reporte_credito_data: ${JSON.stringify(reporte_credito_data)}`)
    const [solicitud_credito] = await certificationService.getSolicitudCreditoById(reporte_credito_data.id_reporte_credito)
    logger.info(`${fileMethod} | solicitud_credito: ${JSON.stringify(solicitud_credito)}`)
    const [email_proveedor] = await certificationService.getEmailProveedorByIdProveedor(solicitud_credito.id_proveedor)
    logger.info(`${fileMethod} | email_proveedor: ${JSON.stringify(email_proveedor)}`)

    if (diasTranscurridos < dias_tolerancia_generar_reporte) {

      const request_algoritmo = {
        id_proveedor: solicitud_credito?.id_proveedor ?? null,
        id_cliente: solicitud_credito?.id_cliente ?? null,
        plazo: solicitud_credito?.plazo ?? null,
        monto_solicitado: solicitud_credito?.monto_solicitado ?? null,
        id_reporte_credito: solicitud_credito?.id_solicitud_credito ?? null
      }


      logger.info(`${fileMethod} | Ejecución de reporte de credito automatico en front con la data: ${JSON.stringify(request_algoritmo)}`)
      return res.status(200).json({
        error: false,
        request_algoritmo: request_algoritmo,
        empresa_email: empresa_cliente_referencia_comercial?.empresa_nombre ?? null,
        email_comprador: email_empresa_cliente?.usu_email ?? null,
        email_proveedor: email_proveedor?.email_proveedor ?? null,
        emp_rfc: empresa_cliente_referencia_comercial?.emp_rfc ?? null,
        message: 'Ejecutar algoritmo'
      })

    } else {
      // Envio de email al cliente para aviso de que debe ejecutar reporte manualmente con la nueva referencia comercial
      const send = await sendEmailInTimeOutTime(/*user_email.usu_email*/email_proveedor?.email_proveedor, email_proveedor?.empresa_proveedor)
      logger.info(`${fileMethod} | Se envia correo al cliente : ${JSON.stringify(send)}`)
      return res.status(200).json({
        error: false,
        send,
        message: 'El cliente debe ejecutar el algoritmo manualmente',
      })
    }
  } catch (error) {
    next(error)
  }
}

const sendEmailInTimeOutTime = async (email_empresa, nombre_empresa) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: sendEmailInTimeOutTime`
  try {
    const globalConfig = await utilitiesService.getParametros()
    const id_plantilla_mailjet_out = await globalConfig.find(item => item.nombre === 'id_plantilla_mailjet_out').valor

    const request_email = {
      Messages: [
        {
          From: {
            Email: 'mkt@credibusiness.site',
            Name: 'credibusiness'
          },
          To: [
            {
              Email: email_empresa,
              Name: nombre_empresa
            }
          ],
          TemplateID: Number(id_plantilla_mailjet_out),
          TemplateLanguage: true,
          Variables: {
            empresa: nombre_empresa
          }
        }
      ]
    }

    logger.info(`${fileMethod} | Request para mailjet: ${JSON.stringify(request_email)}`)

    const envio_email = await mailjet
      .post('send', { version: 'v3.1' })
      .request(request_email)

    const result_mailjet = envio_email.body
    logger.info(`${fileMethod} | Respuesta de envio de correo a cliente: ${JSON.stringify(result_mailjet)}`)

    const message_href = result_mailjet.Messages[0].To[0].MessageHref
    const message_id = result_mailjet.Messages[0].To[0].MessageID
    await delay(3000)
    const response_status_mailjet = await axios.get(message_href, {
      auth: {
        username: key,
        password: secretKey
      }
    })

    const result_estatus_envio = response_status_mailjet.data
    logger.info(`${fileMethod} | Respuesta del estatus del correo: ${JSON.stringify(result_estatus_envio)}`)

    return result_estatus_envio

  } catch (error) {
    return error
  }
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

const generarReporteInformativoo = async (customUuid, idEmpresa, id_reporte_credito, _reporte_credito, id_certification, mensaje_bloc, mensaje_konesh) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: generarReporteInformativo`

  try {
    logger.info(`${fileMethod} | ${customUuid} | El ID de empresa para generar reporte de credito es: ${JSON.stringify(idEmpresa)}`)

    if (!idEmpresa) {
      return {
        error: true,
        descripcion: 'idEmpresa Obligatorio'
      }
    }

    const _certification = await consultaCertificacion(customUuid, idEmpresa)
    logger.info(`${fileMethod} | ${customUuid} | Consulta de la ultima certificación: ${JSON.stringify(_certification)}`)

    const datos_reporte = {
      ..._reporte_credito,      // Agregamos datos de cálculo
      certificacion: _certification?.certificacion,
      partidasFinancieras: _certification?.partidasFinancieras,
      referenciasComerciales: _certification?.referenciasComerciales,
      mercadoObjetivo: _certification?.mercadoObjetivo,
      demandas: _certification?.demandas,
    }

    const encabezado = {
      razon_social: datos_reporte?.certificacion?.[0]?.razon_social,
      rfc: datos_reporte?.certificacion?.[0]?.rfc,
      pais: datos_reporte?._01_pais?.descripcion,

      // direccion_fiscal: reporte_credito?.certificacion?.[0]?.direccion_fiscal,
      direccion_fiscal: datos_reporte?.certificacion?.[0]?.direccion_fiscal?.calle ?? ' '
        + ' # ' + datos_reporte?.certificacion?.[0]?.direccion_fiscal?.numero
        + ', ' + datos_reporte?.certificacion?.[0]?.direccion_fiscal?.ciudad
        + ', ' + datos_reporte?.certificacion?.[0]?.direccion_fiscal?.estado
        + '. C.P. : ' + datos_reporte?.certificacion?.[0]?.direccion_fiscal?.codigo_postal
        + ' . ' + datos_reporte?.certificacion?.[0]?.direccion_fiscal?.pais
      ,

      telefono: '',
      correo: '',
      pagina_web: datos_reporte?.certificacion?.[0]?.web_site,
    }

    logger.info(`${fileMethod} | ${customUuid} | Encabezado-info: ${JSON.stringify(datos_reporte)}`)

    const resumen = {
      experiencia: datos_reporte?._06_tiempo_actividad.descripcion,
      plantilla_laboral: datos_reporte?._04_plantilla_laboral?.descripcion,
      sector: datos_reporte?._02_sector_riesgo_descripcion?.descripcion,
      sector_cliente_final: datos_reporte?._05_sector_cliente_final?.descripcion,

      empresa_controlante_rfc: '-',
      empresa_controlante_razon_social: '-',

      capital_contable: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[0]?.capital_contable ?? '-',
      ventas_anuales: datos_reporte?.partidasFinancieras?.certification_partidas_estado_resultados_contables?.[0]?.ventas_anuales ?? '-',
      caja_bancos: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[0]?.caja_bancos ?? '-',

      linea_credito: '-',

      plazo_pago: datos_reporte.plazo,// datos_reporte?.plazo,

      ventas_gobierno: '0',
      empresas_relacionadas: '0',
      fecha_actualizacion_69_69B: '0',

      empresas_relacionadas_: '0',

      datos_obtenidos: {
        referencias_comerciales: 1,
        indicencias_mercantiles: 1,
        contribuyente_incumplido: 0
      }
    }

    const accionistaControlante = datos_reporte?.certificacion?.[0]?.accionistas?.find(a => parseInt(a.controlante) === 1)
    if (accionistaControlante) {
      resumen.empresa_controlante_razon_social = accionistaControlante.razon_social || '-'
      resumen.empresa_controlante_rfc = accionistaControlante.rfc || '-'
    }

    logger.info(`${fileMethod} | ${customUuid} | Resumen-info: ${JSON.stringify(resumen)}`)

    const resultados = {
      linea_credito_solicitada: datos_reporte.monto_solicitado,// reporte_credito?.reporteCredito?.monto_solicitado ?? '-',
    }
    logger.info(`${fileMethod} | ${customUuid} | Resultados: ${JSON.stringify(resultados)}`)

    const performance_financiero = {
      balance_anio_anterior_indicador: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[0]?.periodo_anterior ?? '-',
      balance_anio_anterior_caja_bancos: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[0]?.caja_bancos ?? '-',
      balance_anio_anterior_saldo_clientes: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[0]?.saldo_cliente_cuenta_x_cobrar ?? '-',
      balance_anio_anterior_saldo_inventarios: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[0]?.saldo_inventarios ?? '-',
      balance_anio_anterior_deuda_corto_plazo: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[0]?.deuda_corto_plazo ?? '-',
      balance_anio_anterior_deuda_total: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[0]?.deuda_total ?? '-',
      balance_anio_anterior_capital_contable: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[0]?.capital_contable ?? '-',

      balance_anio_previo_anterior_indicador: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[1]?.periodo_previo_anterior ?? '-',
      balance_anio_previo_anterior_caja_bancos: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[1]?.caja_bancos ?? '-',
      balance_anio_previo_anterior_saldo_clientes: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[1]?.saldo_cliente_cuenta_x_cobrar ?? '-',
      balance_anio_previo_anterior_saldo_inventarios: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[1]?.saldo_inventarios ?? '-',
      balance_anio_previo_anterior_deuda_corto_plazo: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[1]?.deuda_corto_plazo ?? '-',
      balance_anio_previo_anterior_deuda_total: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[1]?.deuda_total ?? '-',
      balance_anio_previo_anterior_capital_contable: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[1]?.capital_contable ?? '-',

      estado_resultados_anio_anterior_indicador: datos_reporte?.partidasFinancieras?.certification_partidas_estado_resultados_contables?.[0]?.periodo_anterior ?? '-',
      estado_resultados_anio_anterior_ventas_anuales: datos_reporte?.partidasFinancieras?.certification_partidas_estado_resultados_contables?.[0]?.ventas_anuales ?? '-',
      estado_resultados_anio_anterior_costo_ventas: datos_reporte?.partidasFinancieras?.certification_partidas_estado_resultados_contables?.[0]?.costo_ventas_anuales ?? '-',
      estado_resultados_anio_anterior_utilidad_operativa: datos_reporte?.partidasFinancieras?.certification_partidas_estado_resultados_contables?.[0]?.utilidad_operativa ?? '-',

      estado_resultados_anio_previo_anterior_indicador: datos_reporte?.partidasFinancieras?.certification_partidas_estado_resultados_contables?.[1]?.periodo_previo_anterior ?? '-',
      estado_resultados_anio_previo_anterior_ventas_anuales: datos_reporte?.partidasFinancieras?.certification_partidas_estado_resultados_contables?.[1]?.ventas_anuales ?? '-',
      estado_resultados_anio_previo_anterior_costo_ventas: datos_reporte?.partidasFinancieras?.certification_partidas_estado_resultados_contables?.[1]?.costo_ventas_anuales ?? '-',
      estado_resultados_anio_previo_anterior_utilidad_operativa: datos_reporte?.partidasFinancieras?.certification_partidas_estado_resultados_contables?.[1]?.utilidad_operativa ?? '-',

    }

    logger.info(`${fileMethod} | ${customUuid} | Performance financiero: ${JSON.stringify(performance_financiero)}`)

    const ratio_financiero = {
      ratio_financiero_indicador: performance_financiero.estado_resultados_anio_anterior_indicador,        // Periodo Anterior
      ratio_financiero_ventas_anuales: performance_financiero.estado_resultados_anio_anterior_ventas_anuales,
      ratio_financiero_evolucion_Ventas: datos_reporte?._11_evolucion_ventas?.parametro ?? '-',
      ratio_financiero_payback: datos_reporte?._14_payback?.parametro ?? '-',
      ratio_financiero_apalancamiento: datos_reporte?._12_apalancamiento?.parametro ?? '-',

      ratio_financiero_DSO: datos_reporte?._15_rotacion_ctas_x_cobrar?.parametro_dso ?? '-',
      ratio_financiero_DIO: datos_reporte?._15_rotacion_ctas_x_cobrar?.parametro_dio ?? '-',

      ratio_financiero_flujo_caja: datos_reporte?._13_flujo_neto?.parametro ?? '-',
    }

    logger.info(`${fileMethod} | ${customUuid} | Ratio financiero: ${JSON.stringify(ratio_financiero)}`)

    // Formateamos los datos numéricos a moneda
    const formatter = new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    });

    if (resumen.capital_contable != '-') resumen.capital_contable = formatter.format(resumen.capital_contable);
    if (resumen.ventas_anuales != '-') resumen.ventas_anuales = formatter.format(resumen.ventas_anuales);
    if (resumen.caja_bancos != '-') resumen.caja_bancos = formatter.format(resumen.caja_bancos);

    if (resumen.linea_credito != '-') resumen.linea_credito = formatter.format(resumen.linea_credito);

    if (resultados.linea_credito_solicitada != '-') resultados.linea_credito_solicitada = formatter.format(resultados.linea_credito_solicitada);

    if (performance_financiero.balance_anio_anterior_caja_bancos != '-') performance_financiero.balance_anio_anterior_caja_bancos = formatter.format(performance_financiero.balance_anio_anterior_caja_bancos);
    if (performance_financiero.balance_anio_anterior_saldo_clientes != '-') performance_financiero.balance_anio_anterior_saldo_clientes = formatter.format(performance_financiero.balance_anio_anterior_saldo_clientes);
    if (performance_financiero.balance_anio_anterior_saldo_inventarios != '-') performance_financiero.balance_anio_anterior_saldo_inventarios = formatter.format(performance_financiero.balance_anio_anterior_saldo_inventarios);
    if (performance_financiero.balance_anio_anterior_deuda_corto_plazo != '-') performance_financiero.balance_anio_anterior_deuda_corto_plazo = formatter.format(performance_financiero.balance_anio_anterior_deuda_corto_plazo);
    if (performance_financiero.balance_anio_anterior_deuda_total != '-') performance_financiero.balance_anio_anterior_deuda_total = formatter.format(performance_financiero.balance_anio_anterior_deuda_total);
    if (performance_financiero.balance_anio_anterior_capital_contable != '-') performance_financiero.balance_anio_anterior_capital_contable = formatter.format(performance_financiero.balance_anio_anterior_capital_contable);

    if (performance_financiero.balance_anio_previo_anterior_caja_bancos != '-') performance_financiero.balance_anio_previo_anterior_caja_bancos = formatter.format(performance_financiero.balance_anio_previo_anterior_caja_bancos);
    if (performance_financiero.balance_anio_previo_anterior_saldo_clientes != '-') performance_financiero.balance_anio_previo_anterior_saldo_clientes = formatter.format(performance_financiero.balance_anio_previo_anterior_saldo_clientes);
    if (performance_financiero.balance_anio_previo_anterior_saldo_inventarios != '-') performance_financiero.balance_anio_previo_anterior_saldo_inventarios = formatter.format(performance_financiero.balance_anio_previo_anterior_saldo_inventarios);
    if (performance_financiero.balance_anio_previo_anterior_deuda_corto_plazo != '-') performance_financiero.balance_anio_previo_anterior_deuda_corto_plazo = formatter.format(performance_financiero.balance_anio_previo_anterior_deuda_corto_plazo);
    if (performance_financiero.balance_anio_previo_anterior_deuda_total != '-') performance_financiero.balance_anio_previo_anterior_deuda_total = formatter.format(performance_financiero.balance_anio_previo_anterior_deuda_total);
    if (performance_financiero.balance_anio_previo_anterior_capital_contable != '-') performance_financiero.balance_anio_previo_anterior_capital_contable = formatter.format(performance_financiero.balance_anio_previo_anterior_capital_contable);

    if (performance_financiero.estado_resultados_anio_anterior_ventas_anuales != '-') performance_financiero.estado_resultados_anio_anterior_ventas_anuales = formatter.format(performance_financiero.estado_resultados_anio_anterior_ventas_anuales);
    if (performance_financiero.estado_resultados_anio_anterior_costo_ventas != '-') performance_financiero.estado_resultados_anio_anterior_costo_ventas = formatter.format(performance_financiero.estado_resultados_anio_anterior_costo_ventas);
    if (performance_financiero.estado_resultados_anio_anterior_utilidad_operativa != '-') performance_financiero.estado_resultados_anio_anterior_utilidad_operativa = formatter.format(performance_financiero.estado_resultados_anio_anterior_utilidad_operativa);

    if (performance_financiero.estado_resultados_anio_previo_anterior_ventas_anuales != '-') performance_financiero.estado_resultados_anio_previo_anterior_ventas_anuales = formatter.format(performance_financiero.estado_resultados_anio_previo_anterior_ventas_anuales);
    if (performance_financiero.estado_resultados_anio_previo_anterior_costo_ventas != '-') performance_financiero.estado_resultados_anio_previo_anterior_costo_ventas = formatter.format(performance_financiero.estado_resultados_anio_previo_anterior_costo_ventas);
    if (performance_financiero.estado_resultados_anio_previo_anterior_utilidad_operativa != '-') performance_financiero.estado_resultados_anio_previo_anterior_utilidad_operativa = formatter.format(performance_financiero.estado_resultados_anio_previo_anterior_utilidad_operativa);

    if (ratio_financiero.ratio_financiero_ventas_anuales != '-') ratio_financiero.ratio_financiero_ventas_anuales = formatter.format(ratio_financiero.ratio_financiero_ventas_anuales);
    if (ratio_financiero.ratio_financiero_evolucion_Ventas != '-') ratio_financiero.ratio_financiero_evolucion_Ventas = formatter.format(ratio_financiero.ratio_financiero_evolucion_Ventas);
    if (ratio_financiero.ratio_financiero_payback != '-') ratio_financiero.ratio_financiero_payback = formatter.format(ratio_financiero.ratio_financiero_payback);
    if (ratio_financiero.ratio_financiero_apalancamiento != '-') ratio_financiero.ratio_financiero_apalancamiento = formatter.format(ratio_financiero.ratio_financiero_apalancamiento);
    if (ratio_financiero.ratio_financiero_DSO != '-') ratio_financiero.ratio_financiero_DSO = formatter.format(ratio_financiero.ratio_financiero_DSO);
    if (ratio_financiero.ratio_financiero_DIO != '-') ratio_financiero.ratio_financiero_DIO = formatter.format(ratio_financiero.ratio_financiero_DIO);
    if (ratio_financiero.ratio_financiero_flujo_caja != '-') ratio_financiero.ratio_financiero_flujo_caja = formatter.format(ratio_financiero.ratio_financiero_flujo_caja);

    const accionistas = datos_reporte?.certificacion?.[0]?.accionistas?.map((accionista) => ({ nombre: accionista?.razon_social, tax_id: accionista?.rfc })) ?? [];
    logger.info(`${fileMethod} | ${customUuid} | Accionistas-Mayores: ${JSON.stringify(accionistas)}`)

    let principales_directores = [];

    try {
      const directoresRaw = datos_reporte?.certificacion?.[0]?.principales_directores;

      if (Array.isArray(directoresRaw) && directoresRaw.length > 0) {
        principales_directores = directoresRaw.map((director) => ({
          nombre: director?.nombre?.trim() || 'No disponible',
          puesto: director?.puesto_nombre?.trim() || 'No disponible',
          poder: director?.poder_nombre?.trim() || 'No disponible'
        }))
          // Opcional: eliminar directores totalmente vacíos
          .filter(dir => dir.nombre !== 'No disponible' || dir.puesto !== 'No disponible' || dir.poder !== 'No disponible');
      } else {
        logger.warn(`${fileMethod} | ${customUuid} | No se encontraron directores en la fuente de datos.`);
      }
    } catch (error) {
      logger.error(`${fileMethod} | ${customUuid} | Error al procesar principales directores: ${error.message}`);
    }


    const estructura_personal = {
      operativo: datos_reporte?.certificacion?.[0]?.estructura_personal?.[0]?.personal_operativo ?? 0,
      administrativo: datos_reporte?.certificacion?.[0]?.estructura_personal?.[0]?.personal_administrativo ?? 0,
      directivo: datos_reporte?.certificacion?.[0]?.estructura_personal?.[0]?.personal_directivo ?? 0,
    }
    logger.info(`${fileMethod} | ${customUuid} | Estructura personal: ${JSON.stringify(estructura_personal)}`)

    const datos_reportes = {
      certificacion: [
        {
          equipo_transporte: [
            {
              flotilla_carga_especializado: 5,
              flotilla_otros_vehiculos: 3
            }
          ]
        }
      ]
    };

    const equipo_transporte = {
      carga: datos_reportes?.certificacion?.[0]?.equipo_transporte?.[0]?.flotilla_carga_especializado ?? 0,
      otros: datos_reportes?.certificacion?.[0]?.equipo_transporte?.[0]?.flotilla_otros_vehiculos ?? 0
    };

    logger.info(`${fileMethod} | ${customUuid} | Equipo transporte: ${JSON.stringify(equipo_transporte)}`)

    const seguros = datos_reporte?.certificacion?.[0]?.seguros?.map((seguro) => ({ nombre_aseguradora: seguro?.nombre_aseguradora, bien_asegurado: seguro?.bien_asegurado })) ?? [];
    logger.info(`${fileMethod} | ${customUuid} | Seguros: ${JSON.stringify(seguros)}`)

    const mercado_objetivo_principales_clientes = datos_reporte?.mercadoObjetivo?.principales_clientes?.map((pc) => ({ nombre_empresa: pc?.razon_social, anios_relacion: pc?.anios_relacion, pais: pc?.pais, sector: pc?.sector })) ?? [];
    logger.info(`${fileMethod} | ${customUuid} | Mercado objetivo principales clientes: ${JSON.stringify(mercado_objetivo_principales_clientes)}`)

    const mercado_objetivo_estructura_ventas = {
      credito_total: datos_reporte?.mercadoObjetivo?.estructuras_ventas?.[0]?.porcentaje_credito_total_ventas ?? 0,
      contado_total: datos_reporte?.mercadoObjetivo?.estructuras_ventas?.[0]?.porcentaje_contado_total_ventas ?? 0,
      ventas_gobierno: datos_reporte?.mercadoObjetivo?.estructuras_ventas?.[0]?.porcentaje_ventas_gobierno ?? 0,
    }
    logger.info(`${fileMethod} | ${customUuid} | Mercado objetivo estructura ventas: ${JSON.stringify(mercado_objetivo_estructura_ventas)}`)

    // `referenciasComerciales` es un array de objetos
    const referencias_comerciales = datos_reporte?.referenciasComerciales.map(item => ({
      razon_social: item.razon_social,
      rfc: item.rfc,
      calificacion_referencia: item.calificacion_referencia,
      linea_credito: item.linea_credito,
      porcentaje_deuda: item.porcentaje_deuda,
      dias_atraso: item.dias_atraso
    }));
    // Imprimir cada razón social
    logger.info(`${fileMethod} | ${customUuid} | Referencias Comerciales Actualizadas: ${JSON.stringify(referencias_comerciales)}`);

    const mercado_objetivo_importaciones = datos_reporte?.mercadoObjetivo?.importaciones?.map((im) => ({ pais: im?.pais, porcentaje: im?.porcentaje })) ?? [];
    logger.info(`${fileMethod} | ${customUuid} | Mercado objetivo Importaciones: ${JSON.stringify(mercado_objetivo_importaciones)}`)

    const mercado_objetivo_exportaciones = datos_reporte?.mercadoObjetivo?.exportaciones?.map((ex) => ({ pais: ex?.pais, porcentaje: ex?.porcentaje })) ?? [];
    logger.info(`${fileMethod} | ${customUuid} | Mercado objetivo Exportaciones: ${JSON.stringify(mercado_objetivo_exportaciones)}`)

    logger.info(`${fileMethod} | objetivo empresaID: ${JSON.stringify(idEmpresa)}`)

    // Quitar
    // let consulta_bloc = await consultaBlocLocal(idEmpresa);

    // logger.info(`${fileMethod} | consulta_bloc: ${JSON.stringify(consulta_bloc)}`)


    // Extraer bloc del objeto de respuesta
    const bloc_concursos_mercantiles = [];
    const bloc_importadores_exportadores = [];
    const bloc_lista_69_incumplidos = [];
    const bloc_ofac = [];
    const bloc_proveedores_contratistas = [];
    const bloc_sat69b = [];


    const { strHTML } = idEmpresa;

    const actividad_economica = await certificationService.getIndustriaNombre(idEmpresa)
    logger.info(`${fileMethod} | ${customUuid} | Información de actividad_economica ${JSON.stringify(actividad_economica[0].industria_nombre)}`)

    let strHTML_paso = '<html>';
    strHTML_paso += ' <head>';
    strHTML_paso += ' </head>';
    strHTML_paso += ' <body>';
    strHTML_paso += '  Hola Mundo !!!! ';
    strHTML_paso += ' </body>';
    strHTML_paso += ' </html>';

    logger.info(`${fileMethod} | ${customUuid} | strHTML_paso: ${JSON.stringify(strHTML_paso)}`)

    // Verificar y crear el directorio si no existe
    const tempDir = path.join(__dirname, '../../temp')
    logger.info(`${fileMethod} | ${customUuid} | Directorio temporal: ${JSON.stringify(tempDir)}`)

    try {
      await fsp.access(tempDir);
    } catch {
      await fsp.mkdir(tempDir, { recursive: true });
    }

    // let rutaArchivo = 'generatorPDF/testPDF';
    const rutaPlantilla = path.join(__dirname, '../../temp/plantillaInformativa.html')
    logger.info(`${fileMethod} | ${customUuid} | Ruta de la plantilla: ${JSON.stringify(rutaPlantilla)}`)

    //const rutaArchivo = path.join(__dirname, '../../temp/testPDF')

    const rutaArchivo = path.join(__dirname, '../../temp/ReporteCredito_' + encabezado.rfc)
    logger.info(`${fileMethod} | ${customUuid} | Ruta del archivo: ${JSON.stringify(rutaArchivo)}`)

    // Crear una cadena con todas las razones sociales
    const razonesSociales = referencias_comerciales
      .map(item =>
        `<tr>
          <td style="padding: 8px; border: 1px solid #ddd; color: #0a3d8e;">${item.razon_social}</td>
          <td style="padding: 8px; border: 1px solid #ddd; color: #0a3d8e;">${item.rfc}</td>
        </tr>`
      )
      .join('');
    logger.info(`${fileMethod} | ${customUuid} | Plantilla Referencia prueba: ${razonesSociales}`)

    const mercantiles = bloc_concursos_mercantiles.length > 0 ? bloc_concursos_mercantiles.map((obj, index) => {
      const rows = Object.entries(obj)
        .filter(([key]) => key !== 'id' && key !== 'id_certificacion' && key !== 'created_at' && key !== 'updated_at') // Excluir id y id_certificacion
        .map(([key, value]) => `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; color: #0a3d8e; width: 30%;">${key}</td>
        <td style="padding: 8px; border: 1px solid #ddd; color: #0a3d8e;">
          ${value !== null && value !== undefined && value !== '' ? value : 'N/A'}
        </td>
      </tr>
    `).join('');

      return `
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      ${rows}
    </table>
  `;
    }).join('') : `
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; color: #0a3d8e; width: 30%;">N/A</td>
      <td style="padding: 8px; border: 1px solid #ddd; color: #0a3d8e;">N/A</td>
    </tr>
  </table>
`;

    console.log('mapeo correcto', mercantiles);

    const import_export = bloc_importadores_exportadores.length > 0 ? bloc_importadores_exportadores.map((obj, index) => {
      const rows = Object.entries(obj)
        .filter(([key]) => key !== 'id' && key !== 'id_certificacion' && key !== 'created_at' && key !== 'updated_at')
        .map(([key, value]) => `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; color: #0a3d8e; width: 30%;">${key}</td>
          <td style="padding: 8px; border: 1px solid #ddd; color: #0a3d8e;">
            ${value !== null && value !== undefined && value !== '' ? value : 'N/A'}
          </td>
        </tr>
      `).join('');

      return `
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        ${rows}
      </table>
    `;
    }).join('') : `
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; color: #0a3d8e; width: 30%;">N/A</td>
        <td style="padding: 8px; border: 1px solid #ddd; color: #0a3d8e;">N/A</td>
      </tr>
    </table>
  `;


    const lista_69 = bloc_lista_69_incumplidos.length > 0 ? bloc_lista_69_incumplidos.map((obj, index) => {
      const rows = Object.entries(obj)
        .filter(([key]) => key !== 'id' && key !== 'id_certificacion' && key !== 'created_at' && key !== 'updated_at')
        .map(([key, value]) => `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; color: #0a3d8e; width: 30%;">${key}</td>
          <td style="padding: 8px; border: 1px solid #ddd; color: #0a3d8e;">
            ${value !== null && value !== undefined && value !== '' ? value : 'N/A'}
          </td>
        </tr>
      `).join('');

      return `
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        ${rows}
      </table>
    `;
    }).join('') : `
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; color: #0a3d8e; width: 30%;">N/A</td>
        <td style="padding: 8px; border: 1px solid #ddd; color: #0a3d8e;">N/A</td>
      </tr>
    </table>
  `;

    const proveedores_contratistas = bloc_proveedores_contratistas.length > 0 ? bloc_proveedores_contratistas.map((obj, index) => {
      const rows = Object.entries(obj)
        .filter(([key]) => key !== 'id' && key !== 'id_certificacion' && key !== 'created_at' && key !== 'updated_at')
        .map(([key, value]) => `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; color: #0a3d8e; width: 30%;">${key}</td>
          <td style="padding: 8px; border: 1px solid #ddd; color: #0a3d8e;">
            ${value !== null && value !== undefined && value !== '' ? value : 'N/A'}
          </td>
        </tr>
      `).join('');

      return `
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        ${rows}
      </table>
    `;
    }).join('') : `
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; color: #0a3d8e; width: 30%;">N/A</td>
        <td style="padding: 8px; border: 1px solid #ddd; color: #0a3d8e;">N/A</td>
      </tr>
    </table>
  `;

    // Resultado final
    logger.info(`${fileMethod} | ${customUuid} | bloc concursos mercantiles: ${proveedores_contratistas}`)

    const sat69b = bloc_sat69b.length > 0 ? bloc_sat69b.map((obj, index) => {
      const rows = Object.entries(obj)
        .filter(([key]) => key !== 'id' && key !== 'id_certificacion' && key !== 'created_at' && key !== 'updated_at')
        .map(([key, value]) => `
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; color: #0a3d8e; width: 30%;">${key}</td>
            <td style="padding: 8px; border: 1px solid #ddd; color: #0a3d8e;">
              ${value !== null && value !== undefined && value !== '' ? value : 'N/A'}
            </td>
          </tr>
        `).join('');

      return `
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          ${rows}
        </table>
      `;
    }).join('') : `
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; color: #0a3d8e; width: 30%;">N/A</td>
          <td style="padding: 8px; border: 1px solid #ddd; color: #0a3d8e;">N/A</td>
        </tr>
      </table>
    `;

    // Resultado final
    logger.info(`${fileMethod} | ${customUuid} | bloc concursos mercantiles: ${sat69b}`)

    const blocOfac = bloc_ofac.length > 0 ? bloc_ofac.map((obj, index) => {
      const rows = Object.entries(obj)
        .filter(([key]) => key !== 'id' && key !== 'id_certificacion' && key !== 'created_at' && key !== 'updated_at')
        .map(([key, value]) => `
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; color: #0a3d8e; width: 30%;">${key}</td>
            <td style="padding: 8px; border: 1px solid #ddd; color: #0a3d8e;">
              ${value !== null && value !== undefined && value !== '' ? value : 'N/A'}
            </td>
          </tr>
        `).join('');

      return `
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          ${rows}
        </table>
      `;
    }).join('') : `
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; color: #0a3d8e; width: 30%;">N/A</td>
          <td style="padding: 8px; border: 1px solid #ddd; color: #0a3d8e;">N/A</td>
        </tr>
      </table>
    `;

    // Resultado final
    logger.info(`${fileMethod} | ${customUuid} | -bloc concursos mercantiles: ${blocOfac}`)


    let location = null

    strHTML_paso = await fsp.readFile(rutaPlantilla, 'utf8')
    logger.info(`${fileMethod} | ${customUuid} | Lectura del archivo: ${JSON.stringify(strHTML_paso)}`)

    const _fecha_elaboracion = new Date().toISOString().substring(0, 10)
    logger.info(`Fecha d eelaboración: ${JSON.stringify(_fecha_elaboracion)}`)

    const idCertification = _certification.certificacion[0].id_certification
    logger.info(`${fileMethod} | ${customUuid} | Id de certificación: ${JSON.stringify(idCertification)}`)

    const compartir_info_empresa = await certificationService.getCertificacionPartidaFinanciera(idCertification);
    const soloCompartirInfoEmpresa = compartir_info_empresa?.result?.[0]?.compartir_info_empresa;

    logger.info(`${fileMethod} | ${customUuid} | compartir_info_empresa del primer objeto: ${soloCompartirInfoEmpresa}`);

    const [calculos_estado_balance] = await certificationService.getCalculoEstadoBalance(idCertification)
    logger.info(`${fileMethod} | ${customUuid} | Calculo del estado de balance: ${JSON.stringify(calculos_estado_balance)}`)

    const [calculos_estado_resultados] = await certificationService.getCalculoEstadoResultado(idCertification)
    logger.info(`${fileMethod} | ${customUuid} | Calculo del estado de resultados: ${JSON.stringify(calculos_estado_resultados)}`)

    /* const resultado = await calculoRatiosFinancieros(customUuid, id_certification, calculos_estado_balance, calculos_estado_resultados);
    logger.info(`${fileMethod} | ${customUuid} | Calculo Ratios Final ${JSON.stringify(resultado)}`) */

    const result = await certificationService.getRatiosFnancieros(idCertification);
    const ratios_financiero = Array.isArray(result) ? result[0] : undefined;

    if (!ratios_financiero) {
      logger.warn(`${fileMethod} | ${customUuid} | Ratios @financiero: NO DATA`);
    } else {
      logger.info(`${fileMethod} | ${customUuid} | Ratios @financiero: ${JSON.stringify(ratios_financiero)}`);
    }

    const empresas_relacionadass = await certificationService.getEmpresasRelacionadasByCertification(idCertification);
    logger.info(`${fileMethod} | ${customUuid} | Empresas Relacionadasss: ${JSON.stringify(empresas_relacionadass)}`);

    const rotacion_ctas_x_cobrar = await getScoreRotacionCtasXCobrasScore(id_certification, customUuid)
    let { periodo_anterior, periodo_previo_anterior } = rotacion_ctas_x_cobrar;

    const anioActual = new Date().getFullYear();

    periodo_anterior = periodo_anterior ?? (anioActual - 1);
    periodo_previo_anterior = periodo_previo_anterior ?? (anioActual - 2);

    logger.info(`${fileMethod} | ${customUuid} | rotacion_ctas_x_cobrarsss: ${JSON.stringify(periodo_anterior)}`);
    logger.info(`${fileMethod} | ${customUuid} | rotacion_ctas_x_cobrarsss: ${JSON.stringify(periodo_previo_anterior)}`);

    const infoEmpresa = await certificationService.consultaEmpresaInfo(idEmpresa)
    if (infoEmpresa.result.length == 0) {
      logger.info(`${fileMethod} | ${customUuid} | No se pudo obtener la información de la empresa ${JSON.stringify(infoEmpresa)}`)
      return null
    }
    logger.info(`${fileMethod} | ${customUuid} | Información de la empresa contador?: ${JSON.stringify(infoEmpresa)}`)

    // Verificar la longitud de 'result' antes de mapear
    logger.info(`${fileMethod} | ${customUuid} | Número de empresas relacionadas: ${empresas_relacionadass.result.length}`);

    const infoBasica = await certificationService.consultaEmpresaPerfil(idEmpresa);
    // TODO Bloque de pruebas
    /* const infoBasica = {
      result: [
        {
          giro: 'Servicios Financieros',
          valores: '', // <--- Este no se debe mostrar
          proposito: 'Impulsar el desarrollo económico',
          emp_desc: 'Empresa líder en el análisis crediticio empresarial.',
          emp_mision: 'Ofrecer soluciones financieras precisas.',
          emp_vision: '', // <--- Este tampoco
        }
      ]
    }; */
    logger.info(`${fileMethod} | ${customUuid} | Información de la empresas basica ${JSON.stringify(infoBasica?.result?.[0] && Object.keys(infoBasica.result[0]).length > 0)}`)

    const empresasRelacion = empresas_relacionadass.result.map(item => ({
      razon_social: item.razon_social,
      pais: item.pais
    }));

    logger.info(`${fileMethod} | ${customUuid} | Mirando errores: ${empresasRelacion}`)

    logger.info(`${fileMethod} | ${customUuid} | Informacion Basica result: ${infoBasica}`)

    const {
      emp_id,
      giro,
      valores,
      proposito,
      emp_desc,
      emp_mision,
      emp_vision
    } = infoBasica?.result?.[0] || {}

    const empresasRelacionadasData = empresas_relacionadass?.result;

    const empresasRelacionadasItems = (empresasRelacionadasData?.length > 0 ? empresasRelacionadasData : [{ razon_social: '-', pais: '-' }])
      .map(empresa => `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">${empresa?.razon_social || '-'}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${empresa?.pais || '-'}</td>
        </tr>
      `).join('');

    const empresas_relacionadad = empresas_relacionadass?.result?.length > 0 ? `
      <div style="display: flex; flex-direction: column;">
        <h5 style="text-transform: uppercase; background-color: #f1f8ff; padding: 8px 12px; border-left: 4px solid #2ba2af; margin-bottom: 20px; color: #2ba2af;">
          Empresas Relacionadas
        </h5>
      </div>
      <div style="background-color: #f1f8ff; border-left: 5px solid #2ba2af; padding: 10px 20px; margin-bottom: 10px; width: 100%;">
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px;">
          <thead>
            <tr style="background-color: #2ba2af; color: white; text-align: left;">
              <th style="padding: 8px; border: 1px solid #ddd;">Razón Social</th>
              <th style="padding: 8px; border: 1px solid #ddd;">País</th>
            </tr>
          </thead>
          <tbody>
            ${empresasRelacionadasItems}
          </tbody>
        </table>
      </div>
    `
      : '';


    logger.info(`${fileMethod} | ${customUuid} | HTML empresas relacionadas: ${empresas_relacionadad}`);


    strHTML_paso = strHTML_paso.replace('{_fecha_elaboracion_}', _fecha_elaboracion)


    // Agregar mensaje si el contador es 2
    const mensajeErrorRFC = (mensaje_bloc?.message?.length > 0) || (mensaje_konesh?.mensaje?.length > 0)
      ? `
        <div style="
         display: flex;
         flex-direction: column;
         justify-content: center;
         align-items: center;
         border: 4px solid #d32f2f;
         padding: 20px 25px;
         width: 850px;
         background: #ffebee;
         box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
         border-radius: 10px;
         ">
            <p style="color: #b71c1c; font-size: 12px; font-weight: bold; margin-top: 10px; text-align: center;">
              ⚠️ ${encabezado.razon_social} reportada en SAT con RFC invalido, no vigente, o lista OFAC, GAFI, etc.
            </p>
          </div>
        `
      : '';

    /* Aquí empiezan las validaciones para blok*/
    const concursos_Mercantiles = bloc_concursos_mercantiles.length > 0 ? `
          <div
            style="
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: flex-start;
              margin-bottom: 20px;
            "
          >
            <p
              style="
                color: #0a3d8e;
                margin: 0px;
                font-size: 12px;
                font-weight: 700;
              "
            >
              Concursos Mercantiles
            </p>
          </div>
          <div style="background-color: #f1f8ff; border-left: 5px solid #2ba2af; padding: 10px 20px; margin-bottom: 10px; width: 100%; margin-top: 1rem;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px;">
              <tbody>
                <tr style="background-color: #2ba2af; color: white; text-align: left;">
                  <th style="padding: 8px; border: 1px solid #ddd; width: 30%;">Campo 1</th> <!-- Campo 1 más pequeño -->
                  <th style="padding: 8px; border: 1px solid #ddd;">Campo 2</th> <!-- Campo 2 más grande -->
                </tr>
                {_merch_}
              </tbody>
            </table>
          </div>
        `
      :
      `<div>
        </div>`
      ;

    logger.info(`${fileMethod} | ${customUuid} | HTMLConcursos mercantiles: ${concursos_Mercantiles}`)

    const importadores_exportadores = bloc_importadores_exportadores.length > 0 ? `
        <div
          style="
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: flex-start;
            margin-bottom: 20px;
            margin-top: 2rem;
          "
        >
          <p
            style="
              color: #0a3d8e;
              margin: 0px;
              font-size: 12px;
              font-weight: 700;
            "
          >
            Importadores Exportadores 
          </p>
        </div>
        <div style="background-color: #f1f8ff; border-left: 5px solid #2ba2af; padding: 10px 20px; margin-bottom: 10px; width: 100%; margin-top: 1rem;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px;">
              <tbody>
                <tr style="background-color: #2ba2af; color: white; text-align: left;">
                  <th style="padding: 8px; border: 1px solid #ddd; width: 30%;">Campo 1</th>
                  <th style="padding: 8px; border: 1px solid #ddd; width: 80%;">Campo 2</th>
                </tr>
                  {_exp_}
              </tbody>
            </table>        
        </div>  
        `
      :
      `<div>
        </div>`
      ;

    logger.info(`${fileMethod} | ${customUuid} | HTML Importadores y Exportadores: ${importadores_exportadores}`)

    const mensaje_no_compartir = soloCompartirInfoEmpresa === 2
      ? `
        <div style="
         display: flex;
         flex-direction: column;
         justify-content: center;
         align-items: center;
         border: 4px solid #2ba2af;
         padding: 10px 15px;
         background: #f1f8ff;
         box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
         border-radius: 10px;
         ">
            <p style="color: #0a3d8e; font-size: 12px; font-weight: bold; margin-top: 10px; text-align: center;">
              ⚠️ Estimado cliente, le observamos que su comprador rechazo manera clara  no compartir información financiera.
            </p>
        </div>
      `
      : ``;

    const tabla_1 = soloCompartirInfoEmpresa != 2 ?
      `
        <div
            style="
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: flex-start;
              margin-bottom: 20px;
            "
          >
            <p
              style="
                color: #0a3d8e;
                margin: 0px;
                font-size: 12px;
                font-weight: 700;
              "
            >
              Estado de Balance
            </p>
          </div>
          <div
            style="
              background: #ffff;
              /* box-shadow: 2px 2px 10px rgba(0, 0, 0, 0.3); */
              padding: 12px 12px;
              border: 1px solid #787878;
            "
          >
            <div
              style="
                display: grid;
                grid-template-columns: 3fr 1.5fr 1.5fr;
                padding: 2.5px 0px;
                border-bottom: 1px solid #787878;
              "
            >
              <div style="display: flex; align-items: flex-start;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    color: #2ba2af;
                    font-size: 12px;
                    font-weight: 700;
                  "
                >
                  Indicador
                </p>
              </div>
              <div style="display: flex; align-items: flex-start;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    color: #2ba2af;
                    font-size: 12px;
                    font-weight: 700;
                  "
                >
                  {_performance_financiero_balance_anio_anterior_indicador_}
                </p>
              </div>
              <div style="display: flex; align-items: flex-start;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    color: #2ba2af;
                    font-size: 12px;
                    font-weight: 700;
                  "
                >
                {_performance_financiero_balance_anio_previo_anterior_indicador_}
                </p>
              </div>
            </div>
            <div>
              <div
                style="
                  display: grid;
                  grid-template-columns: 3fr 1.5fr 1.5fr;
                  border-bottom: 1px solid #787878;
                "
              >
                <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
                  <p
                    style="
                      margin: 0px;
                      margin-bottom: 5px;
                      color: #0a3d8e;
                      font-size: 12px;
                      font-weight: 700;
                    "
                  >
                    Caja y Bancos:
                  </p>
                </div>

                <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                  <p
                    style="
                      margin: 0px;
                      margin-bottom: 5px;
                      font-size: 12px;
                      font-weight: 500;
                    "
                  >
                  {_performance_financiero_balance_anio_anterior_caja_bancos_}
                  </p>
                </div>

                <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                  <p
                    style="
                      margin: 0px;
                      margin-bottom: 5px;
                      font-size: 12px;
                      font-weight: 500;
                    "
                  >
                  {_performance_financiero_balance_anio_previo_anterior_caja_bancos_}
                  </p>
                </div>
              </div>
              <div
                style="
                  display: grid;
                  grid-template-columns: 3fr 1.5fr 1.5fr;
                  border-bottom: 1px solid #787878;
                "
              >
                <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
                  <p
                    style="
                      margin: 0px;
                      margin-bottom: 5px;
                      color: #0a3d8e;
                      font-size: 12px;
                      font-weight: 700;
                    "
                  >
                  Saldo de Clientes:
                  </p>
                </div>

                <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                  <p
                    style="
                      margin: 0px;
                      margin-bottom: 5px;
                      font-size: 12px;
                      font-weight: 500;
                    "
                  >
                  {_performance_financiero_balance_anio_anterior_saldo_clientes_}
                  </p>
                </div>

                <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                  <p
                    style="
                      margin: 0px;
                      margin-bottom: 5px;
                      font-size: 12px;
                      font-weight: 500;
                    "
                  >
                  {_performance_financiero_balance_anio_previo_anterior_saldo_clientes_}
                  </p>
                </div>
              </div>
              <div
                style="
                  display: grid;
                  grid-template-columns: 3fr 1.5fr 1.5fr;
                  border-bottom: 1px solid #787878;
                "
              >
                <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
                  <p
                    style="
                      margin: 0px;
                      margin-bottom: 5px;
                      color: #0a3d8e;
                      font-size: 12px;
                      font-weight: 700;
                    "
                  >
                  Saldo de Inventarios:
                  </p>
                </div>

                <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                  <p
                    style="
                      margin: 0px;
                      margin-bottom: 5px;
                      font-size: 12px;
                      font-weight: 500;
                    "
                  >
                  {_performance_financiero_balance_anio_anterior_saldo_inventarios_}
                  </p>
                </div>

                <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                  <p
                    style="
                      margin: 0px;
                      margin-bottom: 5px;
                      font-size: 12px;
                      font-weight: 500;
                    "
                  >
                  {_performance_financiero_balance_anio_previo_anterior_saldo_inventarios_}
                  </p>
                </div>
              </div>
              <div
                style="
                  display: grid;
                  grid-template-columns: 3fr 1.5fr 1.5fr;
                  border-bottom: 1px solid #787878;
                "
              >
                <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
                  <p
                    style="
                      margin: 0px;
                      margin-bottom: 5px;
                      color: #0a3d8e;
                      font-size: 12px;
                      font-weight: 700;
                    "
                  >
                  Deuda Total: de Corto Plazo:
                  </p>
                </div>

                <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                  <p
                    style="
                      margin: 0px;
                      margin-bottom: 5px;
                      font-size: 12px;
                      font-weight: 500;
                    "
                  >
                  {_performance_financiero_balance_anio_anterior_deuda_corto_plazo_}
                  </p>
                </div>

                <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                  <p
                    style="
                      margin: 0px;
                      margin-bottom: 5px;
                      font-size: 12px;
                      font-weight: 500;
                    "
                  >
                  {_performance_financiero_balance_anio_previo_anterior_deuda_corto_plazo_}
                  </p>
                </div>
              </div>
              <div
                style="
                  display: grid;
                  grid-template-columns: 3fr 1.5fr 1.5fr;
                  border-bottom: 1px solid #787878;
                "
              >
                <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
                  <p
                    style="
                      margin: 0px;
                      margin-bottom: 5px;
                      color: #0a3d8e;
                      font-size: 12px;
                      font-weight: 700;
                    "
                  >
                  Deuda Total:
                  </p>
                </div>

                <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                  <p
                    style="
                      margin: 0px;
                      margin-bottom: 5px;
                      font-size: 12px;
                      font-weight: 500;
                    "
                  >
                  {_performance_financiero_balance_anio_anterior_deuda_total_}
                  </p>
                </div>

                <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                  <p
                    style="
                      margin: 0px;
                      margin-bottom: 5px;
                      font-size: 12px;
                      font-weight: 500;
                    "
                  >
                  {_performance_financiero_balance_anio_previo_anterior_deuda_total_}
                  </p>
                </div>
              </div>
              <div
                style="
                  display: grid;
                  grid-template-columns: 3fr 1.5fr 1.5fr;
                  border-bottom: 1px solid #787878;
                "
              >
                <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
                  <p
                    style="
                      margin: 0px;
                      margin-bottom: 5px;
                      color: #0a3d8e;
                      font-size: 12px;
                      font-weight: 700;
                    "
                  >
                  Capital Contable:
                  </p>
                </div>

                <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                  <p
                    style="
                      margin: 0px;
                      margin-bottom: 5px;
                      font-size: 12px;
                      font-weight: 500;
                    "
                  >
                  {_performance_financiero_balance_anio_anterior_capital_contable_}
                  </p>
                </div>

                <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                  <p
                    style="
                      margin: 0px;
                      margin-bottom: 5px;
                      font-size: 12px;
                      font-weight: 500;
                    "
                  >
                  {_performance_financiero_balance_anio_previo_anterior_capital_contable_}
                  </p>
                </div>
              </div>
            </div>
          </div>
      `
      : '';

    const tabla_2 = soloCompartirInfoEmpresa != 2 ?
      `
        <div
            style="
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: flex-start;
              margin-bottom: 20px;
            "
          >
            <p
              style="
                color: #0a3d8e;
                margin: 0px;
                font-size: 12px;
                font-weight: 700;
              "
            >
            Estado de Resultados
            </p>
          </div>
          <div
            style="
              background: #ffff;
              /* box-shadow: 2px 2px 10px rgba(0, 0, 0, 0.3); */
              padding: 12px 12px;
              border: 1px solid #787878;
            "
          >
            <div
              style="
                display: grid;
                grid-template-columns: 3fr 1.5fr 1.5fr;
                padding: 2.5px 0px;
                border-bottom: 1px solid #787878;
              "
            >
              <div style="display: flex; align-items: flex-start;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    color: #2ba2af;
                    font-size: 12px;
                    font-weight: 700;
                  "
                >
                  Indicador
                </p>
              </div>
              <div style="display: flex; align-items: flex-start;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    color: #2ba2af;
                    font-size: 12px;
                    font-weight: 700;
                  "
                >
                {_performance_financiero_estado_resultados_anio_anterior_indicador_}
                </p>
              </div>
              <div style="display: flex; align-items: flex-start;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    color: #2ba2af;
                    font-size: 12px;
                    font-weight: 700;
                  "
                >
                {_performance_financiero_estado_resultados_anio_previo_anterior_indicador_}
                </p>
              </div>
            </div>
            <div>
              <div
                style="
                  display: grid;
                  grid-template-columns: 3fr 1.5fr 1.5fr;
                  border-bottom: 1px solid #787878;
                "
              >
                <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
                  <p
                    style="
                      margin: 0px;
                      margin-bottom: 5px;
                      color: #0a3d8e;
                      font-size: 12px;
                      font-weight: 700;
                    "
                  >
                  Ventas anuales:
                  </p>
                </div>

                <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                  <p
                    style="
                      margin: 0px;
                      margin-bottom: 5px;
                      font-size: 12px;
                      font-weight: 500;
                    "
                  >
                  {_performance_financiero_estado_resultados_anio_anterior_ventas_anuales_}
                  </p>
                </div>

                <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                  <p
                    style="
                      margin: 0px;
                      margin-bottom: 5px;
                      font-size: 12px;
                      font-weight: 500;
                    "
                  >
                  {_performance_financiero_estado_resultados_anio_previo_anterior_ventas_anuales_}
                  </p>
                </div>
              </div>
              <div
                style="
                  display: grid;
                  grid-template-columns: 3fr 1.5fr 1.5fr;
                  border-bottom: 1px solid #787878;
                "
              >
                <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
                  <p
                    style="
                      margin: 0px;
                      margin-bottom: 5px;
                      color: #0a3d8e;
                      font-size: 12px;
                      font-weight: 700;
                    "
                  >
                  Costo de Ventas:
                  </p>
                </div>

                <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                  <p
                    style="
                      margin: 0px;
                      margin-bottom: 5px;
                      font-size: 12px;
                      font-weight: 500;
                    "
                  >
                  {_performance_financiero_estado_resultados_anio_anterior_costo_ventas_}
                  </p>
                </div>

                <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                  <p
                    style="
                      margin: 0px;
                      margin-bottom: 5px;
                      font-size: 12px;
                      font-weight: 500;
                    "
                  >
                  {_performance_financiero_estado_resultados_anio_previo_anterior_costo_ventas_}
                  </p>
                </div>
              </div>
              <div
                style="
                  display: grid;
                  grid-template-columns: 3fr 1.5fr 1.5fr;
                  border-bottom: 1px solid #787878;
                "
              >
                <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
                  <p
                    style="
                      margin: 0px;
                      margin-bottom: 5px;
                      color: #0a3d8e;
                      font-size: 12px;
                      font-weight: 700;
                    "
                  >
                  Utilidad Operativa:
                  </p>
                </div>

                <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                  <p
                    style="
                      margin: 0px;
                      margin-bottom: 5px;
                      font-size: 12px;
                      font-weight: 500;
                    "
                  >
                  {_performance_financiero_estado_resultados_anio_anterior_utilidad_operativa_}
                  </p>
                </div>

                <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                  <p
                    style="
                      margin: 0px;
                      margin-bottom: 5px;
                      font-size: 12px;
                      font-weight: 500;
                    "
                  >
                  {_performance_financiero_estado_resultados_anio_previo_anterior_utilidad_operativa_}
                  </p>
                </div>
              </div>
            </div>
          </div>
      `
      : '';

    const lista_69_incumplidos = bloc_lista_69_incumplidos.length > 0 ? `
        <div
          style="
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: flex-start;
            margin-bottom: 20px;
            margin-top: 2rem;
          "
        >
          <p
            style="
              color: #0a3d8e;
              margin: 0px;
              font-size: 12px;
              font-weight: 700;
            "
          >
          Lista 69 Incumplidos 
          </p>
        </div>
        <div style="background-color: #f1f8ff; border-left: 5px solid #2ba2af; padding: 10px 20px; margin-bottom: 10px; width: 100%; margin-top: 1rem;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px;">
              <tbody>
                <tr style="background-color: #2ba2af; color: white; text-align: left;">
                  <th style="padding: 8px; border: 1px solid #ddd; width: 30%;">Campo 1</th>
                  <th style="padding: 8px; border: 1px solid #ddd;">Campo 2</th>
                </tr>
                  {_lista_69_}
              </tbody>
            </table>        
        </div>  
        `
      :
      `<div>
        </div>`
      ;

    logger.info(`${fileMethod} | ${customUuid} | HTML Lista incumplidos: ${lista_69_incumplidos}`)

    const ofac = bloc_ofac.length > 0 ? `
        <div
          style="
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: flex-start;
            margin-bottom: 20px;
            margin-top: 2rem;
          "
        >
          <p
            style="
              color: #0a3d8e;
              margin: 0px;
              font-size: 12px;
              font-weight: 700;
            "
          >
          Lista Ofac 
          </p>
        </div>
        <div style="background-color: #f1f8ff; border-left: 5px solid #2ba2af; padding: 10px 20px; margin-bottom: 10px; width: 100%; margin-top: 1rem;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px;">
              <tbody>
                <tr style="background-color: #2ba2af; color: white; text-align: left;">
                  <th style="padding: 8px; border: 1px solid #ddd; width: 30%;">Campo 1</th>
                  <th style="padding: 8px; border: 1px solid #ddd;">Campo 2</th>
                </tr>
                  {_bloc_ofac_}
              </tbody>
            </table>        
        </div>  
        `
      :
      `<div>
        </div>`
      ;

    logger.info(`${fileMethod} | ${customUuid} | HTML ofac: ${ofac}`)

    const proveedoresContratistas = bloc_proveedores_contratistas.length > 0 ? `
        <div
          style="
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: flex-start;
            margin-bottom: 20px;
            margin-top: 2rem;
          "
        >
          <p
            style="
              color: #0a3d8e;
              margin: 0px;
              font-size: 12px;
              font-weight: 700;
            "
          >
          Proveedores Contratistas 
          </p>
        </div>
        <div style="background-color: #f1f8ff; border-left: 5px solid #2ba2af; padding: 10px 20px; margin-bottom: 10px; width: 100%; margin-top: 1rem;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px;">
              <tbody>
                <tr style="background-color: #2ba2af; color: white; text-align: left;">
                  <th style="padding: 8px; border: 1px solid #ddd; width: 30%;">Campo 1</th>
                  <th style="padding: 8px; border: 1px solid #ddd;">Campo 2</th>
                </tr>
                  {_proveedores_contratistas_}
              </tbody>
            </table>        
        </div>  
        `
      :
      `<div>
        </div>`
      ;

    logger.info(`${fileMethod} | ${customUuid} | HTML proveedores: ${proveedoresContratistas}`)

    const blocSat69b = bloc_sat69b.length > 0 ? `
        <div
          style="
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: flex-start;
            margin-bottom: 20px;
            margin-top: 2rem;
          "
        >
          <p
            style="
              color: #0a3d8e;
              margin: 0px;
              font-size: 12px;
              font-weight: 700;
            "
          >
          Sat 69b 
          </p>
        </div>
        <div style="background-color: #f1f8ff; border-left: 5px solid #2ba2af; padding: 10px 20px; margin-bottom: 10px; width: 100%; margin-top: 1rem;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px;">
              <tbody>
                <tr style="background-color: #2ba2af; color: white; text-align: left;">
                  <th style="padding: 8px; border: 1px solid #ddd; width: 30%;">Campo 1</th>
                  <th style="padding: 8px; border: 1px solid #ddd;">Campo 2</th>
                </tr>
                  {_bloc_sat69b_}
              </tbody>
            </table>        
        </div>  
        `
      :
      `<div>
        </div>`
      ;

    logger.info(`${fileMethod} | ${customUuid} | HTML 69b: ${blocSat69b}`)

    const m_o_p_c = mercado_objetivo_principales_clientes > 0 ? `
        <section style="width: 100%; margin-top: 40px;">
        <div
          style="
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: flex-start;
            margin-bottom: 20px;
          "
        >
          <p
            style="
              color: #0a3d8e;
              margin: 0px;
              font-size: 12px;
              font-weight: 700;
            "
          >
            Principales Clientes
          </p>
        </div>
        <div
          style="
            background: #ffff;
            /* box-shadow: 2px 2px 10px rgba(0, 0, 0, 0.3); */
            padding: 12px 12px;
            /* border: 1px solid #787878; */
          "
        >
          <div
            style="
              display: grid;
              grid-template-columns: 2fr 1.5fr 1.5fr 1.5fr;
              padding: 2.5px 0px;
              border-bottom: 1px solid #787878;
            "
          >
            <div style="display: flex; align-items: flex-start;">
              <p
                style="
                  margin: 0px;
                  margin-bottom: 5px;
                  color: #2ba2af;
                  font-size: 12px;
                  font-weight: 700;
                "
              >
                Nombre de Empresa
              </p>
            </div>
            <div style="display: flex; align-items: flex-start;">
              <p
                style="
                  margin: 0px;
                  margin-bottom: 5px;
                  color: #2ba2af;
                  font-size: 12px;
                  font-weight: 700;
                "
              >
                Años de Relación
              </p>            
            </div>  
            <div style="display: flex; align-items: flex-start;">
              <p
                style="
                  margin: 0px;
                  margin-bottom: 5px;
                  color: #2ba2af;
                  font-size: 12px;
                  font-weight: 700;
                "
              >
                País
              </p>            
            </div>  
            <div style="display: flex; align-items: flex-start;">
              <p
                style="
                  margin: 0px;
                  margin-bottom: 5px;
                  color: #2ba2af;
                  font-size: 12px;
                  font-weight: 700;
                "
              >
                Sector al que pertenece
              </p>            
            </div>     
          </div>

          

          {_mercado_objetivo_clientes_}

        </div>  
      </section>
      `
      : '';

    logger.info(`${fileMethod} | ${customUuid} | HTML m_o_p_c: ${m_o_p_c}`)

    /* Importaciones y Exportaciones */

    const referenciasValidas = Array.isArray(referencias_comerciales)
      ? referencias_comerciales.filter(ref =>
        ref && (
          ref.rfc ||
          ref.razon_social ||
          ref.calificacion_referencia ||
          ref.linea_credito ||
          ref.porcentaje_deuda ||
          ref.dias_atraso
        )
      )
      : [];


    const filasReferencias = referenciasValidas.map(ref => `
  <tr>
    <td style="padding: 8px; border: 1px solid #ddd;">${ref.rfc || '-'}</td>
    <td style="padding: 8px; border: 1px solid #ddd;">${ref.razon_social || '-'}</td>
    <td style="padding: 8px; border: 1px solid #ddd;">${ref.calificacion_referencia || '-'}</td>
    <td style="padding: 8px; border: 1px solid #ddd;">${ref.linea_credito || '-'}</td>
    <td style="padding: 8px; border: 1px solid #ddd;">${ref.porcentaje_deuda || '-'}</td>
    <td style="padding: 8px; border: 1px solid #ddd;">${ref.dias_atraso || '-'}</td>
  </tr>
`).join('');

    const filasReferenciasDetalladas = (datos_reporte?.referenciasComerciales || []).map(ref => `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${ref.rfc || '-'}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${ref.razon_social || '-'}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${ref.denominacion || '-'}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${ref.codigo_postal || '-'}</td>
      </tr>
    `).join('');

    const REFERENCIAS_C = referenciasValidas.length > 0
      ? `
    <section style="width: 100%; margin-top: 60px;">
      <div style="display: flex; flex-direction: column;">
        <h3 style="font-size: 16px; font-weight: 700; color: #0a3d8e; text-transform: uppercase; margin: 0 0 5px 0;">
          REFERENCIAS COMERCIALES
        </h3>
      </div>
      <div style="background-color: #f1f8ff; border-left: 5px solid #2ba2af; padding: 10px 20px; margin-bottom: 10px; width: 100%;">
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px;">
          <thead>
            <tr style="background-color: #2ba2af; color: white; text-align: left;">
              <th style="padding: 8px; border: 1px solid #ddd;">RFC</th>
              <th style="padding: 8px; border: 1px solid #ddd;">Razón Social</th>
              <th style="padding: 8px; border: 1px solid #ddd;">Calificación</th>
              <th style="padding: 8px; border: 1px solid #ddd;">Línea de Crédito</th>
              <th style="padding: 8px; border: 1px solid #ddd;">Porcentaje de Deuda</th>
              <th style="padding: 8px; border: 1px solid #ddd;">Días de Atraso</th>
            </tr>
          </thead>
          <tbody>
            ${filasReferencias}
          </tbody>
        </table>
      </div>
    </section>
  `
      : '';
    let REFERENCIAS_CONSIDERADAS = '';
    if (filasReferenciasDetalladas) {
      REFERENCIAS_CONSIDERADAS = `
    <section style="width: 100%; margin-top: 20px;">
      <div style="display: flex; flex-direction: column;">
        <h3 style="font-size: 16px; font-weight: 700; color: #0a3d8e; text-transform: uppercase; margin: 0 0 5px 0;">
          REFERENCIAS COMERCIALES RELACIONADAS
        </h3>
      </div>
      <div style="background-color: #f9f9f9; border-left: 5px solid #2ba2af; padding: 10px 20px; margin-bottom: 10px; width: 100%;">
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px;">
          <thead>
            <tr style="background-color: #2ba2af; color: white; text-align: left;">
              <th style="padding: 8px; border: 1px solid #ddd;">RFC</th>
              <th style="padding: 8px; border: 1px solid #ddd;">Razón Social</th>
              <th style="padding: 8px; border: 1px solid #ddd;">Denominación</th>
              <th style="padding: 8px; border: 1px solid #ddd;">Código Postal</th>
            </tr>
          </thead>
          <tbody>
            ${filasReferenciasDetalladas}
          </tbody>
        </table>
      </div>
    </section>
  `;
    }



    const imPortaciones = datos_reporte?.mercado_objetivo_importaciones?.length > 0 ? `
        <div
        style="
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: flex-start;
          margin-bottom: 20px;"
      >
        <p
          style="
            color: #0a3d8e;
            margin: 0px;
            font-size: 12px;
            font-weight: 700;"
        >
          Importaciones
        </p>
        </div>
        <div
        style="
          display: grid;
          grid-template-columns: 3fr 1.5fr 1.5fr;
          padding: 2.5px 0px;
          border-bottom: 1px solid #787878;"
      >
      <div style="display: flex; align-items: flex-start;">
        <p
          style="
            margin: 0px;
            margin-bottom: 5px;
            color: #2ba2af;
            font-size: 12px;
            font-weight: 700;"
        >
          País
        </p>
      </div>
      <div style="display: flex; align-items: flex-start;">
        <p
          style="
            margin: 0px;
            margin-bottom: 5px;
            color: #2ba2af;
            font-size: 12px;
            font-weight: 700;"
        >
          Porcentaje 
        </p>            
      </div>              
      </div>

      <!-- Aquí se deben mostrar los datos dinámicos -->
      {_mercado_objetivo_importaciones_} 
      `
      : '';

    logger.info(`${fileMethod} | ${customUuid} | HTML imPortaciones: ${imPortaciones}`)

    const exPortaciones = datos_reporte?.mercado_objetivo_exportaciones?.length > 0 ? `
        <div
        style="
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: flex-start;
          margin-bottom: 20px;
          margin-top: 1rem;"
      >
        <p
          style="
            color: #0a3d8e;
            margin: 0px;
            font-size: 12px;
            font-weight: 700;"
        >
          Exportaciones
        </p>
      </div>
      <div
        style="
          display: grid;
          grid-template-columns: 3fr 1.5fr 1.5fr;
          padding: 2.5px 0px;
          border-bottom: 1px solid #787878;"
      >
      <div style="display: flex; align-items: flex-start;">
        <p
          style="
            margin: 0px;
            margin-bottom: 5px;
            color: #2ba2af;
            font-size: 12px;
            font-weight: 700;"
        >
          País
        </p>
      </div>
      <div style="display: flex; align-items: flex-start;">
        <p
          style="
            margin: 0px;
            margin-bottom: 5px;
            color: #2ba2af;
            font-size: 12px;
            font-weight: 700;"
        >
          Porcentaje 
        </p>            
      </div>              
      </div>
      {_mercado_objetivo_exportaciones_}
      `
      : '';

    logger.info(`${fileMethod} | ${customUuid} | HTML exPortaciones: ${exPortaciones}`)

    const razonSoc = encabezado.razon_social?.length > 0 ? `
        <p
              style="
                font-size: 15px;
                font-weight: 700;
                text-transform: uppercase;
                margin: 0px !important;
                text-transform: uppercase;
              "
            >
              {_rfc_}
        </p>
      `
      : '';

    logger.info(`${fileMethod} | ${customUuid} | HTML razonSoc: ${razonSoc}`)

    const paisLimpio = limpiarCampo(encabezado.pais)
    logger.info(`${fileMethod} | ${customUuid} | paisLimpio: ${paisLimpio}`)
    const bloquePais = paisLimpio
      ? `
        <p
          style="
            font-size: 12px;
            font-weight: 500;
            margin: 0px !important;
            margin-bottom: 5px !important;
          "
        >
          ${_pais_}
        </p>
        `
      : '';

    const correoLimpio = limpiarCampo(encabezado.correo);
    correoLimpio ?
      `
        <p
              style="
                font-size: 12px;
                font-weight: 500;
                margin: 0px !important;
                margin-bottom: 5px !important;
              "
            >
              Correo: {_correo_}
            </p>
      `
      : '';

    const lineascreditoLimpio = limpiarCampo(resumen.linea_credito);
    lineascreditoLimpio ?
      `
        <p
                style="
                  font-size: 12px;
                  text-align: start;
                  font-weight: 500;
                  margin: 0px !important;
                "
              >
                {_resumen_linea_credito_}
        </p>
      `
      :
      '';



    // TODO -> comienzo - Resumen

    const resumenExperiencia = limpiarCampo(resumen?.experiencia);
    const plantillaLaboral = limpiarCampo(resumen?.plantilla_laboral);
    const actividadEconomica = limpiarCampo(resumen?.actividad_economica);
    const resumenSector = limpiarCampo(resumen?.sector);
    const actividadUGiro = limpiarCampo('Bancos, afianzadoras');
    const sectorClient = limpiarCampo(resumen?.sector_cliente_final);


    // Construir los bloques individualmente solo si tienen contenido
    let bloquesResumenHTML = '';

    if (resumenExperiencia) {
      bloquesResumenHTML += `
          <div style="flex: 1 1 25%; box-sizing: border-box; padding: 10px; border-right: 1px solid #ccc;">
            <div style="color: #1a2c5b; font-weight: bold; font-size: 12px; margin-bottom: 10px;">Experiencia</div>
            <p style="margin: 0; color: #555; font-size: 12px;">${resumenExperiencia}</p>
          </div>`;
    }

    if (plantillaLaboral) {
      bloquesResumenHTML += `
          <div style="flex: 1 1 25%; box-sizing: border-box; padding: 10px; border-right: 1px solid #ccc;">
            <div style="color: #1a2c5b; font-weight: bold; font-size: 12px; margin-bottom: 10px;">Plantilla Laboral</div>
            <p style="margin: 0; color: #555; font-size: 12px;">${plantillaLaboral}</p>
          </div>`;
    }

    if (actividadEconomica) {
      bloquesResumenHTML += `
          <div style="flex: 1 1 25%; box-sizing: border-box; padding: 10px; border-right: 1px solid #ccc;">
            <div style="color: #1a2c5b; font-weight: bold; font-size: 12px; margin-bottom: 10px;">Actividad Económica</div>
            <p style="margin: 0; color: #555; font-size: 12px;">${actividadEconomica}</p>
          </div>`;
    }

    if (resumenSector) {
      bloquesResumenHTML += `
          <div style="flex: 1 1 25%; box-sizing: border-box; padding: 10px;">
            <div style="color: #1a2c5b; font-weight: bold; font-size: 12px; margin-bottom: 10px;">Sector</div>
            <p style="margin: 0; color: #555; font-size: 12px;">${resumenSector}</p>
          </div>`;
    }

    const resumenContainer = bloquesResumenHTML
      ? `
      <div style="display: flex; flex-wrap: wrap; justify-content: flex-start; border-top: 3px solid #003366; border-bottom: 3px solid #003366; padding: 10px 0;">
        ${bloquesResumenHTML}
    </div>`
      : '';


    let bloquesGiroSectorHTML = '';

    if (actividadUGiro) {
      bloquesGiroSectorHTML += `
          <div style="flex: 1 1 50%; box-sizing: border-box; padding: 10px; border-right: 1px solid #ccc;">
            <div style="color: #1a2c5b; font-weight: bold; font-size: 12px; margin-bottom: 10px;">Actividad/Giro</div>
            <p style="margin: 0; color: #555; font-size: 12px;">${actividadUGiro}</p>
          </div>`;
    }

    if (sectorClient) {
      bloquesGiroSectorHTML += `
          <div style="flex: 1 1 50%; box-sizing: border-box; padding: 10px;">
            <div style="color: #1a2c5b; font-weight: bold; font-size: 12px; margin-bottom: 10px;">Sector Mayoritario de Clientes Finales</div>
            <p style="margin: 0; color: #555; font-size: 12px;">${sectorClient}</p>
          </div>`;
    }

    const giroSectorContainer = bloquesGiroSectorHTML
      ? `
    <div style="display: flex; flex-wrap: wrap; justify-content: flex-start; border-top: 3px solid #003366; padding-top: 10px; margin-top: 20px;">
      ${bloquesGiroSectorHTML}
    </div>`
      : '';
    /* fin - Resumen --> --> --> */

    let bloqueContactoHTML = '';

    const {
      pais,
      direccion_fiscal,
      telefono,
      correo,
      pagina_web
    } = encabezado;

    if (pais) {
      bloqueContactoHTML += `
        <p style="font-size: 12px; font-weight: 500; margin: 0px !important; margin-bottom: 5px !important;">
          ${pais}
        </p>`;
    }

    if (direccion_fiscal) {
      bloqueContactoHTML += `
        <p style="font-size: 12px; font-weight: 500; margin: 0px !important; margin-bottom: 15px !important;">
          ${direccion_fiscal}
        </p>`;
    }

    // Botón Google Maps siempre visible
    bloqueContactoHTML += `
      <button
        style="
          cursor: pointer !important;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin: 0px 0rem;
          margin-bottom: 10px;
          width: fit-content;
          padding: 8px 10px;
          border: 1px solid #2eafc3;
          background-color: transparent;
          font-size: 12px;
          border-radius: 5px;
        "
      >
        <span
          style="
            color: #2eafc3;
            font-size: 12px;
            font-weight: 500;
            text-align: center;
          "
        >
          Google Maps
        </span>
      </button>`;

    if (telefono) {
      bloqueContactoHTML += `
        <p style="font-size: 12px; font-weight: 500; margin: 0px !important; margin-top: 15px !important; margin-bottom: 5px !important;">
          ${telefono}
        </p>`;
    }

    if (correo) {
      bloqueContactoHTML += `
        <p style="font-size: 12px; font-weight: 500; margin: 0px !important; margin-bottom: 5px !important;">
          ${correo}
        </p>`;
    }

    if (pagina_web) {
      bloqueContactoHTML += `
        <p style="font-size: 12px; font-weight: 500; margin: 0px !important; margin-bottom: 5px !important;">
          ${pagina_web}
        </p>`;
    }

    const bloqueContactoSection = bloqueContactoHTML
      ? `
      <section style="
        margin-top: 10px;
        display: flex;
        flex-direction: column;
        padding: 10px 10px 20px 10px;
        border: 1px solid #787878;
      ">
        ${bloqueContactoHTML}
      </section>`
      : '';

    /* Aquí terminan */

    /* Información - Basica */
    const info = infoBasica?.result?.[0] ?? {};

    const tieneIdentidad = info.giro || info.valores || info.proposito;
    const tieneMisionVision = info.emp_desc || info.emp_mision || info.emp_vision;

    const empresas_info_basica =
      `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; line-height: 1.5; color: #333; max-width: 100%; margin: 30px 0;">
          <h4 style="text-transform: uppercase; background-color: #f1f8ff; padding: 8px 12px; border-left: 4px solid #2ba2af; margin-bottom: 20px; color: #2ba2af;">
            Información de Identidad Empresarial
          </h4>
  
          <div style="margin-bottom: 15px;">
            <span style="font-weight: 600; color: #0a3d8e;">Actividad / Giro:</span><br>
            <span style="margin: 0; color: #555; font-size: 12px;">${infoBasica?.result?.[0]?.giro || '-'}</span>
          </div>
  
          <div style="margin-bottom: 15px;">
            <span style="font-weight: 600; color: #0a3d8e;">Valores:</span><br>
            <span style="margin: 0; color: #555; font-size: 12px;">${infoBasica?.result?.[0]?.valores || '-'}</span>
          </div>
  
          <div style="margin-bottom: 15px;">
            <span style="font-weight: 600; color: #0a3d8e;">Propósito:</span><br>
            <span style="margin: 0; color: #555; font-size: 12px;">${infoBasica?.result?.[0]?.proposito || '-'}</span>
          </div>
  
          <h4 style="text-transform: uppercase; background-color: #f1f8ff; padding: 8px 12px; border-left: 4px solid #2ba2af; margin-top: 30px; margin-bottom: 20px; color: #2ba2af;">
            Misión, Visión y Descripción
          </h4>
  
          <div style="margin-bottom: 15px;">
            <span style="font-weight: 600; color: #0a3d8e;">Descripción:</span><br>
            <span style="margin: 0; color: #555; font-size: 12px;">${infoBasica?.result?.[0]?.emp_desc || '-'}</span>
          </div>
  
          <div style="margin-bottom: 15px;">
            <span style="font-weight: 600; color: #0a3d8e;">Misión:</span><br>
            <span style="margin: 0; color: #555; font-size: 12px;">${infoBasica?.result?.[0]?.emp_mision || '-'}</span>
          </div>
  
          <div style="margin-bottom: 15px;">
            <span style="font-weight: 600; color: #0a3d8e;">Visión:</span><br>
            <span style="margin: 0; color: #555; font-size: 12px;">${infoBasica?.result?.[0]?.emp_vision || '-'}</span>
          </div>
  
        </div>
      `
      ;
    /* Fin Información - Basica */

    /* Inicio ccionistas mayoritarios */
    const accionistasMayoritariosHTML = accionistas?.length > 0 ?
      `
        <div style="background: #fff; padding: 12px 12px; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; line-height: 1.5; color: #333; max-width: 100%; margin: 30px 0;">

          <h4 style="text-transform: uppercase; background-color: #f1f8ff; padding: 8px 12px; border-left: 4px solid #2ba2af; margin-bottom: 20px; color: #2ba2af;">
            Accionistas Mayoritarios
          </h4>

          <div style="display: grid; grid-template-columns: 3fr 1.5fr 1.5fr; padding: 2.5px 0px; border-bottom: 1px solid #787878; font-weight: 700; color: #2ba2af; font-size: 12px;">
            <div>Nombre</div>
            <div>Legal TAX ID</div>
          </div>

          ${accionistas.map(accionista => `
            <div style="display: grid; grid-template-columns: 3fr 1.5fr 1.5fr; padding: 2.5px 0px; border-bottom: 1px dashed #ccc;">
              <div style="font-size: 12px; color: #2ba2af;">${accionista.nombre || '-'}</div>
              <div style="font-size: 12px; color: #2ba2af;">${accionista.tax_id || '-'}</div>
            </div>
          `).join('')}
          
        </div>
      ` :
      `
      <div style="background: #fff; padding: 12px 12px; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; line-height: 1.5; color: #333; max-width: 100%; margin: 30px 0;">

      <h4 style="text-transform: uppercase; background-color: #f1f8ff; padding: 8px 12px; border-left: 4px solid #2ba2af; margin-bottom: 20px; color: #2ba2af;">
        Accionistas Mayoritarios
      </h4>

      <div style="display: grid; grid-template-columns: 3fr 1.5fr 1.5fr; padding: 2.5px 0px; border-bottom: 1px solid #787878; font-weight: 700; color: #2ba2af; font-size: 12px;">
        <div>Nombre</div>
        <div>Legal TAX ID</div>
      </div>

      ${(accionistas?.length > 0 ? accionistas : [{ nombre: '-', tax_id: '-' }])
        .map(accionista => `
          <div style="display: grid; grid-template-columns: 3fr 1.5fr 1.5fr; padding: 2.5px 0px; border-bottom: 1px dashed #ccc;">
            <div style="font-size: 12px; color: #2ba2af;">${accionista.nombre || '-'}</div>
            <div style="font-size: 12px; color: #2ba2af;">${accionista.tax_id || '-'}</div>
          </div>
        `).join('')
      }

    </div>
      `
      ;
    /* Fin Accionistas mayoritarios */

    /* Principales Directores */
    const directoresPrincipalesHTML = `
      <div style="background: #fff; padding: 12px 12px; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; line-height: 1.5; color: #333; max-width: 100%; margin: 30px 0;">

        <h4 style="text-transform: uppercase; background-color: #f1f8ff; padding: 8px 12px; border-left: 4px solid #2ba2af; margin-bottom: 20px; color: #2ba2af;">
          Principales Directores
        </h4>

        <div style="display: grid; grid-template-columns: 3fr 1.5fr 1.5fr; padding: 2.5px 0px; border-bottom: 1px solid #787878; font-weight: 700; color: #2ba2af; font-size: 12px;">
          <div>Nombre</div>
          <div>Puesto</div>
          <div>Poder</div>
        </div>

        ${(principales_directores?.length > 0 ? principales_directores : [{ nombre: '-', puesto: '-', poder: '-' }])
        .map(director => `
            <div style="display: grid; grid-template-columns: 3fr 1.5fr 1.5fr; padding: 2.5px 0px; border-bottom: 1px dashed #ccc;">
              <div style="font-size: 12px; color: #2ba2af;">${director?.nombre || '-'}</div>
              <div style="font-size: 12px; color: #2ba2af;">${director?.puesto || '-'}</div>
              <div style="font-size: 12px; color: #2ba2af;">${director?.poder || '-'}</div>
            </div>
          `).join('')
      } 
      </div>
    `;
    /* Fin principales directores */

    /* Inicio Personal */
    const tiene_personal = estructura_personal.operativo > 0 || estructura_personal.administrativo > 0 || estructura_personal.directivo > 0;

    let html_personal = "";

    if (tiene_personal) {
      html_personal = `
        <div style="background: #fff; padding: 12px 12px; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; line-height: 1.5; color: #333; max-width: 100%; margin: 30px 0;">
          <h4 style="text-transform: uppercase; background-color: #f1f8ff; padding: 8px 12px; border-left: 4px solid #2ba2af; margin-bottom: 20px; color: #2ba2af;">
            Recursos Humanos
          </h4>
          <div
            style="
              background: #ffff;
              padding: 12px 12px;
            "
          >
            <div
              style="
                display: grid;
                grid-template-columns: 3fr 1.5fr 1.5fr;
                padding: 2.5px 0px;
                border-bottom: 1px solid #787878;
              "
            >
              <div style="display: flex; align-items: flex-start;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    color: #2ba2af;
                    font-size: 12px;
                    font-weight: 700;
                  "
                >
                  Personal operativo
                </p>
              </div>
              <div style="display: flex; align-items: flex-start;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    color: #2ba2af;
                    font-size: 12px;
                    font-weight: 700;
                  "
                >
                  Personal Administrativo
                </p>            
              </div>
              <div style="display: flex; align-items: flex-start;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    color: #2ba2af;
                    font-size: 12px;
                    font-weight: 700;
                  "
                >
                  Personal directivo
                </p>            
              </div>
            </div>
    
            <div
              style="
                display: grid;
                grid-template-columns: 3fr 1.5fr 1.5fr;
                padding: 2.5px 0px;
                border-bottom: 1px solid #787878;
              "
            >
              <div style="display: flex; align-items: flex-start;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    color: #2ba2af;
                    font-size: 11px;
                    font-weight: 400;
                  "
                >
                  ${estructura_personal.operativo}
                </p>
              </div>
              <div style="display: flex; align-items: flex-start;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    color: #2ba2af;
                    font-size: 11px;
                    font-weight: 400;
                  "
                >
                  ${estructura_personal.administrativo}
                </p>
              </div>
              <div style="display: flex; align-items: flex-start;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    color: #2ba2af;
                    font-size: 11px;
                    font-weight: 400;
                  "
                >
                  ${estructura_personal.directivo}
                </p>
              </div>
            </div>
          </div>
        </div>
      `;
    }
    /* Fin Personal */

    /* Inicio Transporte */
    let html_transporte = `
            <div style="background: #fff; padding: 12px 12px; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; line-height: 1.5; color: #333; max-width: 100%; margin: 30px 0;">
              <h4 style="text-transform: uppercase; background-color: #f1f8ff; padding: 8px 12px; border-left: 4px solid #2ba2af; margin-bottom: 20px; color: #2ba2af;">
                Equipo de Transporte
              </h4>
              <div style="background: #ffff; padding: 12px 12px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; padding: 2.5px 0px; border-bottom: 1px solid #787878;">
                  <div style="display: flex; align-items: flex-start;">
                    <p style="margin: 0px; margin-bottom: 5px; color: #2ba2af; font-size: 12px; font-weight: 700;">
                      Flotilla carga especializada:
                    </p>
                  </div>
                  <div style="display: flex; align-items: flex-start;">
                    <p style="margin: 0px; margin-bottom: 5px; color: #2ba2af; font-size: 12px; font-weight: 700;">
                      Otros vehículos:
                    </p>
                  </div>
                </div>
        
                <div style="display: grid; grid-template-columns: 1fr 1fr; padding: 2.5px 0px; border-bottom: 1px solid #787878;">
                  <div style="display: flex; align-items: flex-start;">
                    <p style="margin: 0px; margin-bottom: 5px; color: #2ba2af; font-size: 11px; font-weight: 400;">
                      ${equipo_transporte.carga}
                    </p>
                  </div>
                  <div style="display: flex; align-items: flex-start;">
                    <p style="margin: 0px; margin-bottom: 5px; color: #2ba2af; font-size: 11px; font-weight: 400;">
                      ${equipo_transporte.otros}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          `;
    /* Fin trnasporte */

    /* Inicia Seguros */
    let html_seguros = '';

    const tiene_seguros = Array.isArray(seguros) && seguros.length > 0;

    const _seguros_ = tiene_seguros
      ? seguros.map(seguro => `
          <div
            style="display: grid; grid-template-columns: 3fr 1.5fr 1.5fr; padding: 2.5px 0px; border-bottom: 1px solid #e0e0e0;"
          >
            <div><p style="margin: 0 0 5px; color: #2ba2af; font-size: 11px;">${seguro.nombre_aseguradora || '-'}</p></div>
            <div><p style="margin: 0 0 5px; color: #2ba2af; font-size: 11px;">${seguro.bien_asegurado || '-'}</p></div>
            <div><p style="margin: 0 0 5px; color: #2ba2af; font-size: 11px;">${seguro.monto_asegurado != null ? `$${seguro.monto_asegurado.toLocaleString("es-MX")}` : '-'}</p></div>
          </div>
        `).join('')
      : `
          <div
            style="display: grid; grid-template-columns: 3fr 1.5fr 1.5fr; padding: 2.5px 0px; border-bottom: 1px solid #e0e0e0;"
          >
            <div><p style="margin: 0 0 5px; color: #2ba2af; font-size: 11px;">-</p></div>
            <div><p style="margin: 0 0 5px; color: #2ba2af; font-size: 11px;">-</p></div>
            <div><p style="margin: 0 0 5px; color: #2ba2af; font-size: 11px;">-</p></div>
          </div>
        `;

    html_seguros = `
      <div style="background: #fff; padding: 12px; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; line-height: 1.5; color: #333; max-width: 100%; margin: 30px 0;">
        <h4 style="text-transform: uppercase; background-color: #f1f8ff; padding: 8px 12px; border-left: 4px solid #2ba2af; margin-bottom: 20px; color: #2ba2af;">
          Seguros
        </h4>
          
        <div style="background: #fff; padding: 12px;">
          <div style="display: grid; grid-template-columns: 3fr 1.5fr 1.5fr; padding: 2.5px 0px; border-bottom: 1px solid #787878;">
            <div><p style="margin: 0 0 5px; color: #2ba2af; font-size: 12px; font-weight: 700;">Nombre de aseguradora</p></div>
            <div><p style="margin: 0 0 5px; color: #2ba2af; font-size: 12px; font-weight: 700;">Bien asegurado</p></div>
            <div><p style="margin: 0 0 5px; color: #2ba2af; font-size: 12px; font-weight: 700;">Monto asegurado</p></div>
          </div>
          ${_seguros_}
        </div>
      </div>
    `;

    /* Fin Seguros */

    const referenciasComerciales = (referencias_comerciales?.length > 0)
      ? `
        <div
                style="
                  width: 12px;
                  height: 12px;
                  border: 2px solid #c6c6c5;
                  padding: 0px;
                  background: #269e38;
                  border-radius: 50%;
                "
              ></div>
              <div style="display: flex; justify-content: flex-start;">
                <p
                  style="
                    font-size: 9px;
                    font-weight: 600;
                    color: #0a3d8e;
                    font-size: 12px;
                    text-align: start;
                    font-weight: 500;
                    margin: 0px !important;
                  "
                >
                  Referencias Comerciales
                </p>
              </div>
      ` :
      `
        <div
                style="
                  width: 12px;
                  height: 12px;
                  border: 2px solid #c6c6c5;
                  padding: 0px;
                  background: #dd1212;
                  border-radius: 50%;
                "
              ></div>
              <div style="display: flex; justify-content: flex-start;">
                <p
                  style="
                    font-size: 9px;
                    font-weight: 600;
                    color: #0a3d8e;
                    font-size: 12px;
                    text-align: start;
                    font-weight: 500;
                    margin: 0px !important;
                  "
                >
                  Referencias Comerciales
                </p>
              </div>
      `;

    const incidenciasMercantiles = (resumen?.datos_obtenidos?.indicencias_mercantiles != 1)
      ? `
        <div
                style="
                  width: 12px;
                  height: 12px;
                  border: 2px solid #c6c6c5;
                  padding: 0px;
                  background: #269e38;
                  border-radius: 50%;
                "
              ></div>
              <div style="display: flex; justify-content: flex-start;">
                <p
                  style="
                    font-size: 9px;
                    font-weight: 600;
                    color: #0a3d8e;
                    font-size: 12px;
                    text-align: start;
                    font-weight: 500;
                    margin: 0px !important;
                  "
                >
                  Incidencias Mercantiles o Penales
                </p>
              </div>
            </div>
      ` :
      `
        <div
                style="
                  width: 12px;
                  height: 12px;
                  border: 2px solid #c6c6c5;
                  padding: 0px;
                  background: #dd1212;
                  border-radius: 50%;
                "
              ></div>
              <div style="display: flex; justify-content: flex-start;">
                <p
                  style="
                    font-size: 9px;
                    font-weight: 600;
                    color: #0a3d8e;
                    font-size: 12px;
                    text-align: start;
                    font-weight: 500;
                    margin: 0px !important;
                  "
                >
                  Incidencias Mercantiles o Penales
                </p>
              </div>
            </div>
      `;

    const contribuyenteIncumplido = (resumen?.datos_obtenidos?.contribuyente_incumplido == 1)
      ? `
        <div
                style="
                  width: 12px;
                  height: 12px;
                  border: 2px solid #c6c6c5;
                  padding: 0px;
                  background: #269e38;
                  border-radius: 50%;
                "
              ></div>
              <div style="display: flex; justify-content: flex-start;">
                <p
                  style="
                    font-size: 9px;
                    font-weight: 600;
                    color: #0a3d8e;
                    font-size: 12px;
                    text-align: start;
                    font-weight: 500;
                    margin: 0px !important;
                  "
                >
                  Contribuyente Incumplido
                </p>
              </div>
            </div>
      ` :
      `
        <div
                style="
                  width: 12px;
                  height: 12px;
                  border: 2px solid #c6c6c5;
                  padding: 0px;
                  background: #dd1212;
                  border-radius: 50%;
                "
              ></div>
              <div style="display: flex; justify-content: flex-start;">
                <p
                  style="
                    font-size: 9px;
                    font-weight: 600;
                    color: #0a3d8e;
                    font-size: 12px;
                    text-align: start;
                    font-weight: 500;
                    margin: 0px !important;
                  "
                >
                  Contribuyente Incumplido
                </p>
              </div>
            </div>
      `;

    /* Empresas Relacionadas */
    /* Fin Empresas Relacionadas */

    // Nuevos Ratios
    const nuevosRatios = {
      capital_trabajo_anterior: ratios_financiero?.formula_1_capital_trabajo_anterior ?? 0,
      capital_trabajo_previo_anterior: ratios_financiero?.formula_1_capital_trabajo_previo_anterior ?? 0,
      capital_trabajo_anterior_2: ratios_financiero?.formula_2_capital_trabajo_anterior ?? 0,
      capital_trabajo_previo_anterior_2: ratios_financiero?.formula_2_capital_trabajo_previo_anterior ?? 0,

      prueba_acida_anterior: ratios_financiero?.prueba_acida_anterior ?? 0,
      prueba_acida_previo_anterior: ratios_financiero?.prueba_acida_previo_anterior ?? 0,

      grado_general_endeudamiento_anterior: ratios_financiero?.grado_general_endeudamiento_anterior ?? 0,
      grado_general_endeudamiento_previo_anterior: ratios_financiero?.grado_general_endeudamiento_previo_anterior ?? 0,

      apalancamiento_anterior: ratios_financiero?.apalancamiento_anterior ?? 0,
      apalancamiento_previo_anterior: ratios_financiero?.apalancamiento_previo_anterior ?? 0,

      formula_1_inventarios_rotacion_anterior: ratios_financiero?.formula_1_inventarios_rotacion_anterior ?? 0,
      formula_1_inventarios_rotacion_previo_anterior: ratios_financiero?.formula_1_inventarios_rotacion_previo_anterior ?? 0,
      formula_1_inventarios_rotacion_anterior_2: ratios_financiero?.formula_2_inventarios_rotacion_anterior ?? 0,
      formula_1_inventarios_rotacion_previo_anterior_2: ratios_financiero?.formula_2_inventarios_rotacion_previo_anterior ?? 0,

      rotacion_ctas_x_cobrar_anterior: ratios_financiero?.rotacion_ctas_x_cobrar_anterior ?? 0,
      rotacion_ctas_x_cobrar_previo_anterior: ratios_financiero?.rotacion_ctas_x_cobrar_previo_anterior ?? 0,

      rotacion_pagos_anterior: ratios_financiero?.rotacion_pagos_anterior ?? 0,
      rotacion_pagos_previo_anterior: ratios_financiero?.rotacion_pagos_previo_anterior ?? 0,

      solvencia_anterior: ratios_financiero?.solvencia_anterior ?? 0,
      solvencia_previo_anterior: ratios_financiero?.solvencia_previo_anterior ?? 0,

      retorno_capital_acciones_anterior: ratios_financiero?.retorno_capital_acciones_anterior ?? 0,
      retorno_capital_acciones_previo_anterior: ratios_financiero?.retorno_capital_acciones_previo_anterior ?? 0,

      rendimiento_capital_anterior: ratios_financiero?.rendimiento_capital_anterior ?? 0,
      rendimiento_capital_previo_anterior: ratios_financiero?.rendimiento_capital_previo_anterior ?? 0,

      rendimiento_activos_anterior: ratios_financiero?.rendimiento_activos_anterior ?? 0,
      rendimiento_activos_previo_anterior: ratios_financiero?.rendimiento_activos_previo_anterior ?? 0
    }

    strHTML_paso = strHTML_paso.replace('{_emp_id_}', emp_id ? emp_id : '-');
    strHTML_paso = strHTML_paso.replace('{_giro_}', giro ? giro : '-');
    strHTML_paso = strHTML_paso.replace('{_valores_}', valores ? valores : '-');
    strHTML_paso = strHTML_paso.replace('{_proposito_}', proposito ? proposito : '-');
    strHTML_paso = strHTML_paso.replace('{_emp_desc_}', emp_desc ? emp_desc : '-');
    strHTML_paso = strHTML_paso.replace('{_emp_mision_}', emp_mision ? emp_mision : '-');
    strHTML_paso = strHTML_paso.replace('{_emp_vision_}', emp_vision ? emp_vision : '-');

    strHTML_paso = strHTML_paso.replace('{_empresas_info_basica_}', empresas_info_basica || ' ');

    strHTML_paso = strHTML_paso.replace('{_nomnbre_r_}', encabezado.razon_social ? encabezado.razon_social : '-');
    strHTML_paso = strHTML_paso.replace('{_mensaje_contador_}', mensajeErrorRFC || '');

    // Variables para mostrar block
    strHTML_paso = strHTML_paso.replace('{_concursos_mercantiles_}', concursos_Mercantiles || '-');
    strHTML_paso = strHTML_paso.replace('{_importadores_exportadores_}', importadores_exportadores || '-');
    strHTML_paso = strHTML_paso.replace('{_lista_69_incumplidos_}', lista_69_incumplidos || '-');
    strHTML_paso = strHTML_paso.replace('{_ofac_}', ofac || '-');
    strHTML_paso = strHTML_paso.replace('{_proveedoresContratistas_}', proveedoresContratistas || '-');
    strHTML_paso = strHTML_paso.replace('{_blocSat69b_}', blocSat69b || '-');

    strHTML_paso = strHTML_paso.replace('{_mercado_obgetivo_}', m_o_p_c || '');
    strHTML_paso = strHTML_paso.replace('{_REFERENCIAS_COMERCIALES_}', REFERENCIAS_C || '');

    strHTML_paso = strHTML_paso.replace('{_noCompartir_}', mensaje_no_compartir)
    strHTML_paso = strHTML_paso.replace('{_tabla_1_}', tabla_1)
    strHTML_paso = strHTML_paso.replace('{_tabla_2_}', tabla_2)

    strHTML_paso = strHTML_paso.replace('{_ActividadGiro_}', actividad_economica[0]?.industria_nombre || '-')


    strHTML_paso = strHTML_paso.replace('{_valores_}', infoEmpresa.result[0]?.valores || '-');
    strHTML_paso = strHTML_paso.replace('{_imPortaciones_}', imPortaciones);
    strHTML_paso = strHTML_paso.replace('{_exPortaciones_}', exPortaciones);
    // Encabezado
    function limpiarCampo(valor) {
      return valor && valor.trim() !== '' && valor !== '-' ? valor : '';
    }

    strHTML_paso = strHTML_paso.replace('{_razon_social_}', encabezado.razon_social || '-');
    strHTML_paso = strHTML_paso.replace('{_rfc_}', encabezado.rfc || '-');
    strHTML_paso = strHTML_paso.replace('{_pais_}', bloquePais || '-');
    strHTML_paso = strHTML_paso.replace('{_direccion_fiscal_}', encabezado.direccion_fiscal || '-');
    strHTML_paso = strHTML_paso.replace('{_telefono_}', encabezado.telefono || '-');
    strHTML_paso = strHTML_paso.replace('{_correo_}', correoLimpio || '-');
    strHTML_paso = strHTML_paso.replace('{_pagina_web_}', encabezado.pagina_web || '-');

    logger.info(`${fileMethod} | ${customUuid} | Encabezado con HTML: ${JSON.stringify(strHTML_paso)}`);

    function escapeHTML(str) {
      if (str == null) return ''
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    // Resumen
    strHTML_paso = strHTML_paso.replace('{_resumen_experiencia_}', escapeHTML(resumen.experiencia) || '-');
    strHTML_paso = strHTML_paso.replace('{_resumen_plantilla_laboral_}', resumen.plantilla_laboral || '-');
    strHTML_paso = strHTML_paso.replace('{_resumen_actividad_economica_}', resumen.actividad_economica || '-');
    strHTML_paso = strHTML_paso.replace('{_resumen_sector_}', resumen.sector || '-');
    strHTML_paso = strHTML_paso.replace('{_resumen_sector_cliente_final_}', resumen.sector_cliente_final || '-');
    strHTML_paso = strHTML_paso.replace('{_resumen_empresa_controlante_rfc_}', resumen.empresa_controlante_rfc || '-');
    strHTML_paso = strHTML_paso.replace('{_resumen_empresa_controlante_razon_social_}', resumen.empresa_controlante_razon_social || '-');
    strHTML_paso = strHTML_paso.replace('{_resumen_capital_contable_}', resumen.capital_contable || '-');
    strHTML_paso = strHTML_paso.replace('{_resumen_ventas_anuales_}', resumen.ventas_anuales || '-');
    strHTML_paso = strHTML_paso.replace('{_resumen_empresas_relacionadas_}', resumen.empresas_relacionadas_);
    strHTML_paso = strHTML_paso.replace('{_resumen_caja_bancos_}', resumen.caja_bancos || '-');
    strHTML_paso = strHTML_paso.replace('{_resumen_linea_credito_}', lineascreditoLimpio || '-');

    strHTML_paso = strHTML_paso.replace('{_resumen_plazo_pago_}', resumen.plazo_pago || '-');
    strHTML_paso = strHTML_paso.replace('{_resumen_ventas_gobierno_}', resumen.ventas_gobierno || '-');
    strHTML_paso = strHTML_paso.replace('{_resumen_fecha_actualizacion_69_69B_}', resumen.fecha_actualizacion_69_69B || '-')

    logger.info(`${fileMethod} | ${customUuid} | Resumen con HTML: ${JSON.stringify(strHTML_paso)}`);

    strHTML_paso = strHTML_paso.replace('{_bloque_resumen_info_1_}', resumenContainer);
    logger.info(`${fileMethod} | ${customUuid} | Resumen con HTML: ${JSON.stringify(resumenContainer)}`);
    strHTML_paso = strHTML_paso.replace('{_bloque_resumen_info_2_}', giroSectorContainer);
    logger.info(`${fileMethod} | ${customUuid} | Resumen con HTML: ${JSON.stringify(giroSectorContainer)}`);

    strHTML_paso = strHTML_paso.replace('{_bloque_contacto_}', bloqueContactoSection || '');
    logger.info(`${fileMethod} | ${customUuid} | Resumen con HTML: ${JSON.stringify(giroSectorContainer)}`);

    strHTML_paso = strHTML_paso.replace('{_resultados_linea_credito_solicitada_}', resultados.linea_credito_solicitada);
    /* // Seteamos resultados // TODO preguntar si esta parte se utiliza 
    strHTML_paso = strHTML_paso.replace('{_resultados_riesgo_}', resultados.riesgo);
    strHTML_paso = strHTML_paso.replace('{_resultados_riesgo_descripcion_}', resultados.riesgo_descripcion);
    strHTML_paso = strHTML_paso.replace('{_resultados_linea_credito_recomendada_}', resultados.linea_credito_recomendada);

    strHTML_paso = strHTML_paso.replace('{_resultados_porcentaje_endeudamiento_comercial_}', resultados.porcentaje_endeudamiento_comercial);
    strHTML_paso = strHTML_paso.replace('{_resultados_porcentaje_endeudamiento_comercial_descripcion_}', resultados.porcentaje_endeudamiento_comercial_descripcion);

    strHTML_paso = strHTML_paso.replace('{_resultados_dias_recomendacion_DSO_}', resultados.dias_recomendacion_DSO);
    strHTML_paso = strHTML_paso.replace('{_resultados_dias_recomendacion_DSO_descripcion_}', resultados.dias_recomendacion_DSO_descripcion);
    logger.info(`${fileMethod} | ${customUuid} | Resultados HTML: ${JSON.stringify(strHTML_paso)}`) */


    // Balance
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_anterior_indicador_}', performance_financiero.balance_anio_anterior_indicador);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_anterior_caja_bancos_}', performance_financiero.balance_anio_anterior_caja_bancos);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_anterior_saldo_clientes_}', performance_financiero.balance_anio_anterior_saldo_clientes);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_anterior_saldo_inventarios_}', performance_financiero.balance_anio_anterior_saldo_inventarios);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_anterior_deuda_corto_plazo_}', performance_financiero.balance_anio_anterior_deuda_corto_plazo);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_anterior_deuda_total_}', performance_financiero.balance_anio_anterior_deuda_total);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_anterior_capital_contable_}', performance_financiero.balance_anio_anterior_capital_contable);

    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_previo_anterior_indicador_}', performance_financiero.balance_anio_previo_anterior_indicador);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_previo_anterior_caja_bancos_}', performance_financiero.balance_anio_previo_anterior_caja_bancos);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_previo_anterior_saldo_clientes_}', performance_financiero.balance_anio_previo_anterior_saldo_clientes);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_previo_anterior_saldo_inventarios_}', performance_financiero.balance_anio_previo_anterior_saldo_inventarios);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_previo_anterior_deuda_corto_plazo_}', performance_financiero.balance_anio_previo_anterior_deuda_corto_plazo);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_previo_anterior_deuda_total_}', performance_financiero.balance_anio_previo_anterior_deuda_total);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_previo_anterior_capital_contable_}', performance_financiero.balance_anio_previo_anterior_capital_contable);
    logger.info(`${fileMethod} | ${customUuid} | Estado de balance HTML: ${JSON.stringify(strHTML_paso)}`)

    // Estado de Resultados
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_estado_resultados_anio_anterior_indicador_}', performance_financiero.estado_resultados_anio_anterior_indicador);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_estado_resultados_anio_anterior_ventas_anuales_}', performance_financiero.estado_resultados_anio_anterior_ventas_anuales);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_estado_resultados_anio_anterior_costo_ventas_}', performance_financiero.estado_resultados_anio_anterior_costo_ventas);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_estado_resultados_anio_anterior_utilidad_operativa_}', performance_financiero.estado_resultados_anio_anterior_utilidad_operativa);

    strHTML_paso = strHTML_paso.replace('{_performance_financiero_estado_resultados_anio_previo_anterior_indicador_}', performance_financiero.estado_resultados_anio_previo_anterior_indicador);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_estado_resultados_anio_previo_anterior_ventas_anuales_}', performance_financiero.estado_resultados_anio_previo_anterior_ventas_anuales);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_estado_resultados_anio_previo_anterior_costo_ventas_}', performance_financiero.estado_resultados_anio_previo_anterior_costo_ventas);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_estado_resultados_anio_previo_anterior_utilidad_operativa_}', performance_financiero.estado_resultados_anio_previo_anterior_utilidad_operativa);
    logger.info(`${fileMethod} | ${customUuid} | Estado de resultados HTML: ${JSON.stringify(strHTML_paso)}`)

    /* Tablas condicionadas */
    strHTML_paso = strHTML_paso.replace('{_merch_}', mercantiles);
    strHTML_paso = strHTML_paso.replace('{_exp_}', import_export);
    strHTML_paso = strHTML_paso.replace('{_lista_69_}', lista_69);
    strHTML_paso = strHTML_paso.replace('{_bloc_ofac_}', blocOfac);
    strHTML_paso = strHTML_paso.replace('{_proveedores_contratistas_}', proveedores_contratistas);
    strHTML_paso = strHTML_paso.replace('{_bloc_sat69b_}', sat69b);

    strHTML_paso = strHTML_paso.replace('{_periodo_anterior_}', periodo_anterior)
    strHTML_paso = strHTML_paso.replace('{_periodo_previo_anterior_}', periodo_previo_anterior)

    // Ratios 
    strHTML_paso = strHTML_paso.replace('{_capital_trabajo_anterior_}', nuevosRatios.capital_trabajo_anterior);
    strHTML_paso = strHTML_paso.replace('{_capital_trabajo_previo_anterior_}', nuevosRatios.capital_trabajo_previo_anterior);

    strHTML_paso = strHTML_paso.replace('{_capital_trabajo_anterior2_}', nuevosRatios.capital_trabajo_anterior_2);
    strHTML_paso = strHTML_paso.replace('{_capital_trabajo_previo_anterior2_}', nuevosRatios.capital_trabajo_previo_anterior_2);

    strHTML_paso = strHTML_paso.replace('{_prueba_acida_anterior_}', nuevosRatios.prueba_acida_anterior);
    strHTML_paso = strHTML_paso.replace('{_prueba_acida_previo_anterior_}', nuevosRatios.prueba_acida_previo_anterior);

    // Seteamos Ratio Financiero
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_ratio_financiero_indicador_}', ratio_financiero.ratio_financiero_indicador);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_ratio_financiero_ventas_anuales_}', ratio_financiero.ratio_financiero_ventas_anuales);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_ratio_financiero_evolucion_Ventas_}', ratio_financiero.ratio_financiero_evolucion_Ventas);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_ratio_financiero_payback_}', ratio_financiero.ratio_financiero_payback);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_ratio_financiero_apalancamiento_}', ratio_financiero.ratio_financiero_apalancamiento);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_ratio_financiero_DSO_}', ratio_financiero.ratio_financiero_DSO);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_ratio_financiero_DIO_}', ratio_financiero.ratio_financiero_DIO);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_ratio_financiero_flujo_caja_}', ratio_financiero.ratio_financiero_flujo_caja);
    logger.info(`${fileMethod} | ${customUuid} | Ratio financiero HTML: ${JSON.stringify(strHTML_paso)}`)

    strHTML_paso = strHTML_paso.replace('{_credito_total_}', mercado_objetivo_estructura_ventas.credito_total);
    strHTML_paso = strHTML_paso.replace('{_contado_total_}', mercado_objetivo_estructura_ventas.contado_total);
    strHTML_paso = strHTML_paso.replace('{_ventas_gobierno_}', mercado_objetivo_estructura_ventas.ventas_gobierno);
    logger.info(`${fileMethod} | ${customUuid} | Estructura de Ventas HTML: ${JSON.stringify(strHTML_paso)}`)

    // Reemplazar el marcador con las razones sociales
    strHTML_paso = strHTML_paso.replace('{_item_}', razonesSociales);
    logger.info(`${fileMethod} | ${customUuid} | Referencias Comereciales - prueba HTML: ${JSON.stringify(strHTML_paso)}`)

    strHTML_paso = strHTML_paso.replace('{_empresas_relacionadad_}', empresas_relacionadad)


    //strHTML_paso = strHTML_paso.replace ('{_items_}', empresasRelaciones);
    //logger.info(`${fileMethod} | ${customUuid} | Referencias Comereciales - prueba HTML: ${JSON.stringify(strHTML_paso)}`)

    strHTML_paso = strHTML_paso.replace('{_grado_general_endeudamiento_anterior_}', nuevosRatios.grado_general_endeudamiento_anterior);
    strHTML_paso = strHTML_paso.replace('{_grado_general_endeudamiento_previo_anterior_}', nuevosRatios.grado_general_endeudamiento_previo_anterior);

    strHTML_paso = strHTML_paso.replace('{_apalancamiento_anterior_}', nuevosRatios.apalancamiento_anterior);
    strHTML_paso = strHTML_paso.replace('{_apalancamiento_previo_anterior_}', nuevosRatios.apalancamiento_previo_anterior);

    strHTML_paso = strHTML_paso.replace('{_formula_1_inventarios_rotacion_anterior_}', nuevosRatios.formula_1_inventarios_rotacion_anterior);
    strHTML_paso = strHTML_paso.replace('{_formula_1_inventarios_rotacion_previo_anterior_}', nuevosRatios.formula_1_inventarios_rotacion_previo_anterior);

    strHTML_paso = strHTML_paso.replace('{_formula_1_inventarios_rotacion_anterior2_}', nuevosRatios.formula_1_inventarios_rotacion_anterior_2);
    strHTML_paso = strHTML_paso.replace('{_formula_1_inventarios_rotacion_previo_anterior2_}', nuevosRatios.formula_1_inventarios_rotacion_previo_anterior_2);

    strHTML_paso = strHTML_paso.replace('{_rotacion_ctas_x_cobrar_anterior_}', nuevosRatios.rotacion_ctas_x_cobrar_anterior);
    strHTML_paso = strHTML_paso.replace('{_rotacion_ctas_x_cobrar_previo_anterior_}', nuevosRatios.rotacion_ctas_x_cobrar_previo_anterior);

    strHTML_paso = strHTML_paso.replace('{_rotacion_pagos_anterior_}', nuevosRatios.rotacion_pagos_anterior);
    strHTML_paso = strHTML_paso.replace('{_rotacion_pagos_previo_anterior_}', nuevosRatios.rotacion_pagos_previo_anterior);

    strHTML_paso = strHTML_paso.replace('{_solvencia_anterior_}', nuevosRatios.solvencia_anterior);
    strHTML_paso = strHTML_paso.replace('{_solvencia_previo_anterior_}', nuevosRatios.solvencia_previo_anterior);

    strHTML_paso = strHTML_paso.replace('{_retorno_capital_acciones_anterior_}', nuevosRatios.retorno_capital_acciones_anterior);
    strHTML_paso = strHTML_paso.replace('{_retorno_capital_acciones_previo_anterior_}', nuevosRatios.retorno_capital_acciones_previo_anterior);

    strHTML_paso = strHTML_paso.replace('{_rendimiento_capital_anterior_}', nuevosRatios.rendimiento_capital_anterior);
    strHTML_paso = strHTML_paso.replace('{_rendimiento_capital_previo_anterior_}', nuevosRatios.rendimiento_capital_previo_anterior);

    strHTML_paso = strHTML_paso.replace('{_rendimiento_activos_anterior_}', nuevosRatios.rendimiento_activos_anterior);
    strHTML_paso = strHTML_paso.replace('{_rendimiento_activos_previo_anterior_}', nuevosRatios.rendimiento_activos_previo_anterior);
    logger.info(`${fileMethod} | ${customUuid} | Nuevos Ratios HTML: ${JSON.stringify(strHTML_paso)}`)

    // Seteamos Accionistas
    strHTML_paso = strHTML_paso.replace('{_accionistas_}', accionistasMayoritariosHTML);

    strHTML_paso = strHTML_paso.replace('{_directores_}', directoresPrincipalesHTML);

    strHTML_paso = strHTML_paso.replace('{_personal_}', html_personal);
    logger.info(`${fileMethod} | ${customUuid} | Personal HTML: ${JSON.stringify(strHTML_paso)}`)

    strHTML_paso = strHTML_paso.replace('{_transporte_}', html_transporte);
    logger.info(`${fileMethod} | ${customUuid} | Personal HTML: ${JSON.stringify(html_transporte)}`)

    logger.info(`${fileMethod} | ${customUuid} | Equipo de transporte HTML: ${JSON.stringify(strHTML_paso)}`)

    strHTML_paso = strHTML_paso.replace('{_seguros_}', html_seguros);
    logger.info(`${fileMethod} | ${customUuid} | Seguros HTML: ${JSON.stringify(strHTML_paso)}`)

    strHTML_paso = strHTML_paso.replace('{_referenciasComerciales_}', referenciasComerciales);
    strHTML_paso = strHTML_paso.replace('{_incidenciasMercantiles_}', incidenciasMercantiles);
    strHTML_paso = strHTML_paso.replace('{_contribuyenteIncumplido_}', contribuyenteIncumplido);
    // Mercado Objetivo
    // {_mercado_objetivo_ventas_}

    strHTML_paso = strHTML_paso.replace('{_mercado_objetivo_clientes_}', mercado_objetivo_principales_clientes?.map(
      (cliente) => (`          
    <div
      style="
        display: grid;
        grid-template-columns: 2fr 1.5fr 1.5fr 1.5fr;
        padding: 2.5px 0px;
        border-bottom: 1px solid #787878;
      "
    >
      <div style="display: flex; align-items: flex-start;">
        <p
          style="
            margin: 0px;
            margin-bottom: 5px;
            color: #2ba2af;
            font-size: 11px;
            font-weight: 400;
          "
        >
          ${cliente.nombre_empresa}
        </p>
      </div>
      <div style="display: flex; align-items: flex-start;">
        <p
          style="
            margin: 0px;
            margin-bottom: 5px;
            color: #2ba2af;
            font-size: 11px;
            font-weight: 400;
          "
        >
          ${cliente.anios_relacion}
        </p>            
      </div> 
      <div style="display: flex; align-items: flex-start;">
        <p
          style="
            margin: 0px;
            margin-bottom: 5px;
            color: #2ba2af;
            font-size: 11px;
            font-weight: 400;
          "
        >
          ${cliente.pais}
        </p>            
      </div>     
      <div style="display: flex; align-items: flex-start;">
        <p
          style="
            margin: 0px;
            margin-bottom: 5px;
            color: #2ba2af;
            font-size: 11px;
            font-weight: 400;
          "
        >
          ${cliente.sector}
        </p>            
      </div> 
    </div>        
  ` )
    ).join(''))
    logger.info(`${fileMethod} | ${customUuid} | Mercado Objetivo clientes HTML: ${JSON.stringify(strHTML_paso)}`)

    strHTML_paso = strHTML_paso.replace('{_mercado_objetivo_ventas_}', `          
  <div
    style="
      display: grid;
      grid-template-columns: 3fr 1.5fr 1.5fr;
      padding: 2.5px 0px;
      border-bottom: 1px solid #787878;
    "
  >
    <div style="display: flex; align-items: flex-start;">
      <p
        style="
          margin: 0px;
          margin-bottom: 5px;
          color: #2ba2af;
          font-size: 11px;
          font-weight: 400;
        "
      >
        ${mercado_objetivo_estructura_ventas.credito_total}
      </p>
    </div>
    <div style="display: flex; align-items: flex-start;">
      <p
        style="
          margin: 0px;
          margin-bottom: 5px;
          color: #2ba2af;
          font-size: 11px;
          font-weight: 400;
        "
      >
        ${mercado_objetivo_estructura_ventas.contado_total}
      </p>            
    </div>  
    <div style="display: flex; align-items: flex-start;">
      <p
        style="
          margin: 0px;
          margin-bottom: 5px;
          color: #2ba2af;
          font-size: 11px;
          font-weight: 400;
        "
      >
        ${mercado_objetivo_estructura_ventas.ventas_gobierno}
      </p>            
    </div>            
  </div>        
`
    )
    logger.info(`${fileMethod} | ${customUuid} | Mercado Objetivo ventas HTML: ${JSON.stringify(strHTML_paso)}`)


    strHTML_paso = strHTML_paso.replace(
      '{_mercado_objetivo_importaciones_display_}',
      mercado_objetivo_importaciones?.length > 0 ? 'block' : 'none'
    );

    strHTML_paso = strHTML_paso.replace(
      '{_mercado_objetivo_importaciones_}',
      (mercado_objetivo_importaciones || [])
        .map(im => `          
          <div
            style="
              display: grid;
              grid-template-columns: 3fr 1.5fr 1.5fr;
              padding: 2.5px 0px;
              border-bottom: 1px solid #787878;
            "
          >
            <div style="display: flex; align-items: flex-start;">
              <p
                style="
                  margin: 0px;
                  margin-bottom: 5px;
                  color: #2ba2af;
                  font-size: 11px;
                  font-weight: 400;
                "
              >
                ${im.pais}
              </p>
            </div>
            <div style="display: flex; align-items: flex-start;">
              <p
                style="
                  margin: 0px;
                  margin-bottom: 5px;
                  color: #2ba2af;
                  font-size: 11px;
                  font-weight: 400;
                "
              >
                ${im.porcentaje}
              </p>            
            </div>       
          </div>        
        `)
        .join('')
    );

    logger.info(`${fileMethod} | ${customUuid} | Mercado Objetivo importaciones HTML: ${JSON.stringify(strHTML_paso)}`);


    strHTML_paso = strHTML_paso.replace('{_mercado_objetivo_exportaciones_}', mercado_objetivo_exportaciones?.map(
      (ex) => (`          
    <div
      style="
        display: grid;
        grid-template-columns: 3fr 1.5fr 1.5fr;
        padding: 2.5px 0px;
        border-bottom: 1px solid #787878;
      "
    >
      <div style="display: flex; align-items: flex-start;">
        <p
          style="
            margin: 0px;
            margin-bottom: 5px;
            color: #2ba2af;
            font-size: 11px;
            font-weight: 400;
          "
        >
          ${ex.pais}
        </p>
      </div>
      <div style="display: flex; align-items: flex-start;">
        <p
          style="
            margin: 0px;
            margin-bottom: 5px;
            color: #2ba2af;
            font-size: 11px;
            font-weight: 400;
          "
        >
          ${ex.porcentaje}
        </p>            
      </div>       
    </div>        
  ` )
    ).join(''))
    logger.info(`${fileMethod} | ${customUuid} | Mercado Objetivo exportaciones HTML: ${JSON.stringify(strHTML_paso)}`)


    //  Demandas
    // _certification?.demandas

    strHTML_paso = strHTML_paso.replace('{_demandas_}', datos_reporte?.demandas?.map(
      (demanda) => (`          
      <div
      style="
        background: #ffff;
        /* box-shadow: 2px 2px 10px rgba(0, 0, 0, 0.3); */
        padding: 12px 12px;
        border: 1px solid #787878;
        width: 90%;
        margin-top: 10px;
        break-inside: avoid;
        page-break-inside: avoid;
      "
    >          
      <div>

        <div
          style="
            display: grid;
            grid-template-columns: 3fr 2fr;
            
          "
        >
          

          <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
            <p
              style="
                margin: 0px;
                margin-bottom: 5px;
                font-size: 12px;
                font-weight: 500;
              "
            >
              ${(demanda.fecha_demanda?.length > 0 || demanda.fecha_demanda === 'undefined') ? demanda.fecha_demanda : '-'}
            </p>
          </div>              

        </div> 

        <div
          style="
            display: grid;
            grid-template-columns: 3fr 2fr;
          "
        >
          

          <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
            <p
              style="
                margin: 0px;
                margin-bottom: 5px;
                font-size: 12px;
                font-weight: 500;
              "
            >
            ${(demanda.demandante?.length > 0 || demanda.demandante === 'undefined') ? demanda.demandante : '-'}
            </p>
          </div>              

        </div> 

        <div
          style="
            display: grid;
            grid-template-columns: 1fr 5fr;
            border-bottom: 1px solid #787878;
          "
        >
          <div style="display: flex; align-items: flex-start; padding: 3px 0px; ">
            <p
              style="
                margin: 0px;
                margin-bottom: 5px;
                color: #0a3d8e;
                font-size: 12px;
                font-weight: 700;
                
              "
            >
            Tipo de Juicio:
            </p>
          </div>

          <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
            <p
              style="
                margin: 0px;
                margin-bottom: 5px;
                font-size: 12px;
                font-weight: 500;
              "
            >
            ${(demanda.tipo_demanda?.length > 0 || demanda.tipo_demanda === 'undefined') ? demanda.tipo_demanda : '-'}
            </p>
          </div>              

        </div> 
        
        

        <div
          style="
            display: grid;
            grid-template-columns: 1fr 5fr;
            border-bottom: 1px solid #787878;
          "
        >
          <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
            <p
              style="
                margin: 0px;
                margin-bottom: 5px;
                color: #0a3d8e;
                font-size: 12px;
                font-weight: 700;
                
              "
            >
            Entidad:
            </p>
          </div>

          <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
            <p
              style="
                margin: 0px;
                margin-bottom: 5px;
                font-size: 12px;
                font-weight: 500;
              "
            >
              ${(demanda.entidad?.length > 0 || demanda.entidad === 'undefined') ? demanda.entidad : '-'}
            </p>
          </div> 
          
          

        </div> 


        <div
          style="
            display: grid;
            grid-template-columns: 1fr 5fr;
            border-bottom: 1px solid #787878;
          "
        >
          <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
            <p
              style="
                margin: 0px;
                margin-bottom: 5px;
                color: #0a3d8e;
                font-size: 12px;
                font-weight: 700;
                
              "
            >
            Juzgado:
            </p>
          </div>

          <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
            <p
              style="
                margin: 0px;
                margin-bottom: 5px;
                font-size: 12px;
                font-weight: 500;
              "
            >
              ${(demanda.juzgado?.length > 0 || demanda.juzgado === 'undefined') ? demanda.juzgado : '-'}
            </p>
          </div>              

        </div> 


        <div
          style="
            display: grid;
            
          "
        >
          

          <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
            <p
              style="
                margin: 0px;
                margin-bottom: 5px;
                font-size: 12px;
                font-weight: 500;
              "
            >
            ${(demanda.comentarios?.length > 0 || demanda.comentarios === 'undefined') ? demanda.comentarios : '-'}
            </p>
          </div>              

        </div>     

      </div>
        </div>      
    ` )
    ).join(''))
    logger.info(`${fileMethod} | ${customUuid} | Demandas HTML: ${JSON.stringify(strHTML_paso)}`)


    // Referencis

    strHTML_paso = strHTML_paso.replace('{_referencias_}', datos_reporte?.referenciasComerciales?.map(
      (referencia) => (`  
      <div
          style="
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: flex-start;
            margin-bottom: 20px;
            margin-top: 30px;
          "
        >
          <p
            style="
              color: #0a3d8e;
              margin: 0px;
              font-size: 12px;
              font-weight: 700;
            "
          >
            ${referencia.razon_social ?? '-'}
          </p>
        </div>        
             <div>                
          <div
            style="
              background: #ffff;
              /* box-shadow: 2px 2px 10px rgba(0, 0, 0, 0.3); */
              padding: 12px 12px;
              border: 1px solid #787878;
              width: 45%;
              display: inline-block;
              vertical-align: top;
            "
          >          
            <div>
              <div
                style="
                  display: grid;
                  grid-template-columns: 3fr 2fr;
                  border-bottom: 1px<<<<<<< feature/rfc-incoherente
5801
 
 solid #787878;
                "
              >
                <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
                  <p
                    style="
                      margin: 0px;
                      margin-bottom: 5px;
                      color: #0a3d8e;
                      font-size: 12px;
                      font-weight: 700;
                    "
                  >
                  Direccion Fiscal:
                  </p>
                </div>

                <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                  <p
                    style="
                      margin: 0px;
                      margin-bottom: 5px;
                      font-size: 12px;
                      font-weight: 500;
                    "
                  >
                    ${referencia.direccion_fiscal ?? '-'}
                  </p>
                </div>              

              </div> 
              
              

              <div
                style="
                  display: grid;
                  grid-template-columns: 3fr 2fr;
                  border-bottom: 1px solid #787878;
                "
              >
                <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
                  <p
                    style="
                      margin: 0px;
                      margin-bottom: 5px;
                      color: #0a3d8e;
                      font-size: 12px;
                      font-weight: 700;
                    "
                  >
                  Antguedad Relacion:
                  </p>
                </div>

                <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                  <p
                    style="
                      margin: 0px;
                      margin-bottom: 5px;
                      font-size: 12px;
                      font-weight: 500;
                    "
                  >
                  ${referencia.antiguedad_relacion ?? '-'}
                  </p>
                </div>              

              </div> 


              <div
                style="
                  display: grid;
                  grid-template-columns: 3fr 2fr;
                  border-bottom: 1px solid #787878;
                "
              >
                <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
                  <p
                    style="
                      margin: 0px;
                      margin-bottom: 5px;
                      color: #0a3d8e;
                      font-size: 12px;
                      font-weight: 700;
                    "
                  >
                  Monto de Linea de Crédito Otorgada (LC):
                  </p>
                </div>

                <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                  <p
                    style="
                      margin: 0px;
                      margin-bottom: 5px;
                      font-size: 12px;
                      font-weight: 500;
                    "
                  >
                  -
                  </p>
                </div>              

              </div> 


              <div
                style="
                  display: grid;
                  grid-template-columns: 3fr 2fr;
                  border-bottom: 1px solid #787878;
                "
              >
                <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
                  <p
                    style="
                      margin: 0px;
                      margin-bottom: 5px;
                      color: #0a3d8e;
                      font-size: 12px;
                      font-weight: 700;
                    "
                  >
                  Plazo de Crédito DSO:
                  </p>
                </div>

                <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                  <p
                    style="
                      margin: 0px;
                      margin-bottom: 5px;
                      font-size: 12px;
                      font-weight: 500;
                    "
                  >
                  ${referencia.plazo ?? '-'}
                  </p>
                </div>              

              </div> 


              <div
                style="
                  display: grid;
                  grid-template-columns: 3fr 2fr;
                  border-bottom: 1px solid #787878;
                "
              >
                <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
                  <p
                    style="
                      margin: 0px;
                      margin-bottom: 5px;
                      color: #0a3d8e;
                      font-size: 12px;
                      font-weight: 700;
                    "
                  >
                  Fecha de Otorgamiento de LC: 
                  </p>
                </div>

                <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                  <p
                    style="
                      margin: 0px;
                      margin-bottom: 5px;
                      font-size: 12px;
                      font-weight: 500;
                    "
                  >
                  ${referencia.fecha_otorgamiento_linea_credito ?? '-'}
                  </p>
                </div>              

              </div> 

            </div>
          </div>

          <!-- 2 -->
          <div
            style="
              background: #ffff;
              padding: 12px 12px;
              border: 1px solid #787878;
              width: 45%;
              display: inline-block;
              vertical-align: top;
            "
          >          
              <div>
                <div
                  style="
                    display: grid;
                    grid-template-columns: 3fr 2fr;
                    border-bottom: 1px solid #787878;
                  "
                >
                  <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
                    <p
                      style="
                        margin: 0px;
                        margin-bottom: 5px;
                        color: #0a3d8e;
                        font-size: 12px;
                        font-weight: 700;
                      "
                    >
                    Monto de Saldo Vigente de la LC :
                    </p>
                  </div>

                  <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                    <p
                      style="
                        margin: 0px;
                        margin-bottom: 5px;
                        font-size: 12px;
                        font-weight: 500;
                      "
                    >
                    ${referencia.monto_saldo_vigente_linea_credito ?? '-'}
                    </p>
                  </div>              

                </div> 
                
                

                <div
                  style="
                    display: grid;
                    grid-template-columns: 3fr 2fr;
                    border-bottom: 1px solid #787878;
                  "
                >
                  <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
                    <p
                      style="
                        margin: 0px;
                        margin-bottom: 5px;
                        color: #0a3d8e;
                        font-size: 12px;
                        font-weight: 700;
                      "
                    >
                    Monto de Saldo Vencido de la LC: 
                    </p>
                  </div>

                  <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                    <p
                      style="
                        margin: 0px;
                        margin-bottom: 5px;
                        font-size: 12px;
                        font-weight: 500;
                      "
                    >
                    ${referencia.monto_saldo_vencido_linea_credito ?? '-'}
                    </p>
                  </div>              

                </div> 


                <div
                  style="
                    display: grid;
                    grid-template-columns: 3fr 2fr;
                    border-bottom: 1px solid #787878;
                  "
                >
                  <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
                    <p
                      style="
                        margin: 0px;
                        margin-bottom: 5px;
                        color: #0a3d8e;
                        font-size: 12px;
                        font-weight: 700;
                      "
                    >
                    Dias de atraso :
                    </p>
                  </div>

                  <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                    <p
                      style="
                        margin: 0px;
                        margin-bottom: 5px;
                        font-size: 12px;
                        font-weight: 500;
                      "
                    >
                    ${referencia.dias_atraso ?? '-'}
                    </p>
                  </div>              

                </div> 


                <div
                  style="
                    display: grid;
                    grid-template-columns: 3fr 2fr;
                    border-bottom: 1px solid #787878;
                  "
                >
                  <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
                    <p
                      style="
                        margin: 0px;
                        margin-bottom: 5px;
                        color: #0a3d8e;
                        font-size: 12px;
                        font-weight: 700;
                      "
                    >
                    Resultado de la experiencia de pagos
                    </p>
                  </div>

                  <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                    <p
                      style="
                        margin: 0px;
                        margin-bottom: 5px;
                        font-size: 12px;
                        font-weight: 500;
                      "
                    >
                      -
                    </p>
                  </div>              

                </div> 


            

              </div>
          </div>
        
        </div>
    ` )
    ).join(''))
    logger.info(`${fileMethod} | ${customUuid} | Referencias HTML: ${JSON.stringify(strHTML_paso)}`)

    let _demandas_display_ = 'none';
    let _referencias_display_ = 'none';
    let _mercado_objetivo_importaciones_display_ = 'none';
    let _mercado_objetivo_exportaciones_display_ = 'none';

    if (datos_reporte?.demandas?.length > 0) _demandas_display_ = 'block';

    if (datos_reporte?.referenciasComerciales?.length > 0) _referencias_display_ = 'block';

    if (datos_reporte?.mercado_objetivo_importaciones?.length > 0) _mercado_objetivo_importaciones_display_ = 'block';

    if (datos_reporte?.mercado_objetivo_exportaciones?.length > 0) _mercado_objetivo_exportaciones_display_ = 'block';

    strHTML_paso = strHTML_paso.replace('{_demandas_display_}', _demandas_display_);
    strHTML_paso = strHTML_paso.replace('{_referencias_display_}', _referencias_display_);
    strHTML_paso = strHTML_paso.replace('{_mercado_objetivo_importaciones_display_}', _mercado_objetivo_importaciones_display_);
    strHTML_paso = strHTML_paso.replace('{_mercado_objetivo_exportaciones_display_}', _mercado_objetivo_exportaciones_display_);
    //

    const options = {
      format: "A4",
      printBackground: true,  // Asegura que los colores de fondo y estilos CSS avanzados se rendericen
      margin: { top: 10, right: 10, bottom: 10, left: 10 },  // Ajusta los márgenes del PDF
      preferCSSPageSize: true,  // Usa el tamaño de la página definido en el CSS (opcional)
      path: "reporte.pdf"  // Guarda el archivo en el sistema
    }
    logger.info(`${fileMethod} | ${customUuid} | opciones de configuración: ${JSON.stringify(options)}`)

    const file = { content: strHTML_paso }
    logger.info(`${fileMethod} | ${customUuid} | HTML: ${JSON.stringify(file)}`)

    let pdfBuffer = ''
    try {
      pdfBuffer = await html_to_pdf.generatePdf(file, options)
      logger.info(`${fileMethod} | ${customUuid} | PDF BUFFER: ${JSON.stringify(pdfBuffer)}`)
    } catch (error) {
      logger.info(`${fileMethod} | ${customUuid} | ERROR PDF BUFFER: ${JSON.stringify(error)}`)
    }

    try {
      await fsp.writeFile(rutaArchivo + '.pdf', pdfBuffer);
      logger.info(`${fileMethod} | ${customUuid} | Escritura del archivo: ${JSON.stringify(rutaArchivo)}`)
    } catch (error) {
      logger.info(`${fileMethod} | ${customUuid} | Error en Escritura del archivo: ${JSON.stringify(error)}`)
    }

    const archivo64 = `data:doc/pdf;base64,${pdfBuffer.toString('base64')}`
    logger.info(`${fileMethod} | ${customUuid} | Archivo base64: ${JSON.stringify(archivo64)}`)

    // TODO:  Dsecomentar pruebas
    location = await subirReporteCreditoS3(archivo64)
    logger.info(`${fileMethod} | ${customUuid} | Archivo en AWS: ${JSON.stringify(location)}`)

    await sendEmailNodeMailerInformativo({ pdfBuffer })

    return {
      error: false,
      archivo: location.file
    }

    // Con Archivo
  } catch (err) {
    console.log({ err })
    logger.info(`${fileMethod} | ${customUuid} | Error general: ${JSON.stringify(err)}`)
    return {
      error: true,
      descripcion: err
    }
  }
}

const generarReporteCredito = async (customUuid, idEmpresa, id_reporte_credito, _reporte_credito, id_certification) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: generarReporteCredito`
  try {
    logger.info(`${fileMethod} | ${customUuid} | El ID de empresa para generar reporte de credito es: ${JSON.stringify(idEmpresa)}`)

    if (!idEmpresa) {
      return {
        error: true,
        descripcion: 'idEmpresa Obligatorio'
      }
    }

    /*     validarCertificacionBloc(id_certification);
     */
    const _certification = await consultaCertificacion(customUuid, idEmpresa)
    logger.info(`${fileMethod} | ${customUuid} | Consulta de la ultima certificación: ${JSON.stringify(_certification)}`)

    const datos_reporte = {
      ..._reporte_credito,      // Agregamos datos de cálculo
      certificacion: _certification?.certificacion,
      partidasFinancieras: _certification?.partidasFinancieras,
      referenciasComerciales: _certification?.referenciasComerciales,
      mercadoObjetivo: _certification?.mercadoObjetivo,
      demandas: _certification?.demandas,
    }

    const encabezado = {
      razon_social: datos_reporte?.certificacion?.[0]?.razon_social,
      rfc: datos_reporte?.certificacion?.[0]?.rfc,
      pais: datos_reporte?._01_pais?.descripcion,

      // direccion_fiscal: reporte_credito?.certificacion?.[0]?.direccion_fiscal,
      direccion_fiscal: datos_reporte?.certificacion?.[0]?.direccion_fiscal?.calle ?? ' '
        + ' # ' + datos_reporte?.certificacion?.[0]?.direccion_fiscal?.numero
        + ', ' + datos_reporte?.certificacion?.[0]?.direccion_fiscal?.ciudad
        + ', ' + datos_reporte?.certificacion?.[0]?.direccion_fiscal?.estado
        + '. C.P. : ' + datos_reporte?.certificacion?.[0]?.direccion_fiscal?.codigo_postal
        + ' . ' + datos_reporte?.certificacion?.[0]?.direccion_fiscal?.pais
      ,

      telefono: '-',
      correo: '-',
      pagina_web: datos_reporte?.certificacion?.[0]?.web_site,
    }

    logger.info(`${fileMethod} | ${customUuid} | Encabezado-x: ${JSON.stringify(datos_reporte)}`)

    const resumen = {
      experiencia: datos_reporte?._06_tiempo_actividad.descripcion,
      plantilla_laboral: datos_reporte?._04_plantilla_laboral?.descripcion,
      sector: datos_reporte?._02_sector_riesgo?.descripcion,
      sector_cliente_final: datos_reporte?._05_sector_cliente_final?.descripcion,

      empresa_controlante_rfc: '-',
      empresa_controlante_razon_social: '-',

      capital_contable: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[0]?.capital_contable ?? '-',
      ventas_anuales: datos_reporte?.partidasFinancieras?.certification_partidas_estado_resultados_contables?.[0]?.ventas_anuales ?? '-',
      caja_bancos: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[0]?.caja_bancos ?? '-',

      linea_credito: '-',

      plazo_pago: datos_reporte.plazo,// datos_reporte?.plazo,

      ventas_gobierno: '0',
      empresas_relacionadas: '0',
      fecha_actualizacion_69_69B: '0',

      datos_obtenidos: {
        referencias_comerciales: 1,
        indicencias_mercantiles: 1,
        contribuyente_incumplido: 0
      }
    }

    const accionistaControlante2 = datos_reporte?.certificacion?.[0]?.accionistas?.find(a => parseInt(a.controlante) === 1)
    if (accionistaControlante2) {
      resumen.empresa_controlante_razon_social = accionistaControlante2.razon_social || '-'
      resumen.empresa_controlante_rfc = accionistaControlante2.rfc || '-'
    }

    logger.info(`${fileMethod} | ${customUuid} | Resumen: ${JSON.stringify(datos_reporte?.certificacion?.[0]?.accionistas)}`)

    const resultados = {
      linea_credito_solicitada: datos_reporte.monto_solicitado,// reporte_credito?.reporteCredito?.monto_solicitado ?? '-',

      riesgo: datos_reporte?.score,
      riesgo_descripcion: datos_reporte?.wording_underwriting, // REsultado sugerencia

      linea_credito_recomendada: datos_reporte?.monto_sugerido ?? '-',

      // Alerta 1
      porcentaje_endeudamiento_comercial: datos_reporte?.porcentaje_endeudamiento ?? '-',
      porcentaje_endeudamiento_comercial_descripcion: datos_reporte?.texto_reporte_endeudamiento ?? '-',
      // descripcion_endeudamiento

      // Alerta 2
      dias_recomendacion_DSO: datos_reporte?.dias_plazo_credito ?? '-',
      dias_recomendacion_DSO_descripcion: datos_reporte?.texto_reporte_plazo_credito ?? '-',
      // texto_reporte_plazo_credito

      // Antiguedad Saldos no lo tenemos

      porcentaje_deudas: datos_reporte?.porcentaje_endeudamiento,
      dias_atraso_deudas: datos_reporte?._14_payback?.parametro

    }

    logger.info(`${fileMethod} | ${customUuid} | Resultados: ${JSON.stringify(resultados)}`)

    // Formateamos Endeudamiento comercial a 2 digitos
    if (resultados.porcentaje_endeudamiento_comercial != '-') {
      resultados.porcentaje_endeudamiento_comercial = parseFloat(resultados.porcentaje_endeudamiento_comercial).toFixed(2) + '%'
    }

    // Formateamos dias recomendacion DSO a 2 digitos
    if (resultados.dias_recomendacion_DSO != '-') {
      resultados.dias_recomendacion_DSO = parseFloat(resultados.dias_recomendacion_DSO).toFixed(2)
    }

    // 
    const performance_financiero = {
      // Partidas de estado de balance año anterior
      balance_anio_anterior_indicador: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[0]?.periodo_anterior ?? '-',
      balance_anio_anterior_caja_bancos: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[0]?.caja_bancos ?? '-',
      balance_anio_anterior_saldo_clientes: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[0]?.saldo_cliente_cuenta_x_cobrar ?? '-',
      balance_anio_anterior_saldo_inventarios: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[0]?.saldo_inventarios ?? '-',
      balance_anio_anterior_deudores_diversos: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[0]?.deudores_diversos ?? '-',
      balance_anio_anterior_otros_activos: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[0]?.otros_activos ?? '-',
      balance_anio_anterior_total_activo_circulante: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[0]?.total_activo_circulante ?? '-',
      balance_anio_anterior_total_activo_fijo: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[0]?.total_activo_fijo ?? '-',
      balance_anio_anterior_activo_intangible: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[0]?.activo_intangible ?? '-',
      balance_anio_anterior_activo_diferido: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[0]?.activo_diferido ?? '-',
      balance_anio_anterior_otros_activos_fijos_largo_plazo: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[0]?.otros_activos_fijos_largo_plazo ?? '-',
      balance_anio_anterior_proveedores: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[0]?.proveedores ?? '-',
      balance_anio_anterior_acreedores: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[0]?.acreedores ?? '-',
      balance_anio_anterior_inpuestos_x_pagar: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[0]?.inpuestos_x_pagar ?? '-',
      balance_anio_anterior_otros_pasivos: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[0]?.otros_pasivos ?? '-',
      balance_anio_anterior_total_pasivo_circulante: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[0]?.total_pasivo_circulante ?? '-',
      balance_anio_anterior_total_pasivo_largo_plazo: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[0]?.total_pasivo_largo_plazo ?? '-',
      balance_anio_anterior_pasivo_diferido: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[0]?.pasivo_diferido ?? '-',
      balance_anio_anterior_capital_social: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[0]?.capital_social ?? '-',
      balance_anio_anterior_resultado_ejercicios_anteriores: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[0]?.resultado_ejercicios_anteriores ?? '-',
      balance_anio_anterior_resultado_ejercicios: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[0]?.resultado_ejercicios ?? '-',
      balance_anio_anterior_otro_capital: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[0]?.otro_capital ?? '-',
      balance_anio_anterior_total_capital_contable_pat: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[0]?.total_capital_contable_pat ?? '-',

      // Partidas del estado de resultados año anterior
      estado_resultados_anio_anterior_indicador: datos_reporte?.partidasFinancieras?.certification_partidas_estado_resultados_contables?.[0]?.periodo_anterior ?? '-',
      estado_resultados_anio_anterior_ventas_anuales: datos_reporte?.partidasFinancieras?.certification_partidas_estado_resultados_contables?.[0]?.ventas_anuales ?? '-',
      estado_resultados_anio_anterior_costo_ventas_anuales: datos_reporte?.partidasFinancieras?.certification_partidas_estado_resultados_contables?.[0]?.costo_ventas_anuales ?? '-',
      estado_resultados_anio_anterior_utilidad_operativa: datos_reporte?.partidasFinancieras?.certification_partidas_estado_resultados_contables?.[0]?.utilidad_operativa ?? '-',
      estado_resultados_anio_anterior_utilidad_bruta: datos_reporte?.partidasFinancieras?.certification_partidas_estado_resultados_contables?.[0]?.utilidad_bruta ?? '-',
      estado_resultados_anio_anterior_gastos_administracion: datos_reporte?.partidasFinancieras?.certification_partidas_estado_resultados_contables?.[0]?.gastos_administracion ?? '-',
      estado_resultados_anio_anterior_gastos_productos_financieros: datos_reporte?.partidasFinancieras?.certification_partidas_estado_resultados_contables?.[0]?.gastos_productos_financieros ?? '-',
      estado_resultados_anio_anterior_depreciacion_amortizacion: datos_reporte?.partidasFinancieras?.certification_partidas_estado_resultados_contables?.[0]?.depreciacion_amortizacion ?? '-',
      estado_resultados_anio_anterior_otros_ingresos: datos_reporte?.partidasFinancieras?.certification_partidas_estado_resultados_contables?.[0]?.otros_ingresos ?? '-',
      estado_resultados_anio_anterior_otros_egresos: datos_reporte?.partidasFinancieras?.certification_partidas_estado_resultados_contables?.[0]?.otros_egresos ?? '-',
      estado_resultados_anio_anterior_otros_gastos: datos_reporte?.partidasFinancieras?.certification_partidas_estado_resultados_contables?.[0]?.otros_gastos ?? '-',
      estado_resultados_anio_anterior_utilidad_neta: datos_reporte?.partidasFinancieras?.certification_partidas_estado_resultados_contables?.[0]?.utilidad_neta ?? '-',

      // Partidas de estado de balance año previo anterior
      balance_anio_previo_anterior_indicador: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[1]?.periodo_previo_anterior ?? '-',
      balance_anio_previo_anterior_caja_bancos: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[1]?.caja_bancos ?? '-',
      balance_anio_previo_anterior_saldo_clientes: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[1]?.saldo_cliente_cuenta_x_cobrar ?? '-',
      balance_anio_previo_anterior_saldo_inventarios: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[1]?.saldo_inventarios ?? '-',
      balance_anio_previo_anterior_deudores_diversos: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[1]?.deudores_diversos ?? '-',
      balance_anio_previo_anterior_otros_activos: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[1]?.otros_activos ?? '-',
      balance_anio_previo_anterior_total_activo_circulante: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[1]?.total_activo_circulante ?? '-',
      balance_anio_previo_anterior_total_activo_fijo: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[1]?.total_activo_fijo ?? '-',
      balance_anio_previo_anterior_activo_intangible: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[1]?.activo_intangible ?? '-',
      balance_anio_previo_anterior_activo_diferido: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[1]?.activo_diferido ?? '-',
      balance_anio_previo_anterior_otros_activos_fijos_largo_plazo: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[1]?.otros_activos_fijos_largo_plazo ?? '-',
      balance_anio_previo_anterior_proveedores: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[1]?.proveedores ?? '-',
      balance_anio_previo_anterior_acreedores: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[1]?.acreedores ?? '-',
      balance_anio_previo_anterior_inpuestos_x_pagar: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[1]?.inpuestos_x_pagar ?? '-',
      balance_anio_previo_anterior_otros_pasivos: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[1]?.otros_pasivos ?? '-',
      balance_anio_previo_anterior_total_pasivo_circulante: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[1]?.total_pasivo_circulante ?? '-',
      balance_anio_previo_anterior_total_pasivo_largo_plazo: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[1]?.total_pasivo_largo_plazo ?? '-',
      balance_anio_previo_anterior_pasivo_diferido: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[1]?.pasivo_diferido ?? '-',
      balance_anio_previo_anterior_capital_social: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[1]?.capital_social ?? '-',
      balance_anio_previo_anterior_resultado_ejercicios_anteriores: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[1]?.resultado_ejercicios_anteriores ?? '-',
      balance_anio_previo_anterior_resultado_ejercicios: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[1]?.resultado_ejercicios ?? '-',
      balance_anio_previo_anterior_otro_capital: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[1]?.otro_capital ?? '-',
      balance_anio_previo_anterior_total_capital_contable_pat: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[1]?.total_capital_contable_pat ?? '-',

      // Partidas del estado de resultados
      estado_resultados_anio_previo_anterior_indicador: datos_reporte?.partidasFinancieras?.certification_partidas_estado_resultados_contables?.[1]?.periodo_anterior ?? '-',
      estado_resultados_anio_previo_anterior_ventas_anuales: datos_reporte?.partidasFinancieras?.certification_partidas_estado_resultados_contables?.[1]?.ventas_anuales ?? '-',
      estado_resultados_anio_previo_anterior_costo_ventas_anuales: datos_reporte?.partidasFinancieras?.certification_partidas_estado_resultados_contables?.[1]?.costo_ventas_anuales ?? '-',
      estado_resultados_anio_previo_anterior_utilidad_operativa: datos_reporte?.partidasFinancieras?.certification_partidas_estado_resultados_contables?.[1]?.utilidad_operativa ?? '-',
      estado_resultados_anio_previo_anterior_utilidad_bruta: datos_reporte?.partidasFinancieras?.certification_partidas_estado_resultados_contables?.[1]?.utilidad_bruta ?? '-',
      estado_resultados_anio_previo_anterior_gastos_administracion: datos_reporte?.partidasFinancieras?.certification_partidas_estado_resultados_contables?.[1]?.gastos_administracion ?? '-',
      estado_resultados_anio_previo_anterior_gastos_productos_financieros: datos_reporte?.partidasFinancieras?.certification_partidas_estado_resultados_contables?.[1]?.gastos_productos_financieros ?? '-',
      estado_resultados_anio_previo_anterior_depreciacion_amortizacion: datos_reporte?.partidasFinancieras?.certification_partidas_estado_resultados_contables?.[1]?.depreciacion_amortizacion ?? '-',
      estado_resultados_anio_previo_anterior_otros_ingresos: datos_reporte?.partidasFinancieras?.certification_partidas_estado_resultados_contables?.[1]?.otros_ingresos ?? '-',
      estado_resultados_anio_previo_anterior_otros_egresos: datos_reporte?.partidasFinancieras?.certification_partidas_estado_resultados_contables?.[1]?.otros_egresos ?? '-',
      estado_resultados_anio_previo_anterior_otros_gastos: datos_reporte?.partidasFinancieras?.certification_partidas_estado_resultados_contables?.[1]?.otros_gastos ?? '-',
      estado_resultados_anio_previo_anterior_utilidad_neta: datos_reporte?.partidasFinancieras?.certification_partidas_estado_resultados_contables?.[1]?.utilidad_neta ?? '-',

      // balance_anio_anterior_deuda_corto_plazo: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[0]?.deuda_corto_plazo ?? '-',
      // balance_anio_anterior_deuda_total: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[0]?.deuda_total ?? '-',
      // balance_anio_anterior_capital_contable: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[0]?.capital_contable ?? '-',

      // balance_anio_previo_anterior_indicador: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[1]?.periodo_previo_anterior ?? '-',
      // balance_anio_previo_anterior_caja_bancos: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[1]?.caja_bancos ?? '-',
      // balance_anio_previo_anterior_saldo_clientes: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[1]?.saldo_cliente_cuenta_x_cobrar ?? '-',
      // balance_anio_previo_anterior_saldo_inventarios: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[1]?.saldo_inventarios ?? '-',
      // balance_anio_previo_anterior_deuda_corto_plazo: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[1]?.deuda_corto_plazo ?? '-',
      // balance_anio_previo_anterior_deuda_total: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[1]?.deuda_total ?? '-',
      // balance_anio_previo_anterior_capital_contable: datos_reporte?.partidasFinancieras?.certification_partidas_estado_balance?.[1]?.capital_contable ?? '-',

      // estado_resultados_anio_anterior_indicador: datos_reporte?.partidasFinancieras?.certification_partidas_estado_resultados_contables?.[0]?.periodo_anterior ?? '-',
      // estado_resultados_anio_anterior_ventas_anuales: datos_reporte?.partidasFinancieras?.certification_partidas_estado_resultados_contables?.[0]?.ventas_anuales ?? '-',
      // estado_resultados_anio_anterior_costo_ventas: datos_reporte?.partidasFinancieras?.certification_partidas_estado_resultados_contables?.[0]?.costo_ventas_anuales ?? '-',
      // estado_resultados_anio_anterior_utilidad_operativa: datos_reporte?.partidasFinancieras?.certification_partidas_estado_resultados_contables?.[0]?.utilidad_operativa ?? '-',

      // estado_resultados_anio_previo_anterior_indicador: datos_reporte?.partidasFinancieras?.certification_partidas_estado_resultados_contables?.[1]?.periodo_previo_anterior ?? '-',
      // estado_resultados_anio_previo_anterior_ventas_anuales: datos_reporte?.partidasFinancieras?.certification_partidas_estado_resultados_contables?.[1]?.ventas_anuales ?? '-',
      // estado_resultados_anio_previo_anterior_costo_ventas: datos_reporte?.partidasFinancieras?.certification_partidas_estado_resultados_contables?.[1]?.costo_ventas_anuales ?? '-',
      // estado_resultados_anio_previo_anterior_utilidad_operativa: datos_reporte?.partidasFinancieras?.certification_partidas_estado_resultados_contables?.[1]?.utilidad_operativa ?? '-',

    }

    logger.info(`${fileMethod} | ${customUuid} | Performance financiero: ${JSON.stringify(performance_financiero)}`)

    const ratio_financiero = {
      ratio_financiero_indicador: performance_financiero.estado_resultados_anio_anterior_indicador,        // Periodo Anterior
      ratio_financiero_ventas_anuales: performance_financiero.estado_resultados_anio_anterior_ventas_anuales,
      ratio_financiero_evolucion_Ventas: datos_reporte?._11_evolucion_ventas?.parametro ?? '-',
      ratio_financiero_payback: datos_reporte?._14_payback?.parametro ?? '-',
      ratio_financiero_apalancamiento: datos_reporte?._12_apalancamiento?.parametro ?? '-',

      ratio_financiero_DSO: datos_reporte?._15_rotacion_ctas_x_cobrar?.parametro_dso ?? '-',
      ratio_financiero_DIO: datos_reporte?._15_rotacion_ctas_x_cobrar?.parametro_dio ?? '-',

      ratio_financiero_flujo_caja: datos_reporte?._13_flujo_neto?.parametro ?? '-',
    }

    logger.info(`${fileMethod} | ${customUuid} | Ratio financiero: ${JSON.stringify(ratio_financiero)}`)

    // Preparamos datos

    // Formateamos los datos numéricos a moneda
    const formatter = new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    });

    if (resumen.capital_contable != '-') resumen.capital_contable = formatter.format(resumen.capital_contable);
    if (resumen.ventas_anuales != '-') resumen.ventas_anuales = formatter.format(resumen.ventas_anuales);
    if (resumen.caja_bancos != '-') resumen.caja_bancos = formatter.format(resumen.caja_bancos);

    if (resumen.linea_credito != '-') resumen.linea_credito = formatter.format(resumen.linea_credito);

    if (resultados.linea_credito_solicitada != '-') resultados.linea_credito_solicitada = formatter.format(resultados.linea_credito_solicitada);
    if (resultados.linea_credito_recomendada != '-') resultados.linea_credito_recomendada = formatter.format(resultados.linea_credito_recomendada);

    if (performance_financiero.balance_anio_anterior_caja_bancos != '-') performance_financiero.balance_anio_anterior_caja_bancos = formatter.format(performance_financiero.balance_anio_anterior_caja_bancos);
    if (performance_financiero.balance_anio_anterior_saldo_clientes != '-') performance_financiero.balance_anio_anterior_saldo_clientes = formatter.format(performance_financiero.balance_anio_anterior_saldo_clientes);
    if (performance_financiero.balance_anio_anterior_saldo_inventarios != '-') performance_financiero.balance_anio_anterior_saldo_inventarios = formatter.format(performance_financiero.balance_anio_anterior_saldo_inventarios);
    if (performance_financiero.balance_anio_anterior_deudores_diversos != '-') performance_financiero.balance_anio_anterior_deudores_diversos = formatter.format(performance_financiero.balance_anio_anterior_deudores_diversos);
    if (performance_financiero.balance_anio_anterior_otros_activos != '-') performance_financiero.balance_anio_anterior_otros_activos = formatter.format(performance_financiero.balance_anio_anterior_otros_activos);
    if (performance_financiero.balance_anio_anterior_total_activo_circulante != '-') performance_financiero.balance_anio_anterior_total_activo_circulante = formatter.format(performance_financiero.balance_anio_anterior_total_activo_circulante);
    if (performance_financiero.balance_anio_anterior_total_activo_fijo != '-') performance_financiero.balance_anio_anterior_total_activo_fijo = formatter.format(performance_financiero.balance_anio_anterior_total_activo_fijo);
    if (performance_financiero.balance_anio_anterior_activo_intangible != '-') performance_financiero.balance_anio_anterior_activo_intangible = formatter.format(performance_financiero.balance_anio_anterior_activo_intangible);
    if (performance_financiero.balance_anio_anterior_activo_diferido != '-') performance_financiero.balance_anio_anterior_activo_diferido = formatter.format(performance_financiero.balance_anio_anterior_activo_diferido);
    if (performance_financiero.balance_anio_anterior_otros_activos_fijos_largo_plazo != '-') performance_financiero.balance_anio_anterior_otros_activos_fijos_largo_plazo = formatter.format(performance_financiero.balance_anio_anterior_otros_activos_fijos_largo_plazo);
    if (performance_financiero.balance_anio_anterior_proveedores != '-') performance_financiero.balance_anio_anterior_proveedores = formatter.format(performance_financiero.balance_anio_anterior_proveedores);
    if (performance_financiero.balance_anio_anterior_acreedores != '-') performance_financiero.balance_anio_anterior_acreedores = formatter.format(performance_financiero.balance_anio_anterior_acreedores);
    if (performance_financiero.balance_anio_anterior_inpuestos_x_pagar != '-') performance_financiero.balance_anio_anterior_inpuestos_x_pagar = formatter.format(performance_financiero.balance_anio_anterior_inpuestos_x_pagar);
    if (performance_financiero.balance_anio_anterior_otros_pasivos != '-') performance_financiero.balance_anio_anterior_otros_pasivos = formatter.format(performance_financiero.balance_anio_anterior_otros_pasivos);
    if (performance_financiero.balance_anio_anterior_total_pasivo_circulante != '-') performance_financiero.balance_anio_anterior_total_pasivo_circulante = formatter.format(performance_financiero.balance_anio_anterior_total_pasivo_circulante);
    if (performance_financiero.balance_anio_anterior_total_pasivo_largo_plazo != '-') performance_financiero.balance_anio_anterior_total_pasivo_largo_plazo = formatter.format(performance_financiero.balance_anio_anterior_total_pasivo_largo_plazo);
    if (performance_financiero.balance_anio_anterior_pasivo_diferido != '-') performance_financiero.balance_anio_anterior_pasivo_diferido = formatter.format(performance_financiero.balance_anio_anterior_pasivo_diferido);
    if (performance_financiero.balance_anio_anterior_capital_social != '-') performance_financiero.balance_anio_anterior_capital_social = formatter.format(performance_financiero.balance_anio_anterior_capital_social);
    if (performance_financiero.balance_anio_anterior_resultado_ejercicios_anteriores != '-') performance_financiero.balance_anio_anterior_resultado_ejercicios_anteriores = formatter.format(performance_financiero.balance_anio_anterior_resultado_ejercicios_anteriores);
    if (performance_financiero.balance_anio_anterior_resultado_ejercicios != '-') performance_financiero.balance_anio_anterior_resultado_ejercicios = formatter.format(performance_financiero.balance_anio_anterior_resultado_ejercicios);
    if (performance_financiero.balance_anio_anterior_otro_capital != '-') performance_financiero.balance_anio_anterior_otro_capital = formatter.format(performance_financiero.balance_anio_anterior_otro_capital);
    if (performance_financiero.balance_anio_anterior_total_capital_contable_pat != '-') performance_financiero.balance_anio_anterior_total_capital_contable_pat = formatter.format(performance_financiero.balance_anio_anterior_total_capital_contable_pat);
    // if (performance_financiero.balance_anio_anterior_deuda_corto_plazo != '-') performance_financiero.balance_anio_anterior_deuda_corto_plazo = formatter.format(performance_financiero.balance_anio_anterior_deuda_corto_plazo);
    // if (performance_financiero.balance_anio_anterior_deuda_total != '-') performance_financiero.balance_anio_anterior_deuda_total = formatter.format(performance_financiero.balance_anio_anterior_deuda_total);
    // if (performance_financiero.balance_anio_anterior_capital_contable != '-') performance_financiero.balance_anio_anterior_capital_contable = formatter.format(performance_financiero.balance_anio_anterior_capital_contable);

    if (performance_financiero.balance_anio_previo_anterior_caja_bancos != '-') performance_financiero.balance_anio_previo_anterior_caja_bancos = formatter.format(performance_financiero.balance_anio_previo_anterior_caja_bancos);
    if (performance_financiero.balance_anio_previo_anterior_saldo_clientes != '-') performance_financiero.balance_anio_previo_anterior_saldo_clientes = formatter.format(performance_financiero.balance_anio_previo_anterior_saldo_clientes);
    if (performance_financiero.balance_anio_previo_anterior_saldo_inventarios != '-') performance_financiero.balance_anio_previo_anterior_saldo_inventarios = formatter.format(performance_financiero.balance_anio_previo_anterior_saldo_inventarios);
    if (performance_financiero.balance_anio_previo_anterior_deudores_diversos != '-') performance_financiero.balance_anio_previo_anterior_deudores_diversos = formatter.format(performance_financiero.balance_anio_previo_anterior_deudores_diversos);
    if (performance_financiero.balance_anio_previo_anterior_otros_activos != '-') performance_financiero.balance_anio_previo_anterior_otros_activos = formatter.format(performance_financiero.balance_anio_previo_anterior_otros_activos);
    if (performance_financiero.balance_anio_previo_anterior_total_activo_circulante != '-') performance_financiero.balance_anio_previo_anterior_total_activo_circulante = formatter.format(performance_financiero.balance_anio_previo_anterior_total_activo_circulante);
    if (performance_financiero.balance_anio_previo_anterior_total_activo_fijo != '-') performance_financiero.balance_anio_previo_anterior_total_activo_fijo = formatter.format(performance_financiero.balance_anio_previo_anterior_total_activo_fijo);
    if (performance_financiero.balance_anio_previo_anterior_activo_intangible != '-') performance_financiero.balance_anio_previo_anterior_activo_intangible = formatter.format(performance_financiero.balance_anio_previo_anterior_activo_intangible);
    if (performance_financiero.balance_anio_previo_anterior_activo_diferido != '-') performance_financiero.balance_anio_previo_anterior_activo_diferido = formatter.format(performance_financiero.balance_anio_previo_anterior_activo_diferido);
    if (performance_financiero.balance_anio_previo_anterior_otros_activos_fijos_largo_plazo != '-') performance_financiero.balance_anio_previo_anterior_otros_activos_fijos_largo_plazo = formatter.format(performance_financiero.balance_anio_previo_anterior_otros_activos_fijos_largo_plazo);
    if (performance_financiero.balance_anio_previo_anterior_proveedores != '-') performance_financiero.balance_anio_previo_anterior_proveedores = formatter.format(performance_financiero.balance_anio_previo_anterior_proveedores);
    if (performance_financiero.balance_anio_previo_anterior_acreedores != '-') performance_financiero.balance_anio_previo_anterior_acreedores = formatter.format(performance_financiero.balance_anio_previo_anterior_acreedores);
    if (performance_financiero.balance_anio_previo_anterior_inpuestos_x_pagar != '-') performance_financiero.balance_anio_previo_anterior_inpuestos_x_pagar = formatter.format(performance_financiero.balance_anio_previo_anterior_inpuestos_x_pagar);
    if (performance_financiero.balance_anio_previo_anterior_otros_pasivos != '-') performance_financiero.balance_anio_previo_anterior_otros_pasivos = formatter.format(performance_financiero.balance_anio_previo_anterior_otros_pasivos);
    if (performance_financiero.balance_anio_previo_anterior_total_pasivo_circulante != '-') performance_financiero.balance_anio_previo_anterior_total_pasivo_circulante = formatter.format(performance_financiero.balance_anio_previo_anterior_total_pasivo_circulante);
    if (performance_financiero.balance_anio_previo_anterior_total_pasivo_largo_plazo != '-') performance_financiero.balance_anio_previo_anterior_total_pasivo_largo_plazo = formatter.format(performance_financiero.balance_anio_previo_anterior_total_pasivo_largo_plazo);
    if (performance_financiero.balance_anio_previo_anterior_pasivo_diferido != '-') performance_financiero.balance_anio_previo_anterior_pasivo_diferido = formatter.format(performance_financiero.balance_anio_previo_anterior_pasivo_diferido);
    if (performance_financiero.balance_anio_previo_anterior_capital_social != '-') performance_financiero.balance_anio_previo_anterior_capital_social = formatter.format(performance_financiero.balance_anio_previo_anterior_capital_social);
    if (performance_financiero.balance_anio_previo_anterior_resultado_ejercicios_anteriores != '-') performance_financiero.balance_anio_previo_anterior_resultado_ejercicios_anteriores = formatter.format(performance_financiero.balance_anio_previo_anterior_resultado_ejercicios_anteriores);
    if (performance_financiero.balance_anio_previo_anterior_resultado_ejercicios != '-') performance_financiero.balance_anio_previo_anterior_resultado_ejercicios = formatter.format(performance_financiero.balance_anio_previo_anterior_resultado_ejercicios);
    if (performance_financiero.balance_anio_previo_anterior_otro_capital != '-') performance_financiero.balance_anio_previo_anterior_otro_capital = formatter.format(performance_financiero.balance_anio_previo_anterior_otro_capital);
    if (performance_financiero.balance_anio_previo_anterior_total_capital_contable_pat != '-') performance_financiero.balance_anio_previo_anterior_total_capital_contable_pat = formatter.format(performance_financiero.balance_anio_previo_anterior_total_capital_contable_pat);
    // if (performance_financiero.balance_anio_previo_anterior_deuda_corto_plazo != '-') performance_financiero.balance_anio_previo_anterior_deuda_corto_plazo = formatter.format(performance_financiero.balance_anio_previo_anterior_deuda_corto_plazo);
    // if (performance_financiero.balance_anio_previo_anterior_deuda_total != '-') performance_financiero.balance_anio_previo_anterior_deuda_total = formatter.format(performance_financiero.balance_anio_previo_anterior_deuda_total);
    // if (performance_financiero.balance_anio_previo_anterior_capital_contable != '-') performance_financiero.balance_anio_previo_anterior_capital_contable = formatter.format(performance_financiero.balance_anio_previo_anterior_capital_contable);

    if (performance_financiero.estado_resultados_anio_anterior_ventas_anuales != '-') performance_financiero.estado_resultados_anio_anterior_ventas_anuales = formatter.format(performance_financiero.estado_resultados_anio_anterior_ventas_anuales);
    if (performance_financiero.estado_resultados_anio_anterior_costo_ventas_anuales != '-') performance_financiero.estado_resultados_anio_anterior_costo_ventas_anuales = formatter.format(performance_financiero.estado_resultados_anio_anterior_costo_ventas_anuales);
    if (performance_financiero.estado_resultados_anio_anterior_utilidad_operativa != '-') performance_financiero.estado_resultados_anio_anterior_utilidad_operativa = formatter.format(performance_financiero.estado_resultados_anio_anterior_utilidad_operativa);
    if (performance_financiero.estado_resultados_anio_anterior_utilidad_bruta != '-') performance_financiero.estado_resultados_anio_anterior_utilidad_bruta = formatter.format(performance_financiero.estado_resultados_anio_anterior_utilidad_bruta);
    if (performance_financiero.estado_resultados_anio_anterior_gastos_administracion != '-') performance_financiero.estado_resultados_anio_anterior_gastos_administracion = formatter.format(performance_financiero.estado_resultados_anio_anterior_gastos_administracion);
    if (performance_financiero.estado_resultados_anio_anterior_gastos_productos_financieros != '-') performance_financiero.estado_resultados_anio_anterior_gastos_productos_financieros = formatter.format(performance_financiero.estado_resultados_anio_anterior_gastos_productos_financieros);
    if (performance_financiero.estado_resultados_anio_anterior_depreciacion_amortizacion != '-') performance_financiero.estado_resultados_anio_anterior_depreciacion_amortizacion = formatter.format(performance_financiero.estado_resultados_anio_anterior_depreciacion_amortizacion);
    if (performance_financiero.estado_resultados_anio_anterior_otros_ingresos != '-') performance_financiero.estado_resultados_anio_anterior_otros_ingresos = formatter.format(performance_financiero.estado_resultados_anio_anterior_otros_ingresos);
    if (performance_financiero.estado_resultados_anio_anterior_otros_egresos != '-') performance_financiero.estado_resultados_anio_anterior_otros_egresos = formatter.format(performance_financiero.estado_resultados_anio_anterior_otros_egresos);
    if (performance_financiero.estado_resultados_anio_anterior_otros_gastos != '-') performance_financiero.estado_resultados_anio_anterior_otros_gastos = formatter.format(performance_financiero.estado_resultados_anio_anterior_otros_gastos);
    if (performance_financiero.estado_resultados_anio_anterior_utilidad_neta != '-') performance_financiero.estado_resultados_anio_anterior_utilidad_neta = formatter.format(performance_financiero.estado_resultados_anio_anterior_utilidad_neta);
    // if (performance_financiero.estado_resultados_anio_anterior_ventas_anuales != '-') performance_financiero.estado_resultados_anio_anterior_ventas_anuales = formatter.format(performance_financiero.estado_resultados_anio_anterior_ventas_anuales);
    // if (performance_financiero.estado_resultados_anio_anterior_costo_ventas != '-') performance_financiero.estado_resultados_anio_anterior_costo_ventas = formatter.format(performance_financiero.estado_resultados_anio_anterior_costo_ventas);
    // if (performance_financiero.estado_resultados_anio_anterior_utilidad_operativa != '-') performance_financiero.estado_resultados_anio_anterior_utilidad_operativa = formatter.format(performance_financiero.estado_resultados_anio_anterior_utilidad_operativa);

    if (performance_financiero.estado_resultados_anio_previo_anterior_ventas_anuales != '-') performance_financiero.estado_resultados_anio_previo_anterior_ventas_anuales = formatter.format(performance_financiero.estado_resultados_anio_previo_anterior_ventas_anuales);
    if (performance_financiero.estado_resultados_anio_previo_anterior_costo_ventas_anuales != '-') performance_financiero.estado_resultados_anio_previo_anterior_costo_ventas_anuales = formatter.format(performance_financiero.estado_resultados_anio_previo_anterior_costo_ventas_anuales);
    if (performance_financiero.estado_resultados_anio_previo_anterior_utilidad_operativa != '-') performance_financiero.estado_resultados_anio_previo_anterior_utilidad_operativa = formatter.format(performance_financiero.estado_resultados_anio_previo_anterior_utilidad_operativa);
    if (performance_financiero.estado_resultados_anio_previo_anterior_utilidad_bruta != '-') performance_financiero.estado_resultados_anio_previo_anterior_utilidad_bruta = formatter.format(performance_financiero.estado_resultados_anio_previo_anterior_utilidad_bruta);
    if (performance_financiero.estado_resultados_anio_previo_anterior_gastos_administracion != '-') performance_financiero.estado_resultados_anio_previo_anterior_gastos_administracion = formatter.format(performance_financiero.estado_resultados_anio_previo_anterior_gastos_administracion);
    if (performance_financiero.estado_resultados_anio_previo_anterior_gastos_productos_financieros != '-') performance_financiero.estado_resultados_anio_previo_anterior_gastos_productos_financieros = formatter.format(performance_financiero.estado_resultados_anio_previo_anterior_gastos_productos_financieros);
    if (performance_financiero.estado_resultados_anio_previo_anterior_depreciacion_amortizacion != '-') performance_financiero.estado_resultados_anio_previo_anterior_depreciacion_amortizacion = formatter.format(performance_financiero.estado_resultados_anio_previo_anterior_depreciacion_amortizacion);
    if (performance_financiero.estado_resultados_anio_previo_anterior_otros_ingresos != '-') performance_financiero.estado_resultados_anio_previo_anterior_otros_ingresos = formatter.format(performance_financiero.estado_resultados_anio_previo_anterior_otros_ingresos);
    if (performance_financiero.estado_resultados_anio_previo_anterior_otros_egresos != '-') performance_financiero.estado_resultados_anio_previo_anterior_otros_egresos = formatter.format(performance_financiero.estado_resultados_anio_previo_anterior_otros_egresos);
    if (performance_financiero.estado_resultados_anio_previo_anterior_otros_gastos != '-') performance_financiero.estado_resultados_anio_previo_anterior_otros_gastos = formatter.format(performance_financiero.estado_resultados_anio_previo_anterior_otros_gastos);
    if (performance_financiero.estado_resultados_anio_previo_anterior_utilidad_neta != '-') performance_financiero.estado_resultados_anio_previo_anterior_utilidad_neta = formatter.format(performance_financiero.estado_resultados_anio_previo_anterior_utilidad_neta);
    // if (performance_financiero.estado_resultados_anio_previo_anterior_ventas_anuales != '-') performance_financiero.estado_resultados_anio_previo_anterior_ventas_anuales = formatter.format(performance_financiero.estado_resultados_anio_previo_anterior_ventas_anuales);
    // if (performance_financiero.estado_resultados_anio_previo_anterior_costo_ventas != '-') performance_financiero.estado_resultados_anio_previo_anterior_costo_ventas = formatter.format(performance_financiero.estado_resultados_anio_previo_anterior_costo_ventas);
    // if (performance_financiero.estado_resultados_anio_previo_anterior_utilidad_operativa != '-') performance_financiero.estado_resultados_anio_previo_anterior_utilidad_operativa = formatter.format(performance_financiero.estado_resultados_anio_previo_anterior_utilidad_operativa);

    if (ratio_financiero.ratio_financiero_ventas_anuales != '-') ratio_financiero.ratio_financiero_ventas_anuales = formatter.format(ratio_financiero.ratio_financiero_ventas_anuales);
    if (ratio_financiero.ratio_financiero_evolucion_Ventas != '-') ratio_financiero.ratio_financiero_evolucion_Ventas = formatter.format(ratio_financiero.ratio_financiero_evolucion_Ventas);
    if (ratio_financiero.ratio_financiero_payback != '-') ratio_financiero.ratio_financiero_payback = formatter.format(ratio_financiero.ratio_financiero_payback);
    if (ratio_financiero.ratio_financiero_apalancamiento != '-') ratio_financiero.ratio_financiero_apalancamiento = formatter.format(ratio_financiero.ratio_financiero_apalancamiento);
    if (ratio_financiero.ratio_financiero_DSO != '-') ratio_financiero.ratio_financiero_DSO = formatter.format(ratio_financiero.ratio_financiero_DSO);
    if (ratio_financiero.ratio_financiero_DIO != '-') ratio_financiero.ratio_financiero_DIO = formatter.format(ratio_financiero.ratio_financiero_DIO);
    if (ratio_financiero.ratio_financiero_flujo_caja != '-') ratio_financiero.ratio_financiero_flujo_caja = formatter.format(ratio_financiero.ratio_financiero_flujo_caja);


    const accionistas = datos_reporte?.certificacion?.[0]?.accionistas?.map((accionista) => ({ nombre: accionista?.razon_social, tax_id: accionista?.rfc })) ?? [];
    logger.info(`${fileMethod} | ${customUuid} | Accionistas: ${JSON.stringify(accionistas)}`)

    //const principales_directores = datos_reporte?.certificacion?.[0]?.principales_directores?.map((director) => ({ nombre: director?.nombre, puesto: director?.puesto, poder: director?.poder })) ?? [];
    const principales_directores = datos_reporte?.certificacion?.[0]?.principales_directores?.map((director) => ({ nombre: director?.nombre, puesto: director?.puesto_nombre, poder: director?.poder_nombre })) ?? [];
    logger.info(`${fileMethod} | ${customUuid} | Principales directores: ${JSON.stringify(principales_directores)}`)

    const estructura_personal = {
      operativo: datos_reporte?.certificacion?.[0]?.estructura_personal?.[0]?.personal_operativo ?? 0,
      administrativo: datos_reporte?.certificacion?.[0]?.estructura_personal?.[0]?.personal_administrativo ?? 0,
      directivo: datos_reporte?.certificacion?.[0]?.estructura_personal?.[0]?.personal_directivo ?? 0,
    }
    logger.info(`${fileMethod} | ${customUuid} | Estructura personal: ${JSON.stringify(estructura_personal)}`)

    const equipo_transporte = {
      carga: datos_reporte?.certificacion?.[0]?.equipo_transporte?.[0]?.flotilla_carga_especializado ?? 0,
      otros: datos_reporte?.certificacion?.[0]?.equipo_transporte?.[0]?.flotilla_otros_vehiculos ?? 0,
    }
    logger.info(`${fileMethod} | ${customUuid} | Equipo transporte: ${JSON.stringify(equipo_transporte)}`)

    const seguros = datos_reporte?.certificacion?.[0]?.seguros?.map((seguro) => ({ nombre_aseguradora: seguro?.nombre_aseguradora, bien_asegurado: seguro?.bien_asegurado })) ?? [];
    logger.info(`${fileMethod} | ${customUuid} | Seguros: ${JSON.stringify(seguros)}`)

    let mercado_objetivo_principales_clientes = [];
    const posiblesClientes = datos_reporte?.mercadoObjetivo?.principales_clientes;
    if (Array.isArray(posiblesClientes)) {
      mercado_objetivo_principales_clientes = posiblesClientes.map((pc) => ({
        nombre_empresa: pc?.razon_social || '',
        anios_relacion: pc?.anios_relacion || '',
        pais: pc?.pais || '',
        sector: pc?.sector || ''
      }));
    } else {
      logger.warn(`${fileMethod} | ${customUuid} | principales_clientes no es un arreglo válido: ${JSON.stringify(posiblesClientes)}`);
    }
    logger.info(`${fileMethod} | ${customUuid} | Mercado objetivo principales clientes-xxx: ${JSON.stringify(mercado_objetivo_principales_clientes)}`);

    const mercado_objetivo_estructura_ventas = {
      credito_total: datos_reporte?.mercadoObjetivo?.estructuras_ventas?.[0]?.porcentaje_credito_total_ventas ?? 0,
      contado_total: datos_reporte?.mercadoObjetivo?.estructuras_ventas?.[0]?.porcentaje_contado_total_ventas ?? 0,
      ventas_gobierno: datos_reporte?.mercadoObjetivo?.estructuras_ventas?.[0]?.porcentaje_ventas_gobierno ?? 0,
    }
    logger.info(`${fileMethod} | ${customUuid} | Mercado objetivo estructura ventas: ${JSON.stringify(mercado_objetivo_estructura_ventas)}`)

    // `referenciasComerciales` es un array de objetos
    const referencias_comerciales = datos_reporte?.referenciasComerciales.map(item => ({
      razon_social: item.razon_social,
      rfc: item.rfc,
      calificacion_referencia: item.calificacion_referencia,
      linea_credito: item.linea_credito,
      porcentaje_deuda: item.porcentaje_deuda,
      dias_atraso: item.dias_atraso
    }));
    // Imprimir cada razón social
    logger.info(`${fileMethod} | ${customUuid} | Referencias Comerciales Actualizadas: ${JSON.stringify(referencias_comerciales)}`);

    //const mercado_objetivo_importaciones = datos_reporte?.mercadoObjetivo?.importaciones?.map((im) => ({ pais: im?.pais, porcentaje: im?.porcentaje })) ?? [];

    const mercado_objetivo_importaciones = datos_reporte?.mercadoObjetivo?.importaciones
      ?.filter(im => im?.pais && im?.porcentaje != null)
      .map(im => ({ pais: im.pais, porcentaje: im.porcentaje })) ?? [];
    logger.info(`${fileMethod} | ${customUuid} | Mercado objetivo Importaciones: ${JSON.stringify(mercado_objetivo_importaciones)}`)

    const mercado_objetivo_exportaciones = datos_reporte?.mercadoObjetivo?.exportaciones
      ?.filter(im => im?.pais && im?.porcentaje != null)
      .map(im => ({ pais: im.pais, porcentaje: im.porcentaje })) ?? [];
    logger.info(`${fileMethod} | ${customUuid} | Mercado objetivo Exportaciones: ${JSON.stringify(mercado_objetivo_exportaciones)}`)

    // Preparamos datos

    const infoEmpresa = await certificationService.consultaEmpresaInfo(idEmpresa)
    if (infoEmpresa.result.length == 0) {
      logger.info(`${fileMethod} | ${customUuid} | No se pudo obtener la empresa ${JSON.stringify(infoEmpresa)}`)
      return null
    }
    logger.info(`${fileMethod} | ${customUuid} | Información de la empresa contador?: ${JSON.stringify(infoEmpresa.result[0].contador_konesh)}`)
    logger.info(`${fileMethod} | ${customUuid} | Información de la empresas ${JSON.stringify(infoEmpresa.result[0].valores)}`)

    const infoBasica = await certificationService.consultaEmpresaPerfil(idEmpresa);
    if (!infoBasica?.result?.[0] || Object.keys(infoBasica.result[0]).length === 0) {
      logger.warn(`${fileMethod} | ${customUuid} | No se encontró información básica de la empresa`);
    }
    logger.info(`${fileMethod} | ${customUuid} | Información de la empresas basica ${JSON.stringify(infoBasica?.result?.[0] && Object.keys(infoBasica.result[0]).length > 0)}`)

    logger.info(`${fileMethod} | ${customUuid} | Información de la empresa básica: ${JSON.stringify(infoBasica.result[0])}`);

    const { strHTML } = idEmpresa;

    const actividad_economica = await certificationService.getIndustriaNombre(idEmpresa)
    logger.info(`${fileMethod} | ${customUuid} | Información de actividad_economica ${JSON.stringify(actividad_economica)}`)


    let strHTML_paso = '<html>';
    strHTML_paso += ' <head>';
    strHTML_paso += ' </head>';
    strHTML_paso += ' <body>';
    strHTML_paso += '  Hola Mundo !!!! ';
    strHTML_paso += ' </body>';
    strHTML_paso += ' </html>';

    logger.info(`${fileMethod} | ${customUuid} | strHTML_paso: ${JSON.stringify(strHTML_paso)}`)

    // Verificar y crear el directorio si no existe
    const tempDir = path.join(__dirname, '../../temp')
    logger.info(`${fileMethod} | ${customUuid} | Directorio temporal: ${JSON.stringify(tempDir)}`)

    try {
      await fsp.access(tempDir);
    } catch {
      await fsp.mkdir(tempDir, { recursive: true });
    }

    // let rutaArchivo = 'generatorPDF/testPDF';
    const rutaPlantilla = path.join(__dirname, '../../temp/plantilla.html')
    logger.info(`${fileMethod} | ${customUuid} | Ruta de la plantilla: ${JSON.stringify(rutaPlantilla)}`)

    //const rutaArchivo = path.join(__dirname, '../../temp/testPDF')

    const rutaArchivo = path.join(__dirname, '../../temp/ReporteCredito_' + encabezado.rfc)
    logger.info(`${fileMethod} | ${customUuid} | Ruta del archivo: ${JSON.stringify(rutaArchivo)}`)

    // Crear una cadena con todas las razones sociales
    const razonesSociales = referencias_comerciales
      .map(item =>
        `<tr>
          <td style="padding: 8px; border: 1px solid #ddd; color: #0a3d8e;">${item.razon_social}</td>
          <td style="padding: 8px; border: 1px solid #ddd; color: #0a3d8e;">${item.rfc}</td>
          <td style="padding: 8px; border: 1px solid #ddd; color: #0a3d8e;">${item.calificacion_referencia}</td>
          
        </tr>`
      )
      .join('');
    logger.info(`${fileMethod} | ${customUuid} | Plantilla Referencia prueba: ${razonesSociales}`)

    let location = null

    strHTML_paso = await fsp.readFile(rutaPlantilla, 'utf8')
    logger.info(`${fileMethod} | ${customUuid} | Lectura del archivo: ${JSON.stringify(strHTML_paso)}`)

    const _fecha_elaboracion = new Date().toISOString().substring(0, 10)
    logger.info(`Fecha de elaboración: ${JSON.stringify(_fecha_elaboracion)}`)

    const idCertification = _certification.certificacion[0].id_certification
    logger.info(`${fileMethod} | ${customUuid} | Id de certificación: ${JSON.stringify(idCertification)}`)

    const compartir_info_empresa = await certificationService.getCertificacionPartidaFinanciera(idCertification);
    const soloCompartirInfoEmpresa = compartir_info_empresa?.result?.[0]?.compartir_info_empresa;

    logger.info(`${fileMethod} | ${customUuid} | compartir_info_empresa del primer objeto: ${soloCompartirInfoEmpresa}`);

    const [calculos_estado_balance] = await certificationService.getCalculoEstadoBalance(idCertification)
    logger.info(`${fileMethod} | ${customUuid} | Calculo del estado de balance: ${JSON.stringify(calculos_estado_balance)}`)

    const [calculos_estado_resultados] = await certificationService.getCalculoEstadoResultado(idCertification)
    logger.info(`${fileMethod} | ${customUuid} | Calculo del estado de resultados: ${JSON.stringify(calculos_estado_resultados)}`)

    /* Bloque alertas preventivas de reserva */
    /* 
    Este bloque se encarga de traer las Alertas cuantitativas utilizando certificationService.getVariacionesSignificativasByCertification el cual requiere el id de certificación
    */
    const [variacionesList] = await certificationService.getVariacionesSignificativasByCertification(id_certification);
    logger.info(`${fileMethod} | ${customUuid} | Resultado de: ${JSON.stringify(variacionesList)}`);
    let resultado = null;

    try {
      const variacionesList = await certificationService.getVariacionesSignificativasByCertification(id_certification);

      if (!Array.isArray(variacionesList) || variacionesList.length === 0) {
        logger.warn(`${fileMethod} | ${customUuid} | No se encontraron variaciones significativas`);
      } else {
        const variaciones = variacionesList[0];

        resultado = {
          incremento_caja_bancos: variaciones.incremento_caja_bancos ?? "-",
          incremento_ventas_anuales: variaciones.incremento_ventas_anuales ?? "-",
          decremento_costo_ventas_anuales: variaciones.decremento_costo_ventas_anuales ?? "-",
          decremento_gastos_administracion: variaciones.decremento_gastos_administracion ?? "-",
          incremento_utilidad_operativa: variaciones.incremento_utilidad_operativa ?? "-",
          incremento_total_activo: variaciones.incremento_total_activo ?? "-",
          decremento_total_pasivo: variaciones.decremento_total_pasivo ?? "-",
          incremento_capital_social: variaciones.incremento_capital_social ?? "-",
          decremento_capital_social: variaciones.decremento_capital_social ?? "-",
          incremento_capital_contable: variaciones.incremento_capital_contable ?? "-",
          decremento_capital_contable: variaciones.decremento_capital_contable ?? "_",
        };
      }
    } catch (error) {
      logger.error(`${fileMethod} | ${customUuid} | Error al obtener variaciones: ${error.message}`);
    }

    // Aquí puedes usarla sin error
    if (resultado) {
      logger.info(`${fileMethod} | ${customUuid} | Resultado de variaciones: ${JSON.stringify(resultado)}`);
    } else {
      logger.info(`${fileMethod} | ${customUuid} | No se pudo calcular el resultado de variaciones`);
    }
    /* FIN Bloque alertas preventivas de reserva */


    const result = await certificationService.getRatiosFnancieros(idCertification);
    const ratios_financiero = Array.isArray(result) ? result[0] : undefined;

    if (!ratios_financiero) {
      logger.warn(`${fileMethod} | ${customUuid} | Ratios @financiero: NO DATA`);
    } else {
      logger.info(`${fileMethod} | ${customUuid} | Ratios @financiero: ${JSON.stringify(ratios_financiero)}`);
    }

    const empresas_relacionadass = await certificationService.getEmpresasRelacionadasByCertification(idCertification);
    logger.info(`${fileMethod} | ${customUuid} | Empresas Relacionadasss: ${JSON.stringify(empresas_relacionadass)}`);

    const rotacion_ctas_x_cobrar = await getScoreRotacionCtasXCobrasScore(id_certification, customUuid)
    let { periodo_anterior, periodo_previo_anterior } = rotacion_ctas_x_cobrar;

    const anioActual = new Date().getFullYear();

    periodo_anterior = periodo_anterior ?? (anioActual - 1);
    periodo_previo_anterior = periodo_previo_anterior ?? (anioActual - 2);

    logger.info(`${fileMethod} | ${customUuid} | rotacion_ctas_x_cobrarsss: ${JSON.stringify(periodo_anterior)}`);
    logger.info(`${fileMethod} | ${customUuid} | rotacion_ctas_x_cobrarsss: ${JSON.stringify(periodo_previo_anterior)}`);

    // Verificar la longitud de 'result' antes de mapear
    logger.info(`${fileMethod} | ${customUuid} | Número de empresas relacionadas: ${empresas_relacionadass.result.length}`);

    const {
      emp_id,
      giro,
      valores,
      proposito,
      emp_desc,
      emp_mision,
      emp_vision
    } = infoBasica?.result?.[0] || {};

    const empresasRelacion = empresas_relacionadass.result.map(item => ({
      razon_social: item.razon_social,
      pais: item.pais
    }));

    logger.info(`${fileMethod} | ${customUuid} | Mirandos: ${empresasRelacion}`);

    // Crear una cadena con todas las razones sociales
    const empresasRelaciones = empresasRelacion
      .map(item =>
        `<tr>
          <td style="padding: 8px; border: 1px solid #ddd; color: #0a3d8e;">${item.razon_social}</td>
          <td style="padding: 8px; border: 1px solid #ddd; color: #0a3d8e;">${item.pais}</td>
        </tr>`
      )
      .join('');

    logger.info(`${fileMethod} | ${customUuid} | Plantilla Referencia prueba: ${empresasRelaciones}`);


    strHTML_paso = strHTML_paso.replace('{_fecha_elaboracion_}', _fecha_elaboracion)

    /* Validaciones para mostrar alertas */
    const endeudamiento_comer = resultados.porcentaje_endeudamiento_comercial !== "-" || resultados.porcentaje_endeudamiento_comercial_descripcion !== "-" ?
      `
          <div style="display: flex; margin-bottom: 10px; margin-top: 3rem; page-break-before: always;">
            <p
              style="
                margin: 2.5px 0px;
                color: #0a3d8e;
                font-weight: 700;
                font-size: 18px;
                text-transform: uppercase;
                margin-top: 20px;
              "
            >
              ALERTA DE ENDEUDAMIENTO COMERCIAL
            </p>
          </div>

          <div style="display: flex; flex-direction: column;">
            <p
              style="
                font-size: 12px;
                color: #000;
                font-weight: 600;
                margin: 0px;
                margin-bottom: 5px;
              "
            >
              De acuerdo a nuestras bases de información la empresa se sitúa
              en un siguiente nivel de endeudamiento comercial en relación ala
              facturación total anual de sus proveedores.
            </p>
          </div>

          <div style="display: flex; flex-direction: column;">
            
           
            <div
              style="
                display: grid;
                grid-template-columns: 1fr 5fr;
                padding: 14px 0px;
                border-bottom: 2px solid #0a3d8e;
              "
            >
              <div
                style="
                  display: flex;
                  justify-content: center;
                  align-items: center;
                "
              >
                <p
                  style="
                    margin: 5px 0px;
                    color: #ffb100;
                    font-weight: 700;
                    font-size: 25px;
                  "
                >
                  {_resultados_porcentaje_endeudamiento_comercial_}
                </p>
              </div>
              <div style="display: flex; align-items: center;">
                <p
                  style="
                    font-size: 12px;
                    color: #000;
                    font-weight: 600;
                    margin: 0px;
                    margin: 5px 0px;
                  "
                >
                  {_resultados_porcentaje_endeudamiento_comercial_descripcion_}
                </p>
              </div>
            </div>
          </div> 
        `
      : '';

    /* Alertas condicionadas */
    const DSO_SUGERIDO = resultados.dias_recomendacion_DSO !== "-" || resultados.dias_recomendacion_DSO_descripcion !== "-" ? `
      <div style="display: flex; margin-bottom: 10px; margin-top: 2rem;">
              <p
                style="
                  margin: 2.5px 0px;
                  color: #0a3d8e;
                  font-weight: 700;
                  font-size: 18px;
                  text-transform: uppercase;
                "
              >
                RECOMENDACIÓN DE DSO SUGERIDO
              </p>
            </div>

            <div
              style="
                display: grid;
                grid-template-columns: 1fr 5fr;
                padding: 14px 0px;
                border-bottom: 2px solid #0a3d8e;
              "
            >
              <div
                style="
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  flex-direction: column;
                "
              >
                <p
                  style="
                    margin: 5px 0px;
                    color: #0a3d8e;
                    font-weight: 700;
                    font-size: 25px;
                  "
                >
                  {_resultados_dias_recomendacion_DSO_}
                </p>
                <p
                  style="
                    margin: 2.5px 0px;
                    color: #0a3d8e;
                    font-weight: 700;
                    font-size: 12px;
                  "
                >
                  dias
                </p>
              </div>
              <div
                style="
                  display: flex;
                  justify-content: center;
                  align-items: center;
                "
              >
                <p
                  style="
                    font-size: 12px;
                    color: #000;
                    font-weight: 600;
                    margin: 0px;
                    margin: 5px 0px;
                  "
                >
                  {_resultados_dias_recomendacion_DSO_descripcion_}
                </p>
              </div>
            </div> 
      `
      : '';
    /*Fin Alertas condicionadas */

    const mensaje_no_compartir = soloCompartirInfoEmpresa === 2
      ? `
        <section style="width: 100%; margin: 0px 0px; margin-top: 30px; margin-bottom: 1.5rem;">
        <div style="display: flex; flex-direction: column;">
          <h3
            style="
              font-size: 16px;
              font-weight: 700;
              color: #0a3d8e;
              text-transform: uppercase;
              margin: 0px !important;
              margin-bottom: 5px !important;
              text-transform: uppercase;
              
            "
          >
            SITUACIÓN Y PERFORMANCE FINANCIERO
          </h3>
        </div>
        <div style="display: flex; width: 100%; align-items: center;">
          <hr
            style="
              background: #0a3d8e;
              width: 97%;
              height: 2px;
              border: none;
              margin: 0px !important;
            "
          />
          <div
            style="
              height: 10px;
              width: 10px;
              border-radius: 50%;
              padding: 1px;
              background: #0a3d8e;
            "
          ></div>
        </div>
      </section>
        <div style="
         display: flex;
         flex-direction: column;
         justify-content: center;
         align-items: center;
         border: 4px solid #2ba2af;
         padding: 10px 15px;
         background: #f1f8ff;
         box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
         border-radius: 10px;
         margin-bottom: 1rem;
         ">
            <p style="color: #0a3d8e; font-size: 12px; font-weight: bold; margin-top: 10px; text-align: center;">
              ⚠️ Estimado cliente, le observamos que su comprador rechazo manera clara  no compartir información financiera.
            </p>
        </div>
      `
      : ``;

    const tabla_1 = soloCompartirInfoEmpresa === 1 ?
      `
      <section style="width: 100%; margin: 0px 0px; margin-top: 30px; margin-bottom: 1rem; page-break-before: always;">
  <div style="display: flex; flex-direction: column;">
    <h3 style="
              font-size: 16px;
              font-weight: 700;
              color: #0a3d8e;
              text-transform: uppercase;
              margin: 0px !important;
              margin-bottom: 5px !important;
              text-transform: uppercase;
              
            ">
      SITUACIÓN Y PERFORMANCE FINANCIERO
    </h3>
  </div>
  <div style="display: flex; width: 100%; align-items: center;">
    <hr style="
              background: #0a3d8e;
              width: 97%;
              height: 2px;
              border: none;
              margin: 0px !important;
            " />
    <div style="
              height: 10px;
              width: 10px;
              border-radius: 50%;
              padding: 1px;
              background: #0a3d8e;
            "></div>
  </div>
</section>

<div style="
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: flex-start;
            margin-bottom: 20px;
          ">
  <p style="
              color: #0a3d8e;
              margin: 0px;
              font-size: 12px;
              font-weight: 700;
            ">
    Partidas de Estado de Balance
  </p>
</div>



<div style="
            background: #ffff;
            /* box-shadow: 2px 2px 10px rgba(0, 0, 0, 0.3); */
            padding: 12px 12px;
            border: 1px solid #787878;
          ">
  <div style="
              display: grid;
              grid-template-columns: 3fr 1.5fr 1.5fr;
              padding: 2.5px 0px;
              border-bottom: 1px solid #787878;
            ">
    <div style="display: flex; align-items: flex-start;">
      <p style="
                  margin: 0px;
                  margin-bottom: 5px;
                  color: #2ba2af;
                  font-size: 12px;
                  font-weight: 700;
                ">
        Activo circulante
      </p>
    </div>
    <div style="display: flex; align-items: flex-start;">
      <p style="
                  margin: 0px;
                  margin-bottom: 5px;
                  color: #2ba2af;
                  font-size: 12px;
                  font-weight: 700;
                ">
        {_performance_financiero_balance_anio_anterior_indicador_}
      </p>
    </div>
    <div style="display: flex; align-items: flex-start;">
      <p style="
                  margin: 0px;
                  margin-bottom: 5px;
                  color: #2ba2af;
                  font-size: 12px;
                  font-weight: 700;
                ">
        {_performance_financiero_balance_anio_previo_anterior_indicador_}
      </p>
    </div>
  </div>
  <div>
    <div style="
                display: grid;
                grid-template-columns: 3fr 1.5fr 1.5fr;
                border-bottom: 1px solid #787878;
              ">
      <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    color: #0a3d8e;
                    font-size: 12px;
                    font-weight: 700;
                  ">
          Caja y Bancos:
        </p>
      </div>

      <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  ">
          {_performance_financiero_balance_anio_anterior_caja_bancos_}
        </p>
      </div>

      <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  ">
          {_performance_financiero_balance_anio_previo_anterior_caja_bancos_}
        </p>
      </div>
    </div>
    <div style="
                display: grid;
                grid-template-columns: 3fr 1.5fr 1.5fr;
                border-bottom: 1px solid #787878;
              ">
      <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    color: #0a3d8e;
                    font-size: 12px;
                    font-weight: 700;
                  ">
          Saldo de Clientes o cuentas por cobrar:
        </p>
      </div>

      <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  ">
          {_performance_financiero_balance_anio_anterior_saldo_clientes_}
        </p>
      </div>

      <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  ">
          {_performance_financiero_balance_anio_previo_anterior_saldo_clientes_}
        </p>
      </div>
    </div>
    <div style="
                display: grid;
                grid-template-columns: 3fr 1.5fr 1.5fr;
                border-bottom: 1px solid #787878;
              ">
      <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    color: #0a3d8e;
                    font-size: 12px;
                    font-weight: 700;
                  ">
          Saldo de Inventarios:
        </p>
      </div>

      <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  ">
          {_performance_financiero_balance_anio_anterior_saldo_inventarios_}
        </p>
      </div>

      <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  ">
          {_performance_financiero_balance_anio_previo_anterior_saldo_inventarios_}
        </p>
      </div>
    </div>
    <div style="
                display: grid;
                grid-template-columns: 3fr 1.5fr 1.5fr;
                border-bottom: 1px solid #787878;
              ">
      <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    color: #0a3d8e;
                    font-size: 12px;
                    font-weight: 700;
                  ">
          Saldo de deudores diversos:
        </p>
      </div>

      <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  ">
          {_performance_financiero_balance_anio_anterior_deudores_diversos_}
        </p>
      </div>

      <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  ">
          {_performance_financiero_balance_anio_previo_anterior_deudores_diversos_}
        </p>
      </div>
    </div>
    <div style="
                display: grid;
                grid-template-columns: 3fr 1.5fr 1.5fr;
                border-bottom: 1px solid #787878;
              ">
      <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    color: #0a3d8e;
                    font-size: 12px;
                    font-weight: 700;
                  ">
          Otros activos circulantes:
        </p>
      </div>

      <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  ">
          {_performance_financiero_balance_anio_anterior_otros_activos_}
        </p>
      </div>

      <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  ">
          {_performance_financiero_balance_anio_previo_anterior_otros_activos_}
        </p>
      </div>
    </div>
  </div>
</div>








<div style="
            background: #ffff;
            /* box-shadow: 2px 2px 10px rgba(0, 0, 0, 0.3); */
            padding: 12px 12px;
            border: 1px solid #787878;
          ">
  <div style="
              display: grid;
              grid-template-columns: 3fr 1.5fr 1.5fr;
              padding: 2.5px 0px;
              border-bottom: 1px solid #787878;
            ">
    <div style="display: flex; align-items: flex-start;">
      <p style="
                  margin: 0px;
                  margin-bottom: 5px;
                  color: #2ba2af;
                  font-size: 12px;
                  font-weight: 700;
                ">
        Activo fijo
      </p>
    </div>
    <div style="display: flex; align-items: flex-start;">
      <p style="
                  margin: 0px;
                  margin-bottom: 5px;
                  color: #2ba2af;
                  font-size: 12px;
                  font-weight: 700;
                ">
        {_performance_financiero_balance_anio_anterior_indicador_}
      </p>
    </div>
    <div style="display: flex; align-items: flex-start;">
      <p style="
                  margin: 0px;
                  margin-bottom: 5px;
                  color: #2ba2af;
                  font-size: 12px;
                  font-weight: 700;
                ">
        {_performance_financiero_balance_anio_previo_anterior_indicador_}
      </p>
    </div>
  </div>
  <div>
    <div style="
                display: grid;
                grid-template-columns: 3fr 1.5fr 1.5fr;
                border-bottom: 1px solid #787878;
              ">
      <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    color: #0a3d8e;
                    font-size: 12px;
                    font-weight: 700;
                  ">
          Propiedades y Equipo (Maquinaria , Equipo Terrenos, edificios, flotillas):
        </p>
      </div>

      <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  ">
          {_performance_financiero_balance_anio_anterior_total_activo_fijo_}
        </p>
      </div>

      <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  ">
          {_performance_financiero_balance_anio_previo_anterior_total_activo_fijo_}
        </p>
      </div>
    </div>
    <div style="
                display: grid;
                grid-template-columns: 3fr 1.5fr 1.5fr;
                border-bottom: 1px solid #787878;
              ">
      <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    color: #0a3d8e;
                    font-size: 12px;
                    font-weight: 700;
                  ">
          Activo Intangible:
        </p>
      </div>

      <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  ">
          {_performance_financiero_balance_anio_anterior_activo_intangible_}
        </p>
      </div>

      <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  ">
          {_performance_financiero_balance_anio_previo_anterior_activo_intangible_}
        </p>
      </div>
    </div>
    <div style="
                display: grid;
                grid-template-columns: 3fr 1.5fr 1.5fr;
                border-bottom: 1px solid #787878;
              ">
      <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    color: #0a3d8e;
                    font-size: 12px;
                    font-weight: 700;
                  ">
          Activo Diferido:
        </p>
      </div>

      <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  ">
          {_performance_financiero_balance_anio_anterior_activo_diferido_}
        </p>
      </div>

      <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  ">
          {_performance_financiero_balance_anio_previo_anterior_activo_diferido_}
        </p>
      </div>
    </div>
    <div style="
                display: grid;
                grid-template-columns: 3fr 1.5fr 1.5fr;
                border-bottom: 1px solid #787878;
              ">
      <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    color: #0a3d8e;
                    font-size: 12px;
                    font-weight: 700;
                  ">
          Otros activos fijos o de largo plazo:
        </p>
      </div>

      <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  ">
          {_performance_financiero_balance_anio_anterior_otros_activos_fijos_largo_plazo_}
        </p>
      </div>

      <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  ">
          {_performance_financiero_balance_anio_previo_anterior_otros_activos_fijos_largo_plazo_}
        </p>
      </div>
    </div>
  </div>
</div>








<div style="
            background: #ffff;
            /* box-shadow: 2px 2px 10px rgba(0, 0, 0, 0.3); */
            padding: 12px 12px;
            border: 1px solid #787878;
          ">
  <!-- Pasivo circulante -->
  <div style="
              display: grid;
              grid-template-columns: 3fr 1.5fr 1.5fr;
              padding: 2.5px 0px;
              border-bottom: 1px solid #787878;
            ">
    <div style="display: flex; align-items: flex-start;">
      <p style="
                  margin: 0px;
                  margin-bottom: 5px;
                  color: #2ba2af;
                  font-size: 12px;
                  font-weight: 700;
                ">
        Pasivo circulante
      </p>
    </div>
    <div style="display: flex; align-items: flex-start;">
      <p style="
                  margin: 0px;
                  margin-bottom: 5px;
                  color: #2ba2af;
                  font-size: 12px;
                  font-weight: 700;
                ">
        {_performance_financiero_balance_anio_anterior_indicador_}
      </p>
    </div>
    <div style="display: flex; align-items: flex-start;">
      <p style="
                  margin: 0px;
                  margin-bottom: 5px;
                  color: #2ba2af;
                  font-size: 12px;
                  font-weight: 700;
                ">
        {_performance_financiero_balance_anio_previo_anterior_indicador_}
      </p>
    </div>
  </div>
  <div>
    <div style="
                display: grid;
                grid-template-columns: 3fr 1.5fr 1.5fr;
                border-bottom: 1px solid #787878;
              ">
      <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    color: #0a3d8e;
                    font-size: 12px;
                    font-weight: 700;
                  ">
          Proveedores:
        </p>
      </div>

      <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  ">
          {_performance_financiero_balance_anio_anterior_proveedores_}
        </p>
      </div>

      <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  ">
          {_performance_financiero_balance_anio_previo_anterior_proveedores_}
        </p>
      </div>
    </div>
    <div style="
                display: grid;
                grid-template-columns: 3fr 1.5fr 1.5fr;
                border-bottom: 1px solid #787878;
              ">
      <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    color: #0a3d8e;
                    font-size: 12px;
                    font-weight: 700;
                  ">
          Acreedores y préstamos bancarios:
        </p>
      </div>

      <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  ">
          {_performance_financiero_balance_anio_anterior_acreedores_}
        </p>
      </div>

      <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  ">
          {_performance_financiero_balance_anio_previo_anterior_acreedores_}
        </p>
      </div>
    </div>
    <div style="
                display: grid;
                grid-template-columns: 3fr 1.5fr 1.5fr;
                border-bottom: 1px solid #787878;
              ">
      <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    color: #0a3d8e;
                    font-size: 12px;
                    font-weight: 700;
                  ">
          Impuestos por pagar:
        </p>
      </div>

      <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  ">
          {_performance_financiero_balance_anio_anterior_inpuestos_x_pagar_}
        </p>
      </div>

      <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  ">
          {_performance_financiero_balance_anio_previo_anterior_inpuestos_x_pagar_}
        </p>
      </div>
    </div>
    <div style="
                display: grid;
                grid-template-columns: 3fr 1.5fr 1.5fr;
                border-bottom: 1px solid #787878;
              ">
      <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    color: #0a3d8e;
                    font-size: 12px;
                    font-weight: 700;
                  ">
          Otros Pasivos de corto plazo:
        </p>
      </div>

      <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  ">
          {_performance_financiero_balance_anio_anterior_otros_pasivos_}
        </p>
      </div>

      <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  ">
          {_performance_financiero_balance_anio_previo_anterior_otros_pasivos_}
        </p>
      </div>
    </div>
  </div>
</div>







<div style="
            background: #ffff;
            /* box-shadow: 2px 2px 10px rgba(0, 0, 0, 0.3); */
            padding: 12px 12px;
            border: 1px solid #787878;
          ">
  <!-- Pasivo de Largo Plazo -->
  <div style="
              display: grid;
              grid-template-columns: 3fr 1.5fr 1.5fr;
              padding: 2.5px 0px;
              border-bottom: 1px solid #787878;
            ">
    <div style="display: flex; align-items: flex-start;">
      <p style="
                  margin: 0px;
                  margin-bottom: 5px;
                  color: #2ba2af;
                  font-size: 12px;
                  font-weight: 700;
                ">
        Pasivo de Largo Plazo
      </p>
    </div>
    <div style="display: flex; align-items: flex-start;">
      <p style="
                  margin: 0px;
                  margin-bottom: 5px;
                  color: #2ba2af;
                  font-size: 12px;
                  font-weight: 700;
                ">
        {_performance_financiero_balance_anio_anterior_indicador_}
      </p>
    </div>
    <div style="display: flex; align-items: flex-start;">
      <p style="
                  margin: 0px;
                  margin-bottom: 5px;
                  color: #2ba2af;
                  font-size: 12px;
                  font-weight: 700;
                ">
        {_performance_financiero_balance_anio_previo_anterior_indicador_}
      </p>
    </div>
  </div>
  <div>
    <div style="
                display: grid;
                grid-template-columns: 3fr 1.5fr 1.5fr;
                border-bottom: 1px solid #787878;
              ">
      <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    color: #0a3d8e;
                    font-size: 12px;
                    font-weight: 700;
                  ">
          Préstamos bancarios de largo plazo:
        </p>
      </div>

      <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  ">
          {_performance_financiero_balance_anio_anterior_total_pasivo_largo_plazo_}
        </p>
      </div>

      <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  ">
          {_performance_financiero_balance_anio_previo_anterior_total_pasivo_largo_plazo_}
        </p>
      </div>
    </div>
    <div style="
                display: grid;
                grid-template-columns: 3fr 1.5fr 1.5fr;
                border-bottom: 1px solid #787878;
              ">
      <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    color: #0a3d8e;
                    font-size: 12px;
                    font-weight: 700;
                  ">
          Otros pasivos de largo plazo:
        </p>
      </div>

      <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  ">
          {_performance_financiero_balance_anio_anterior_pasivo_diferido_}
        </p>
      </div>

      <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  ">
          {_performance_financiero_balance_anio_previo_anterior_pasivo_diferido_}
        </p>
      </div>
    </div>
  </div>
</div>








<div style="
            background: #ffff;
            /* box-shadow: 2px 2px 10px rgba(0, 0, 0, 0.3); */
            padding: 12px 12px;
            border: 1px solid #787878;
          ">
  <!-- Capital contable o patrimonio -->
  <div style="
              display: grid;
              grid-template-columns: 3fr 1.5fr 1.5fr;
              padding: 2.5px 0px;
              border-bottom: 1px solid #787878;
            ">
    <div style="display: flex; align-items: flex-start;">
      <p style="
                  margin: 0px;
                  margin-bottom: 5px;
                  color: #2ba2af;
                  font-size: 12px;
                  font-weight: 700;
                ">
        Capital contable o patrimonio
      </p>
    </div>
    <div style="display: flex; align-items: flex-start;">
      <p style="
                  margin: 0px;
                  margin-bottom: 5px;
                  color: #2ba2af;
                  font-size: 12px;
                  font-weight: 700;
                ">
        {_performance_financiero_balance_anio_anterior_indicador_}
      </p>
    </div>
    <div style="display: flex; align-items: flex-start;">
      <p style="
                  margin: 0px;
                  margin-bottom: 5px;
                  color: #2ba2af;
                  font-size: 12px;
                  font-weight: 700;
                ">
        {_performance_financiero_balance_anio_previo_anterior_indicador_}
      </p>
    </div>
  </div>
  <div>
    <div style="
                display: grid;
                grid-template-columns: 3fr 1.5fr 1.5fr;
                border-bottom: 1px solid #787878;
              ">
      <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    color: #0a3d8e;
                    font-size: 12px;
                    font-weight: 700;
                  ">
          Capital social:
        </p>
      </div>

      <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  ">
          {_performance_financiero_balance_anio_anterior_capital_social_}
        </p>
      </div>

      <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  ">
          {_performance_financiero_balance_anio_previo_anterior_capital_social_}
        </p>
      </div>
    </div>
    <div style="
                display: grid;
                grid-template-columns: 3fr 1.5fr 1.5fr;
                border-bottom: 1px solid #787878;
              ">
      <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    color: #0a3d8e;
                    font-size: 12px;
                    font-weight: 700;
                  ">
          Resultado de ejercicios anteriores:
        </p>
      </div>

      <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  ">
          {_performance_financiero_balance_anio_anterior_resultado_ejercicios_anteriores_}
        </p>
      </div>

      <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  ">
          {_performance_financiero_balance_anio_previo_anterior_resultado_ejercicios_anteriores_}
        </p>
      </div>
    </div>
    <div style="
                display: grid;
                grid-template-columns: 3fr 1.5fr 1.5fr;
                border-bottom: 1px solid #787878;
              ">
      <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    color: #0a3d8e;
                    font-size: 12px;
                    font-weight: 700;
                  ">
          Resultado de ejercicio:
        </p>
      </div>

      <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  ">
          {_performance_financiero_balance_anio_anterior_resultado_ejercicios_}
        </p>
      </div>

      <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  ">
          {_performance_financiero_balance_anio_previo_anterior_resultado_ejercicios_}
        </p>
      </div>
    </div>
    <div style="
                display: grid;
                grid-template-columns: 3fr 1.5fr 1.5fr;
                border-bottom: 1px solid #787878;
              ">
      <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    color: #0a3d8e;
                    font-size: 12px;
                    font-weight: 700;
                  ">
          Otras cuentas de capital:
        </p>
      </div>

      <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  ">
          {_performance_financiero_balance_anio_anterior_otro_capital_}
        </p>
      </div>

      <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
        <p style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  ">
          {_performance_financiero_balance_anio_previo_anterior_otro_capital_}
        </p>
      </div>
    </div>
  </div>
  </div>
</div>

</div>
    `
      : '';

    const tabla_2 = soloCompartirInfoEmpresa === 1 ?
      `
      <div
          style="
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: flex-start;
            margin-bottom: 20px;
            break-inside: avoid;
            page-break-inside: avoid;
            page-break-before: always;
          "
        >
          <p
            style="
              color: #0a3d8e;
              margin: 0px;
              font-size: 12px;
              font-weight: 700;
            "
          >
           Partidas del estado de resultados
          </p>
        </div>
        <div
          style="
            background: #ffff;
            /* box-shadow: 2px 2px 10px rgba(0, 0, 0, 0.3); */
            padding: 12px 12px;
            border: 1px solid #787878;
            break-inside: avoid;
            page-break-inside: avoid;
          "
        >
          <div
            style="
              display: grid;
              grid-template-columns: 3fr 1.5fr 1.5fr;
              padding: 2.5px 0px;
              border-bottom: 1px solid #787878;
              break-inside: avoid;
              page-break-inside: avoid;
            "
          >
            <div style="display: flex; align-items: flex-start;">
              <p
                style="
                  margin: 0px;
                  margin-bottom: 5px;
                  color: #2ba2af;
                  font-size: 12px;
                  font-weight: 700;
                "
              >
                Indicador
              </p>
            </div>
            <div style="display: flex; align-items: flex-start;">
              <p
                style="
                  margin: 0px;
                  margin-bottom: 5px;
                  color: #2ba2af;
                  font-size: 12px;
                  font-weight: 700;
                "
              >
              {_performance_financiero_estado_resultados_anio_anterior_indicador_}
              </p>
            </div>
            <div style="display: flex; align-items: flex-start;">
              <p
                style="
                  margin: 0px;
                  margin-bottom: 5px;
                  color: #2ba2af;
                  font-size: 12px;
                  font-weight: 700;
                "
              >
              {_performance_financiero_estado_resultados_anio_previo_anterior_indicador_}
              </p>
            </div>
          </div>
          <div>
            <div
              style="
                display: grid;
                grid-template-columns: 3fr 1.5fr 1.5fr;
                border-bottom: 1px solid #787878;
                break-inside: avoid;
                page-break-inside: avoid;
              "
            >
              <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    color: #0a3d8e;
                    font-size: 12px;
                    font-weight: 700;
                  "
                >
                Ventas anuales:
                </p>
              </div>

              <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  "
                >
                {_performance_financiero_estado_resultados_anio_anterior_ventas_anuales_}
                </p>
              </div>

              <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  "
                >
                {_performance_financiero_estado_resultados_anio_previo_anterior_ventas_anuales_}
                </p>
              </div>
            </div>
            <div
              style="
                display: grid;
                grid-template-columns: 3fr 1.5fr 1.5fr;
                border-bottom: 1px solid #787878;
                break-inside: avoid;
                page-break-inside: avoid;
              "
            >
              <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    color: #0a3d8e;
                    font-size: 12px;
                    font-weight: 700;
                  "
                >
                Costo de ventas anual:
                </p>
              </div>

              <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  "
                >
                {_performance_financiero_estado_resultados_anio_anterior_costo_ventas_anuales_}
                </p>
              </div>

              <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  "
                >
                {_performance_financiero_estado_resultados_anio_previo_anterior_costo_ventas_anuales_}
                </p>
              </div>
            </div>
            <div
              style="
                display: grid;
                grid-template-columns: 3fr 1.5fr 1.5fr;
                border-bottom: 1px solid #787878;
                break-inside: avoid;
                page-break-inside: avoid;
              "
            >
              <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    color: #0a3d8e;
                    font-size: 12px;
                    font-weight: 700;
                  "
                >
                Utilidad bruta:
                </p>
              </div>

              <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  "
                >
                {_performance_financiero_estado_resultados_anio_anterior_utilidad_bruta_}
                </p>
              </div>

              <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  "
                >
                {_performance_financiero_estado_resultados_anio_previo_anterior_utilidad_bruta_}
                </p>
              </div>
            </div>
            <div
              style="
                display: grid;
                grid-template-columns: 3fr 1.5fr 1.5fr;
                border-bottom: 1px solid #787878;
                break-inside: avoid;
                page-break-inside: avoid;
              "
            >
              <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    color: #0a3d8e;
                    font-size: 12px;
                    font-weight: 700;
                  "
                >
                Gastos de Administración:
                </p>
              </div>

              <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  "
                >
                {_performance_financiero_estado_resultados_anio_anterior_gastos_administracion_}
                </p>
              </div>

              <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  "
                >
                {_performance_financiero_estado_resultados_anio_previo_anterior_gastos_administracion_}
                </p>
              </div>
            </div>
            <div
              style="
                display: grid;
                grid-template-columns: 3fr 1.5fr 1.5fr;
                border-bottom: 1px solid #787878;
                break-inside: avoid;
                page-break-inside: avoid;
              "
            >
              <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    color: #0a3d8e;
                    font-size: 12px;
                    font-weight: 700;
                  "
                >
                Utilidad Operativa:
                </p>
              </div>

              <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  "
                >
                {_performance_financiero_estado_resultados_anio_anterior_utilidad_operativa_}
                </p>
              </div>

              <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  "
                >
                {_performance_financiero_estado_resultados_anio_previo_anterior_utilidad_operativa_}
                </p>
              </div>
            </div>
            <div
              style="
                display: grid;
                grid-template-columns: 3fr 1.5fr 1.5fr;
                border-bottom: 1px solid #787878;
                break-inside: avoid;
                page-break-inside: avoid;
              "
            >
              <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    color: #0a3d8e;
                    font-size: 12px;
                    font-weight: 700;
                  "
                >
                Depreciación y Amortización:
                </p>
              </div>

              <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  "
                >
                {_performance_financiero_estado_resultados_anio_anterior_depreciacion_amortizacion_}
                </p>
              </div>

              <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  "
                >
                {_performance_financiero_estado_resultados_anio_previo_anterior_depreciacion_amortizacion_}
                </p>
              </div>
            </div>
            <div
              style="
                display: grid;
                grid-template-columns: 3fr 1.5fr 1.5fr;
                border-bottom: 1px solid #787878;
                break-inside: avoid;
                page-break-inside: avoid;
              "
            >
              <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    color: #0a3d8e;
                    font-size: 12px;
                    font-weight: 700;
                  "
                >
                Otros ingresos:
                </p>
              </div>

              <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  "
                >
                {_performance_financiero_estado_resultados_anio_anterior_otros_ingresos_}
                </p>
              </div>

              <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  "
                >
                {_performance_financiero_estado_resultados_anio_previo_anterior_otros_ingresos_}
                </p>
              </div>
            </div>
            <div
              style="
                display: grid;
                grid-template-columns: 3fr 1.5fr 1.5fr;
                border-bottom: 1px solid #787878;
                break-inside: avoid;
                page-break-inside: avoid;
              "
            >
              <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    color: #0a3d8e;
                    font-size: 12px;
                    font-weight: 700;
                  "
                >
                Otros Gastos:
                </p>
              </div>

              <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  "
                >
                {_performance_financiero_estado_resultados_anio_anterior_otros_gastos_}
                </p>
              </div>

              <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  "
                >
                {_performance_financiero_estado_resultados_anio_previo_anterior_otros_gastos_}
                </p>
              </div>
            </div>
            <div
              style="
                display: grid;
                grid-template-columns: 3fr 1.5fr 1.5fr;
                border-bottom: 1px solid #787878;
                break-inside: avoid;
                page-break-inside: avoid;
              "
            >
              <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    color: #0a3d8e;
                    font-size: 12px;
                    font-weight: 700;
                  "
                >
                Gastos o Ingresos de productos financieros:
                </p>
              </div>

              <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  "
                >
                {_performance_financiero_estado_resultados_anio_anterior_gastos_productos_financieros_}
                </p>
              </div>

              <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  "
                >
                {_performance_financiero_estado_resultados_anio_previo_anterior_gastos_productos_financieros_}
                </p>
              </div>
            </div>
            <div
              style="
                display: grid;
                grid-template-columns: 3fr 1.5fr 1.5fr;
                border-bottom: 1px solid #787878;
                break-inside: avoid;
                page-break-inside: avoid;
              "
            >
              <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    color: #0a3d8e;
                    font-size: 12px;
                    font-weight: 700;
                  "
                >
                Otros Egresos:
                </p>
              </div>

              <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  "
                >
                {_performance_financiero_estado_resultados_anio_anterior_otros_egresos_}
                </p>
              </div>

              <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  "
                >
                {_performance_financiero_estado_resultados_anio_previo_anterior_otros_egresos_}
                </p>
              </div>
            </div>
            <div
              style="
                display: grid;
                grid-template-columns: 3fr 1.5fr 1.5fr;
                border-bottom: 1px solid #787878;
                break-inside: avoid;
                page-break-inside: avoid;
              "
            >
              <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    color: #0a3d8e;
                    font-size: 12px;
                    font-weight: 700;
                  "
                >
                Utilidad Neta:
                </p>
              </div>

              <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  "
                >
                {_performance_financiero_estado_resultados_anio_anterior_utilidad_neta_}
                </p>
              </div>

              <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: 500;
                  "
                >
                {_performance_financiero_estado_resultados_anio_previo_anterior_utilidad_neta_}
                </p>
              </div>
            </div>
          </div>
        </div>
    `
      : '';

    const m_o_p_c = mercado_objetivo_principales_clientes.length > 0 ? `
      <section style="width: 100%; margin-top: 40px;">
        <div style="display: flex; flex-direction: column; justify-content: center; align-items: flex-start; margin-bottom: 20px;">
          <p style="color: #0a3d8e; margin: 0px; font-size: 12px; font-weight: 700;">Principales Clientes</p>
        </div>
        <div style="background: #fff; padding: 12px;">
          <div style="display: grid; grid-template-columns: 2fr 1.5fr 1.5fr 1.5fr; padding: 2.5px 0px; border-bottom: 1px solid #787878;">
            <div><p style="margin: 0px 0px 5px; color: #2ba2af; font-size: 12px; font-weight: 700;">Nombre de Empresa</p></div>
            <div><p style="margin: 0px 0px 5px; color: #2ba2af; font-size: 12px; font-weight: 700;">Años de Relación</p></div>
            <div><p style="margin: 0px 0px 5px; color: #2ba2af; font-size: 12px; font-weight: 700;">País</p></div>
            <div><p style="margin: 0px 0px 5px; color: #2ba2af; font-size: 12px; font-weight: 700;">Sector al que pertenece</p></div>
          </div>

          {_mercado_objetivo_clientes_}
        </div>  
      </section>
    ` : '';


    const referenciasValidas = Array.isArray(referencias_comerciales)
      ? referencias_comerciales.filter(ref =>
        ref && (
          ref.rfc ||
          ref.razon_social ||
          ref.calificacion_referencia ||
          ref.linea_credito ||
          ref.porcentaje_deuda ||
          ref.dias_atraso
        )
      )
      : [];


    const filasReferencias = referenciasValidas.map(ref => `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${ref.rfc || '-'}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${ref.razon_social || '-'}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${ref.calificacion_referencia || '-'}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${ref.linea_credito || '-'}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${ref.porcentaje_deuda || '-'}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${ref.dias_atraso || '-'}</td>
      </tr>
    `).join('');


    const REFERENCIAS_C = referenciasValidas.length > 0
      ? `
    <section style="width: 100%; margin-top: 60px;">
      <div style="display: flex; flex-direction: column;">
        <h3 style="font-size: 16px; font-weight: 700; color: #0a3d8e; text-transform: uppercase; margin: 0 0 5px 0;">
          REFERENCIAS COMERCIALES
        </h3>
      </div>
      <div style="background-color: #f1f8ff; border-left: 5px solid #2ba2af; padding: 10px 20px; margin-bottom: 10px; width: 100%;">
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px;">
          <thead>
            <tr style="background-color: #2ba2af; color: white; text-align: left;">
              <th style="padding: 8px; border: 1px solid #ddd;">RFC</th>
              <th style="padding: 8px; border: 1px solid #ddd;">Razón Social</th>
              <th style="padding: 8px; border: 1px solid #ddd;">Calificación</th>
              <th style="padding: 8px; border: 1px solid #ddd;">Línea de Crédito</th>
              <th style="padding: 8px; border: 1px solid #ddd;">Porcentaje de Deuda</th>
              <th style="padding: 8px; border: 1px solid #ddd;">Días de Atraso</th>
            </tr>
          </thead>
          <tbody>
            ${filasReferencias}
          </tbody>
        </table>
      </div>
    </section>
  `
      : '';
    const filasReferenciasDetalladas = (datos_reporte?.referenciasComerciales || []).map(ref => `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${ref.rfc || '-'}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${ref.razon_social || '-'}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${ref.denominacion || '-'}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${ref.codigo_postal || '-'}</td>
      </tr>
    `).join('');

    let REFERENCIAS_CONSIDERADAS = '';
    if (filasReferenciasDetalladas) {
      REFERENCIAS_CONSIDERADAS = `
    <section style="width: 100%; margin-top: 20px;">
      <div style="display: flex; flex-direction: column;">
        <h3 style="font-size: 16px; font-weight: 700; color: #0a3d8e; text-transform: uppercase; margin: 0 0 5px 0;">
          REFERENCIAS COMERCIALES RELACIONADAS
        </h3>
      </div>
      <div style="background-color: #f9f9f9; border-left: 5px solid #2ba2af; padding: 10px 20px; margin-bottom: 10px; width: 100%;">
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px;">
          <thead>
            <tr style="background-color: #2ba2af; color: white; text-align: left;">
              <th style="padding: 8px; border: 1px solid #ddd;">RFC</th>
              <th style="padding: 8px; border: 1px solid #ddd;">Razón Social</th>
              <th style="padding: 8px; border: 1px solid #ddd;">Denominación</th>
              <th style="padding: 8px; border: 1px solid #ddd;">Código Postal</th>
            </tr>
          </thead>
          <tbody>
            ${filasReferenciasDetalladas}
          </tbody>
        </table>
      </div>
    </section>
  `;
    }


    const cuerpoImportaciones = mercado_objetivo_importaciones.map(im => `
    <div
      style="display: grid; grid-template-columns: 3fr 1.5fr 1.5fr; padding: 2.5px 0px; border-bottom: 1px solid #ccc;">
      <div><p style="margin: 0px; font-size: 12px;">${im.pais}</p></div>
      <div><p style="margin: 0px; font-size: 12px;">${im.porcentaje}%</p></div>
    </div>
    `).join('');

    const imPortaciones = mercado_objetivo_importaciones?.length > 0 ? `
      <div style="display: flex; flex-direction: column; justify-content: center; align-items: flex-start; margin-bottom: 20px;">
        <p style="color: #0a3d8e; margin: 0px; font-size: 12px; font-weight: 700;">Importaciones</p>
      </div>
      <div style="display: grid; grid-template-columns: 3fr 1.5fr 1.5fr; padding: 2.5px 0px; border-bottom: 1px solid #787878;">
        <div style="display: flex; align-items: flex-start;">
          <p style="margin: 0px; margin-bottom: 5px; color: #2ba2af; font-size: 12px; font-weight: 700;">País</p>
        </div>
        <div style="display: flex; align-items: flex-start;">
          <p style="margin: 0px; margin-bottom: 5px; color: #2ba2af; font-size: 12px; font-weight: 700;">Porcentaje</p>
        </div>
      </div>
      ${cuerpoImportaciones}
    ` : '';

    const cuerpoExportaciones = mercado_objetivo_exportaciones.map(im => `
    <div
      style="display: grid; grid-template-columns: 3fr 1.5fr 1.5fr; padding: 2.5px 0px; border-bottom: 1px solid #ccc;">
      <div><p style="margin: 0px; font-size: 12px;">${im.pais}</p></div>
      <div><p style="margin: 0px; font-size: 12px;">${im.porcentaje}%</p></div>
    </div>
    `).join('');

    const imExportaciones = mercado_objetivo_exportaciones?.length > 0 ? `
      <div style="display: flex; flex-direction: column; justify-content: center; align-items: flex-start; margin-bottom: 20px; margin-top: 20px">
        <p style="color: #0a3d8e; margin: 0px; font-size: 12px; font-weight: 700;">Exportaciones</p>
      </div>
      <div style="display: grid; grid-template-columns: 3fr 1.5fr 1.5fr; padding: 2.5px 0px; border-bottom: 1px solid #787878;">
        <div style="display: flex; align-items: flex-start;">
          <p style="margin: 0px; margin-bottom: 5px; color: #2ba2af; font-size: 12px; font-weight: 700;">País</p>
        </div>
        <div style="display: flex; align-items: flex-start;">
          <p style="margin: 0px; margin-bottom: 5px; color: #2ba2af; font-size: 12px; font-weight: 700;">Porcentaje</p>
        </div>
      </div>
      ${cuerpoExportaciones}
    ` : '';


    const lineaCreditoLimpio = limpiarCampo(resumen.linea_credito) ?
      `
        <p
                style="
                  font-size: 12px;
                  text-align: start;
                  font-weight: 500;
                  margin: 0px !important;
                "
              >
                {_resumen_linea_credito_}
        </p>
      `
      : '';

    const paisLimpio = limpiarCampo(encabezado.pais);
    paisLimpio ?
      `
        <p
              style="
                font-size: 12px;
                font-weight: 500;
                margin: 0px !important;
                margin-bottom: 5px !important;
              "
            >
              {_pais_}
            </p>
      `
      : '';

    const telefonoLimpio = limpiarCampo(encabezado.telefono);
    telefonoLimpio ?
      `
        <p
              style="
                font-size: 12px;
                font-weight: 500;
                margin: 0px !important;
                margin-top: 15px !important;
                margin-bottom: 5px !important;
              "
            >
              {_telefono_}
        </p>
      `
      : '';

    const correoLimpio = limpiarCampo(encabezado.correo);
    correoLimpio ?
      `
        <p
              style="
                font-size: 12px;
                font-weight: 500;
                margin: 0px !important;
                margin-bottom: 5px !important;
              "
            >
              Correo: {_correo_}
            </p>
      `
      : '';

    const empresasRelacionadasData = empresas_relacionadass?.result;

    const empresasRelacionadasItems = (empresasRelacionadasData?.length > 0 ? empresasRelacionadasData : [{ razon_social: '-', pais: '-' }])
      .map(empresa => `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">${empresa?.razon_social || '-'}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${empresa?.pais || '-'}</td>
        </tr>
      `).join('');

    const empresas_relacionadad = empresas_relacionadass?.result?.length > 0 ?
      `
      <div style="display: flex; flex-direction: column;">
        <h5 style="text-transform: uppercase; background-color: #f1f8ff; padding: 8px 12px; border-left: 4px solid #2ba2af; margin-bottom: 20px; color: #2ba2af;">
          Empresas Relacionadas
        </h5>
      </div>
      <div style="background-color: #f1f8ff; border-left: 5px solid #2ba2af; padding: 10px 20px; margin-bottom: 10px; width: 100%;">
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px;">
          <thead>
            <tr style="background-color: #2ba2af; color: white; text-align: left;">
              <th style="padding: 8px; border: 1px solid #ddd;">Razón Social</th>
              <th style="padding: 8px; border: 1px solid #ddd;">País</th>
            </tr>
          </thead>
          <tbody>
            ${empresasRelacionadasItems}
          </tbody>
        </table>
      </div>
    `
      : '';

    const empresas_info_basica =
      `<div style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; line-height: 1.5; color: #333; max-width: 100%; margin: 30px 0;">
  
          <h4 style="text-transform: uppercase; background-color: #f1f8ff; padding: 8px 12px; border-left: 4px solid #2ba2af; margin-bottom: 20px; color: #2ba2af;">
            Información de Identidad Empresarial
          </h4>
  
          <div style="margin-bottom: 15px;">
            <span style="font-weight: 600; color: #0a3d8e;">Actividad / Giro:</span><br>
            <span style="margin: 0; color: #555; font-size: 12px;">${infoBasica?.result?.[0]?.giro || '-'}</span>
          </div>
  
          <div style="margin-bottom: 15px;">
            <span style="font-weight: 600; color: #0a3d8e;">Valores:</span><br>
            <span style="margin: 0; color: #555; font-size: 12px;">${infoBasica?.result?.[0]?.valores || '-'}</span>
          </div>
  
          <div style="margin-bottom: 15px;">
            <span style="font-weight: 600; color: #0a3d8e;">Propósito:</span><br>
            <span style="margin: 0; color: #555; font-size: 12px;">${infoBasica?.result?.[0]?.proposito || '-'}</span>
          </div>
  
          <h4 style="text-transform: uppercase; background-color: #f1f8ff; padding: 8px 12px; border-left: 4px solid #2ba2af; margin-top: 30px; margin-bottom: 20px; color: #2ba2af;">
            Misión, Visión y Descripción
          </h4>
  
          <div style="margin-bottom: 15px;">
            <span style="font-weight: 600; color: #0a3d8e;">Descripción:</span><br>
            <span style="margin: 0; color: #555; font-size: 12px;">${infoBasica?.result?.[0]?.emp_desc || '-'}</span>
          </div>
  
          <div style="margin-bottom: 15px;">
            <span style="font-weight: 600; color: #0a3d8e;">Misión:</span><br>
            <span style="margin: 0; color: #555; font-size: 12px;">${infoBasica?.result?.[0]?.emp_mision || '-'}</span>
          </div>
  
          <div style="margin-bottom: 15px;">
            <span style="font-weight: 600; color: #0a3d8e;">Visión:</span><br>
            <span style="margin: 0; color: #555; font-size: 12px;">${infoBasica?.result?.[0]?.emp_vision || '-'}</span>
          </div>
  
        </div>
      `
      ;

    const accionistasMayoritariosHTML = accionistas?.length > 0 ?
      `
        <div style="background: #fff; padding: 12px 12px; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; line-height: 1.5; color: #333; max-width: 100%; margin: 30px 0;">

          <h4 style="text-transform: uppercase; background-color: #f1f8ff; padding: 8px 12px; border-left: 4px solid #2ba2af; margin-bottom: 20px; color: #2ba2af;">
            Accionistas Mayoritarios
          </h4>

          <div style="display: grid; grid-template-columns: 3fr 1.5fr 1.5fr; padding: 2.5px 0px; border-bottom: 1px solid #787878; font-weight: 700; color: #2ba2af; font-size: 12px;">
            <div>Nombre</div>
            <div>Legal TAX ID</div>
          </div>

          ${accionistas.map(accionista => `
            <div style="display: grid; grid-template-columns: 3fr 1.5fr 1.5fr; padding: 2.5px 0px; border-bottom: 1px dashed #ccc;">
              <div style="font-size: 12px; color: #2ba2af;">${accionista.nombre || '-'}</div>
              <div style="font-size: 12px; color: #2ba2af;">${accionista.tax_id || '-'}</div>
            </div>
          `).join('')}
          
        </div>
      ` :
      `
      <div style="background: #fff; padding: 12px 12px; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; line-height: 1.5; color: #333; max-width: 100%; margin: 30px 0;">

      <h4 style="text-transform: uppercase; background-color: #f1f8ff; padding: 8px 12px; border-left: 4px solid #2ba2af; margin-bottom: 20px; color: #2ba2af;">
        Accionistas Mayoritarios
      </h4>

      <div style="display: grid; grid-template-columns: 3fr 1.5fr 1.5fr; padding: 2.5px 0px; border-bottom: 1px solid #787878; font-weight: 700; color: #2ba2af; font-size: 12px;">
        <div>Nombre</div>
        <div>Legal TAX ID</div>
      </div>

      ${(accionistas?.length > 0 ? accionistas : [{ nombre: '-', tax_id: '-' }])
        .map(accionista => `
          <div style="display: grid; grid-template-columns: 3fr 1.5fr 1.5fr; padding: 2.5px 0px; border-bottom: 1px dashed #ccc;">
            <div style="font-size: 12px; color: #2ba2af;">${accionista.nombre || '-'}</div>
            <div style="font-size: 12px; color: #2ba2af;">${accionista.tax_id || '-'}</div>
          </div>
        `).join('')
      }

    </div>
      `
      ;
    /* Fin Accionistas mayoritarios */
    /* Principales Directores  */
    const directoresPrincipalesHTML = `
      <div style="background: #fff; padding: 12px 12px; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; line-height: 1.5; color: #333; max-width: 100%; margin: 30px 0;">

        <h4 style="text-transform: uppercase; background-color: #f1f8ff; padding: 8px 12px; border-left: 4px solid #2ba2af; margin-bottom: 20px; color: #2ba2af;">
          Principales Directores
        </h4>

        <div style="display: grid; grid-template-columns: 3fr 1.5fr 1.5fr; padding: 2.5px 0px; border-bottom: 1px solid #787878; font-weight: 700; color: #2ba2af; font-size: 12px;">
          <div>Nombre</div>
          <div>Puesto</div>
          <div>Poder</div>
        </div>

        ${(principales_directores?.length > 0 ? principales_directores : [{ nombre: '-', puesto: '-', poder: '-' }])
        .map(director => `
            <div style="display: grid; grid-template-columns: 3fr 1.5fr 1.5fr; padding: 2.5px 0px; border-bottom: 1px dashed #ccc;">
              <div style="font-size: 12px; color: #2ba2af;">${director?.nombre || '-'}</div>
              <div style="font-size: 12px; color: #2ba2af;">${director?.puesto || '-'}</div>
              <div style="font-size: 12px; color: #2ba2af;">${director?.poder || '-'}</div>
            </div>
          `).join('')
      } 
      </div>
    `;
    /* Fin principales directores */

    /* Inicio Personal */
    const tiene_personal = estructura_personal.operativo > 0 || estructura_personal.administrativo > 0 || estructura_personal.directivo > 0;

    let html_personal = "";

    if (tiene_personal) {
      html_personal = `
        <div style="background: #fff; padding: 12px 12px; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; line-height: 1.5; color: #333; max-width: 100%; margin: 30px 0; page-break-before: always;">
          <h4 style="text-transform: uppercase; background-color: #f1f8ff; padding: 8px 12px; border-left: 4px solid #2ba2af; margin-bottom: 20px; color: #2ba2af;">
            Recursos Humanos
          </h4>
          <div
            style="
              background: #ffff;
              padding: 12px 12px;
            "
          >
            <div
              style="
                display: grid;
                grid-template-columns: 3fr 1.5fr 1.5fr;
                padding: 2.5px 0px;
                border-bottom: 1px solid #787878;
              "
            >
              <div style="display: flex; align-items: flex-start;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    color: #2ba2af;
                    font-size: 12px;
                    font-weight: 700;
                  "
                >
                  Personal operativo
                </p>
              </div>
              <div style="display: flex; align-items: flex-start;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    color: #2ba2af;
                    font-size: 12px;
                    font-weight: 700;
                  "
                >
                  Personal Administrativo
                </p>            
              </div>
              <div style="display: flex; align-items: flex-start;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    color: #2ba2af;
                    font-size: 12px;
                    font-weight: 700;
                  "
                >
                  Personal directivo
                </p>            
              </div>
            </div>
    
            <div
              style="
                display: grid;
                grid-template-columns: 3fr 1.5fr 1.5fr;
                padding: 2.5px 0px;
                border-bottom: 1px solid #787878;
              "
            >
              <div style="display: flex; align-items: flex-start;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    color: #2ba2af;
                    font-size: 11px;
                    font-weight: 400;
                  "
                >
                  ${estructura_personal.operativo}
                </p>
              </div>
              <div style="display: flex; align-items: flex-start;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    color: #2ba2af;
                    font-size: 11px;
                    font-weight: 400;
                  "
                >
                  ${estructura_personal.administrativo}
                </p>
              </div>
              <div style="display: flex; align-items: flex-start;">
                <p
                  style="
                    margin: 0px;
                    margin-bottom: 5px;
                    color: #2ba2af;
                    font-size: 11px;
                    font-weight: 400;
                  "
                >
                  ${estructura_personal.directivo}
                </p>
              </div>
            </div>
          </div>
        </div>
      `;
    }
    /* Fin Personal */

    /* Inicio Transporte */
    const tiene_transporte = equipo_transporte.carga > 0 || equipo_transporte.otros > 0;

    let html_transporte = `
            <div style="background: #fff; padding: 12px 12px; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; line-height: 1.5; color: #333; max-width: 100%; margin: 30px 0;">
              <h4 style="text-transform: uppercase; background-color: #f1f8ff; padding: 8px 12px; border-left: 4px solid #2ba2af; margin-bottom: 20px; color: #2ba2af;">
                Equipo de Transporte
              </h4>
              <div style="background: #ffff; padding: 12px 12px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; padding: 2.5px 0px; border-bottom: 1px solid #787878;">
                  <div style="display: flex; align-items: flex-start;">
                    <p style="margin: 0px; margin-bottom: 5px; color: #2ba2af; font-size: 12px; font-weight: 700;">
                      Flotilla carga especializada:
                    </p>
                  </div>
                  <div style="display: flex; align-items: flex-start;">
                    <p style="margin: 0px; margin-bottom: 5px; color: #2ba2af; font-size: 12px; font-weight: 700;">
                      Otros vehículos:
                    </p>
                  </div>
                </div>
        
                <div style="display: grid; grid-template-columns: 1fr 1fr; padding: 2.5px 0px; border-bottom: 1px solid #787878;">
                  <div style="display: flex; align-items: flex-start;">
                    <p style="margin: 0px; margin-bottom: 5px; color: #2ba2af; font-size: 11px; font-weight: 400;">
                      ${equipo_transporte.carga}
                    </p>
                  </div>
                  <div style="display: flex; align-items: flex-start;">
                    <p style="margin: 0px; margin-bottom: 5px; color: #2ba2af; font-size: 11px; font-weight: 400;">
                      ${equipo_transporte.otros}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          `;
    /* Fin trnasporte */

    /* Inicia Seguros */
    let html_seguros = '';

    const tiene_seguros = Array.isArray(seguros) && seguros.length > 0;

    const _seguros_ = tiene_seguros
      ? seguros.map(seguro => `
          <div
            style="display: grid; grid-template-columns: 3fr 1.5fr 1.5fr; padding: 2.5px 0px; border-bottom: 1px solid #e0e0e0;"
          >
            <div><p style="margin: 0 0 5px; color: #2ba2af; font-size: 11px;">${seguro.nombre_aseguradora || '-'}</p></div>
            <div><p style="margin: 0 0 5px; color: #2ba2af; font-size: 11px;">${seguro.bien_asegurado || '-'}</p></div>
            <div><p style="margin: 0 0 5px; color: #2ba2af; font-size: 11px;">${seguro.monto_asegurado != null ? `$${seguro.monto_asegurado.toLocaleString("es-MX")}` : '-'}</p></div>
          </div>
        `).join('')
      : `
          <div
            style="display: grid; grid-template-columns: 3fr 1.5fr 1.5fr; padding: 2.5px 0px; border-bottom: 1px solid #e0e0e0;"
          >
            <div><p style="margin: 0 0 5px; color: #2ba2af; font-size: 11px;">-</p></div>
            <div><p style="margin: 0 0 5px; color: #2ba2af; font-size: 11px;">-</p></div>
            <div><p style="margin: 0 0 5px; color: #2ba2af; font-size: 11px;">-</p></div>
          </div>
        `;
    html_seguros = `
      <div style="background: #fff; padding: 12px; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; line-height: 1.5; color: #333; max-width: 100%; margin: 30px 0;">
        <h4 style="text-transform: uppercase; background-color: #f1f8ff; padding: 8px 12px; border-left: 4px solid #2ba2af; margin-bottom: 20px; color: #2ba2af;">
          Seguros
        </h4>
          
        <div style="background: #fff; padding: 12px;">
          <div style="display: grid; grid-template-columns: 3fr 1.5fr 1.5fr; padding: 2.5px 0px; border-bottom: 1px solid #787878;">
            <div><p style="margin: 0 0 5px; color: #2ba2af; font-size: 12px; font-weight: 700;">Nombre de aseguradora</p></div>
            <div><p style="margin: 0 0 5px; color: #2ba2af; font-size: 12px; font-weight: 700;">Bien asegurado</p></div>
            <div><p style="margin: 0 0 5px; color: #2ba2af; font-size: 12px; font-weight: 700;">Monto asegurado</p></div>
          </div>
          ${_seguros_}
        </div>
      </div>
    `;
    /* Fin Seguros */

    const referenciasComerciales = (referencias_comerciales?.length > 0)
      ? `                          
        <div
                style="
                  width: 12px;
                  height: 12px;
                  border: 2px solid #c6c6c5;
                  padding: 0px;
                  background: #269e38;
                  border-radius: 50%;
                "
              ></div>
              <div style="display: flex; justify-content: flex-start;">
                <p
                  style="
                    font-size: 9px;
                    font-weight: 600;
                    color: #0a3d8e;
                    font-size: 12px;
                    text-align: start;
                    font-weight: 500;
                    margin: 0px !important;
                  "
                >
                  Referencias Comerciales
                </p>
              </div>
      ` :
      `
        <div
                style="
                  width: 12px;
                  height: 12px;
                  border: 2px solid #c6c6c5;
                  padding: 0px;
                  background: #dd1212;
                  border-radius: 50%;
                "
              ></div>
              <div style="display: flex; justify-content: flex-start;">
                <p
                  style="
                    font-size: 9px;
                    font-weight: 600;
                    color: #0a3d8e;
                    font-size: 12px;
                    text-align: start;
                    font-weight: 500;
                    margin: 0px !important;
                  "
                >
                  Referencias Comerciales
                </p>
              </div>
      `;

    const incidenciasMercantiles = (resumen?.datos_obtenidos?.indicencias_mercantiles != 1)
      ? `
        <div
                style="
                  width: 12px;
                  height: 12px;
                  border: 2px solid #c6c6c5;
                  padding: 0px;
                  background: #269e38;
                  border-radius: 50%;
                "
              ></div>
              <div style="display: flex; justify-content: flex-start;">
                <p
                  style="
                    font-size: 9px;
                    font-weight: 600;
                    color: #0a3d8e;
                    font-size: 12px;
                    text-align: start;
                    font-weight: 500;
                    margin: 0px !important;
                  "
                >
                  Incidencias Mercantiles o Penales
                </p>
              </div>
            </div>
      ` :
      `
        <div
                style="
                  width: 12px;
                  height: 12px;
                  border: 2px solid #c6c6c5;
                  padding: 0px;
                  background: #dd1212;
                  border-radius: 50%;
                "
              ></div>
              <div style="display: flex; justify-content: flex-start;">
                <p
                  style="
                    font-size: 9px;
                    font-weight: 600;
                    color: #0a3d8e;
                    font-size: 12px;
                    text-align: start;
                    font-weight: 500;
                    margin: 0px !important;
                  "
                >
                  Incidencias Mercantiles o Penales
                </p>
              </div>
            </div>
      `;

    const contribuyenteIncumplido = (resumen?.datos_obtenidos?.contribuyente_incumplido == 1)
      ? `
        <div
                style="
                  width: 12px;
                  height: 12px;
                  border: 2px solid #c6c6c5;
                  padding: 0px;
                  background: #269e38;
                  border-radius: 50%;
                "
              ></div>
              <div style="display: flex; justify-content: flex-start;">
                <p
                  style="
                    font-size: 9px;
                    font-weight: 600;
                    color: #0a3d8e;
                    font-size: 12px;
                    text-align: start;
                    font-weight: 500;
                    margin: 0px !important;
                  "
                >
                  Contribuyente Incumplido
                </p>
              </div>
            </div>
      ` :
      `
        <div
                style="
                  width: 12px;
                  height: 12px;
                  border: 2px solid #c6c6c5;
                  padding: 0px;
                  background: #dd1212;
                  border-radius: 50%;
                "
              ></div>
              <div style="display: flex; justify-content: flex-start;">
                <p
                  style="
                    font-size: 9px;
                    font-weight: 600;
                    color: #0a3d8e;
                    font-size: 12px;
                    text-align: start;
                    font-weight: 500;
                    margin: 0px !important;
                  "
                >
                  Contribuyente Incumplido
                </p>
              </div>
            </div>
      `;

    logger.info(`${fileMethod} | ${customUuid} | Resultados resultados.riesgo: ${JSON.stringify(resultados.riesgo)}`)

    let riesgoTexto = '';
    let colorTexto = '';

    switch (resultados.riesgo) {
      case '1':
      case '2':
      case '3':
        riesgoTexto = 'Riesgo Muy Alto';
        colorTexto = 'linear-gradient(to right, #8B0000, #FF6347)';
        break;
      case '4':
        riesgoTexto = 'Riesgo Alto';
        colorTexto = 'linear-gradient(to right,rgb(231, 129, 34), #FFA07A)';
        break;
      case '5':
        riesgoTexto = 'Riesgo Medio Alto';
        colorTexto = 'linear-gradient(to right,rgb(236, 248, 11),rgb(201, 182, 73))';
        break;
      case '6':
        riesgoTexto = 'Riesgo Medio Bajo';
        colorTexto = 'linear-gradient(to right,rgb(120, 238, 146), #90EE90)';
        break;
      case '7':
        riesgoTexto = 'Riesgo Bajo regular';
        colorTexto = 'linear-gradient(to right,rgb(120, 238, 146), #90EE90)';
        break;
      case '8':
        riesgoTexto = 'Riesgo Bajo';
        colorTexto = 'linear-gradient(to right,rgb(28, 240, 28), #90EE90)';
        break;
      default:
        riesgoTexto = 'Riesgo muy bajo';
        colorTexto = 'linear-gradient(to right,rgb(28, 240, 28), #90EE90)';
        break;
    }

    // Inserta el texto con estilo degradado
    riesgoTexto = `
  <p style="
    font-weight: bold;
    font-size: 11px;
    background: ${colorTexto};
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  ">
    ${riesgoTexto}
    </p>`;


    const riesgo = parseInt(resultados.riesgo, 10);

    let colorHexagono = [];

    switch (riesgo) {
      case 1:
      case 2:
      case 3:
        // Muy Alto Riesgo = rojo fuerte
        colorHexagono = ['#e03a3a', '#d90d0d', '#e76060', '#ee8686', '#d90d0d', '#e03a3a'];
        break;
      case 4:
        // Alto Riesgo = naranja fuerte
        colorHexagono = ['#f58e10', '#f58e10', '#f58e10', '#f58e10', '#f58e10', '#f58e10'];
        break;
      case 5:
        // Riesgo Medio Alto = amarillo
        colorHexagono = ['#ddcf0a', '#ddcf0a', '#ddcf0a', '#ddcf0a', '#ddcf0a', '#ddcf0a'];
        break;
      case 6:
      case 7:
        // Riesgo Medio Bajo = verde
        colorHexagono = ['#75d987', '#75d987', '#75d987', '#75d987', '#75d987', '#75d987'];
        break;
      case 8:
      case 9:
      case 10:
        colorHexagono = ['#15dd3a', '#15dd3a', '#15dd3a', '#15dd3a', '#15dd3a', '#15dd3a'];
        break;
      default:
        // Desconocido = gris
        colorHexagono = ['#e2dddd', '#e2dddd', '#e2dddd', '#e2dddd', '#e2dddd', '#e2dddd'];
        break;
    }


    // Nuevos Ratios
    const nuevosRatios = {
      capital_trabajo_anterior: ratios_financiero?.formula_1_capital_trabajo_anterior ?? 0,
      capital_trabajo_previo_anterior: ratios_financiero?.formula_1_capital_trabajo_previo_anterior ?? 0,
      capital_trabajo_anterior_2: ratios_financiero?.formula_2_capital_trabajo_anterior ?? 0,
      capital_trabajo_previo_anterior_2: ratios_financiero?.formula_2_capital_trabajo_previo_anterior ?? 0,

      prueba_acida_anterior: ratios_financiero?.prueba_acida_anterior ?? 0,
      prueba_acida_previo_anterior: ratios_financiero?.prueba_acida_previo_anterior ?? 0,

      grado_general_endeudamiento_anterior: ratios_financiero?.grado_general_endeudamiento_anterior ?? 0,
      grado_general_endeudamiento_previo_anterior: ratios_financiero?.grado_general_endeudamiento_previo_anterior ?? 0,

      apalancamiento_anterior: ratios_financiero?.apalancamiento_anterior ?? 0,
      apalancamiento_previo_anterior: ratios_financiero?.apalancamiento_previo_anterior ?? 0,

      formula_1_inventarios_rotacion_anterior: ratios_financiero?.formula_1_inventarios_rotacion_anterior ?? 0,
      formula_1_inventarios_rotacion_previo_anterior: ratios_financiero?.formula_1_inventarios_rotacion_previo_anterior ?? 0,
      formula_1_inventarios_rotacion_anterior_2: ratios_financiero?.formula_2_inventarios_rotacion_anterior ?? 0,
      formula_1_inventarios_rotacion_previo_anterior_2: ratios_financiero?.formula_2_inventarios_rotacion_previo_anterior ?? 0,

      rotacion_ctas_x_cobrar_anterior: ratios_financiero?.rotacion_ctas_x_cobrar_anterior ?? 0,
      rotacion_ctas_x_cobrar_previo_anterior: ratios_financiero?.rotacion_ctas_x_cobrar_previo_anterior ?? 0,

      rotacion_pagos_anterior: ratios_financiero?.rotacion_pagos_anterior ?? 0,
      rotacion_pagos_previo_anterior: ratios_financiero?.rotacion_pagos_previo_anterior ?? 0,

      solvencia_anterior: ratios_financiero?.solvencia_anterior ?? 0,
      solvencia_previo_anterior: ratios_financiero?.solvencia_previo_anterior ?? 0,

      retorno_capital_acciones_anterior: ratios_financiero?.retorno_capital_acciones_anterior ?? 0,
      retorno_capital_acciones_previo_anterior: ratios_financiero?.retorno_capital_acciones_previo_anterior ?? 0,

      rendimiento_capital_anterior: ratios_financiero?.rendimiento_capital_anterior ?? 0,
      rendimiento_capital_previo_anterior: ratios_financiero?.rendimiento_capital_previo_anterior ?? 0,

      rendimiento_activos_anterior: ratios_financiero?.rendimiento_activos_anterior ?? 0,
      rendimiento_activos_previo_anterior: ratios_financiero?.rendimiento_activos_previo_anterior ?? 0
    }

    const ratios_ = ratios_financiero != undefined && soloCompartirInfoEmpresa === 1 ?
      `
      <section style="width: 65%; display: block;">
        <div
          style="
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: flex-start;
            margin-bottom: 20px;            
          "
        >
          <p
            style="
              color: #0a3d8e;
              margin: 0px;
              font-size: 12px;
              font-weight: 700;
              margin-top: 30px !important;
            "
          >
            Ratio Financiero
          </p>
        </div>
        
      </section>

      <div style="display: flex; justify-content: center; align-items: center; gap: 40px; padding: 20px; font-family: 'Helvetica Neue', Arial, sans-serif;">

        <!-- Veces -->
        <div style="display: flex; align-items: center; gap: 10px;">
          <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAACLElEQVR4nO1WzU4UQRCeu8aDYZmq2SEGJOq7KJ5Fn0DBA9EXIY5b3RNPnsgKnhTfBIWLbPWg8caPFwSiqZ5u3ZjNTvfuHPdLKplkqqu+ru6vqpNkhhkiUL3OFphw3RB+YoLPTPizNvu9yypdM2U3T9oGU95lQs0KL4zC3+OMFV4xYf9bAbdaST7oZQ+Z8NQmIDg3BFvcyx5Vvezu97fpNTH5ZsJV+Wd9hAjhaaWylel2rvC57MgF7B+W6WIz4fklVrg9VI31yXeubIBLQ7AxyseXfSR5DS9krcSIrgTXZ+7LPjJ5EwFPwvmcHOo5DCZgFLzxZR/vN56AJUG442LpGKldymVqOvMQAgPduS2xREFS2UYCLDqvS7/V5BtCwMXs11WAZyEEdl3JVlsk8MTF/NBMQMGBdS7y5bYISJ+oZQlfAgjgmTj/KDrXQwmMsmE/ieX6wlkzAarl1yaBg82bN7wcAwjAvjhXZXYnaQlHGu+5Cuy1eglDEXkJ07VQGUYQsDIcaHja6GzKbm7HLsG5DJapkxf5clQjErCC0p3ZdjIljIL3LpYKXjR4tZB5NchAmTQ5E7ysjxOPvxYdiFpcqWzFj+NJSEhyP46NTu/Hrv87F4YeJDsyWJKQM/9X9iu51Mk0qHrpA2kg/kkmN5o1PhZtS7MSk2+RGit8Zwh/+bJPvPP/caRxjgk2Ax+lFzL7ox4goRAZiZZZ4UfpatLbne1Jk7H/QqU2wwxJjT9fDxf2N4KlawAAAABJRU5ErkJggg==" style="height: 20px; width: 20px; margin-right: 5px; vertical-align: middle;" />
          <div style="color: #0a3d8e; font-size: 12px; font-weight: 500; padding: 10px; white-space: nowrap;">Veces</div>
        </div>
      
        <!-- Moneda -->
        <div style="display: flex; align-items: center; gap: 10px;">
          <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAACXBIWXMAAAsTAAALEwEAmpwYAAABt0lEQVR4nNWUP0hVcRTHf5Lge+dcCad6JErec54WuDxcdCgdA0fBocWlwDEwGt8WNAgKDv6751yVlhZzkKYwHIUgF4empiAQh0KM0mf87v09r9RT+Okt8sBdLofv55zfOedrzP8UILyByseo4eAVA2hnAeNwCJQ/JgDhF8ES38lFGyN6Akpf08p/+4Tf4MLtGxcWB+WndTFQfgfCE0FE46gUo/JR8l9o23borz5XAlD65ipd/KMzKY+ewGN+7K1fWAr76wLFxe6+RjmotJUWQKvegCDmeycVSlhpCBCacznvvQHXX3a0odIPV6GavxGgNJkNmd7arsyxacqPUL3fDEIzKFzL1pM+2TtA6e7NjQMSVlBpFoT3Tt1ADYXXijHfyg1kpqkliGgEldYzEH0uzlO7yTsgomFU/u66WfYXUH5kDyiI6O45OVPpGvMXf4DQrhvq87NzeMJ1cOANsAN0XrPT0GtemWugtOmK+OANKEg4gEo/ncAWxOUHsNJTsu5prTtx0swIx7wBSRdKD1F5v6FVp09zCEJVc5kA7bwJQs9Q+fWp1Vy1Vt4qXWzyDHSAXEX/KeAi8QsNVdYgk4IumgAAAABJRU5ErkJggg==" style="height: 20px; width: 20px; margin-right: 5px; vertical-align: middle;" />
          <div style="color: #0a3d8e; font-size: 12px; font-weight: 500; padding: 10px; white-space: nowrap;">Moneda</div>
        </div>
      
        <!-- Porcentaje -->
        <div style="display: flex; align-items: center; gap: 10px;">
          <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAACXBIWXMAAAsTAAALEwEAmpwYAAABOUlEQVR4nO2TPU7DQBCFhyI7b2xokeAScAmKhJ8iNwkNPy1cgZwFbhBCR8EZUOhCQzMZtKuRhSw7XqMUKTKSZVlrf29m/B7RrrayLIRzZZ4r8B3vFsKo8T0iMZFxb/gKsPplDSIKPMUzZX7MFlDmtwQEboyoNODWIa+1Ri4VWCnwY0Vxmi8ALJMA0X4CER0kAWBZwYviSJkX3sh1NtwnmPuHd1HEgPu/ExjRngLPLvoSn3sJGPNZHL3hHwzTucjEBb9M5LgXvBIJYRQ7dhfNKvhgcBJ3HhuwEK7+BW8VJYIC776aKW26FJg6/MOIio3CrcGSuWHshpfloTJ/ph8tMnH4RW4Y18Op2ZK5YewWkMqSixiuPmHshq+xpHaEMauU+aHNknHX9f17Iykv+VOIjNss2RbGXW1f/QJ2UPnMq9ECDgAAAABJRU5ErkJggg==" style="height: 20px; width: 20px; margin-right: 5px; vertical-align: middle;" />
          <div style="color: #0a3d8e; font-size: 12px; font-weight: 500; padding: 10px; white-space: nowrap;">Porcentaje</div>
        </div>
      
        <!-- Días -->
        <div style="display: flex; align-items: center; gap: 10px;">
          <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAACXBIWXMAAAsTAAALEwEAmpwYAAAA+0lEQVR4nO2aQQ6DMAwE/QxvX9RT/19zakLfQRVRUEVBjSgIJ+xKPkCEk9EGO4eIZEqbcNV7iLDYpdB7COld7vdH5x+VEg+TfE4mheQfNSRfevaevzyQS/O4qcXn1N5pTCfaOiQzf1prWvMXSA6EJxD0MO1Pa3ezfqP8WBo/DYg6K79YDdI3rLBzQwy5+VeDeBMIUpojKCykehApRCCIM+H0jsDLz/yvI9WBiIOxJIKAjkRuLbBqGctvx/Jr7CMdOztqOqKglkMjagERB2NJBAEdidxaYNWyE5RfbwJBnAnVO6IW26N+6LWhcxcG3lc4ioFRi+3sFQ5KfOgF0BbNq3WbIGwAAAAASUVORK5CYII=" style="height: 20px; width: 20px; margin-right: 5px; vertical-align: middle;" />
          <div style="color: #0a3d8e; font-size: 12px; font-weight: 500; padding: 10px; white-space: nowrap;">Días</div>
        </div>
      
      </div>

      <div style="background-color: #f1f8ff; border-left: 5px solid #2ba2af; padding: 10px 20px; margin-bottom: 10px; width: 45rem; margin-top: 1rem;">
        <table style="width: 100%; table-layout: fixed; border-collapse: collapse;">
            <thead>
                <tr style="background-color: #2ba2af; color: white; text-align: left;">
                    <th style="padding: 10px; white-space: nowrap;">Indicador</th>
                    <th style="padding: 10px; white-space: nowrap;"></th>
                    <th style="padding: 10px; white-space: nowrap;">{_periodo_anterior_}</th>
                    <th style="padding: 10px; white-space: nowrap;">{_periodo_previo_anterior_}</th>
                </tr>
            </thead>
            <tbody>
                <tr style="background-color: #ffffff;">
                    <td style="color: #0a3d8e; font-size: 12px; font-weight: 500; padding: 10px; white-space: nowrap;">Capital de Trabajo</td>
                    <td style="width: 40px; text-align: center; vertical-align: middle; padding: 5px;">
                      <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAACLElEQVR4nO1WzU4UQRCeu8aDYZmq2SEGJOq7KJ5Fn0DBA9EXIY5b3RNPnsgKnhTfBIWLbPWg8caPFwSiqZ5u3ZjNTvfuHPdLKplkqqu+ru6vqpNkhhkiUL3OFphw3RB+YoLPTPizNvu9yypdM2U3T9oGU95lQs0KL4zC3+OMFV4xYf9bAbdaST7oZQ+Z8NQmIDg3BFvcyx5Vvezu97fpNTH5ZsJV+Wd9hAjhaaWylel2rvC57MgF7B+W6WIz4fklVrg9VI31yXeubIBLQ7AxyseXfSR5DS9krcSIrgTXZ+7LPjJ5EwFPwvmcHOo5DCZgFLzxZR/vN56AJUG442LpGKldymVqOvMQAgPduS2xREFS2UYCLDqvS7/V5BtCwMXs11WAZyEEdl3JVlsk8MTF/NBMQMGBdS7y5bYISJ+oZQlfAgjgmTj/KDrXQwmMsmE/ieX6wlkzAarl1yaBg82bN7wcAwjAvjhXZXYnaQlHGu+5Cuy1eglDEXkJ07VQGUYQsDIcaHja6GzKbm7HLsG5DJapkxf5clQjErCC0p3ZdjIljIL3LpYKXjR4tZB5NchAmTQ5E7ysjxOPvxYdiFpcqWzFj+NJSEhyP46NTu/Hrv87F4YeJDsyWJKQM/9X9iu51Mk0qHrpA2kg/kkmN5o1PhZtS7MSk2+RGit8Zwh/+bJPvPP/caRxjgk2Ax+lFzL7ox4goRAZiZZZ4UfpatLbne1Jk7H/QqU2wwxJjT9fDxf2N4KlawAAAABJRU5ErkJggg==" style="height: 20px; width: 20px; margin-right: 5px; vertical-align: middle;" />
                    </td>
                    <td style="font-size: 12px; font-weight: 500; padding: 10px; border: 1px solid #ddd;">{_capital_trabajo_anterior_}</td>
                    <td style="font-size: 12px; font-weight: 500; padding: 10px; border: 1px solid #ddd;">{_capital_trabajo_previo_anterior_}</td>
                </tr>
                <tr style="background-color: #ffffff;">
                    <td style="color: #0a3d8e; font-size: 12px; font-weight: 500; padding: 10px; white-space: nowrap;"></td>
                    <td style="width: 40px; text-align: center; vertical-align: middle; padding: 5px;">
                      <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAACXBIWXMAAAsTAAALEwEAmpwYAAABt0lEQVR4nNWUP0hVcRTHf5Lge+dcCad6JErec54WuDxcdCgdA0fBocWlwDEwGt8WNAgKDv6751yVlhZzkKYwHIUgF4empiAQh0KM0mf87v09r9RT+Okt8sBdLofv55zfOedrzP8UILyByseo4eAVA2hnAeNwCJQ/JgDhF8ES38lFGyN6Akpf08p/+4Tf4MLtGxcWB+WndTFQfgfCE0FE46gUo/JR8l9o23borz5XAlD65ipd/KMzKY+ewGN+7K1fWAr76wLFxe6+RjmotJUWQKvegCDmeycVSlhpCBCacznvvQHXX3a0odIPV6GavxGgNJkNmd7arsyxacqPUL3fDEIzKFzL1pM+2TtA6e7NjQMSVlBpFoT3Tt1ADYXXijHfyg1kpqkliGgEldYzEH0uzlO7yTsgomFU/u66WfYXUH5kDyiI6O45OVPpGvMXf4DQrhvq87NzeMJ1cOANsAN0XrPT0GtemWugtOmK+OANKEg4gEo/ncAWxOUHsNJTsu5prTtx0swIx7wBSRdKD1F5v6FVp09zCEJVc5kA7bwJQs9Q+fWp1Vy1Vt4qXWzyDHSAXEX/KeAi8QsNVdYgk4IumgAAAABJRU5ErkJggg==" style="height: 20px; width: 20px; margin-right: 5px; vertical-align: middle;" />
                    </td>
                    <td style="font-size: 12px; font-weight: 500; padding: 10px; border: 1px solid #ddd;">{_capital_trabajo_anterior2_}</td>
                    <td style="font-size: 12px; font-weight: 500; padding: 10px; border: 1px solid #ddd;">{_capital_trabajo_previo_anterior2_}</td>
                </tr>
                <tr style="background-color: #f2f8fc;">
                    <td style="color: #0a3d8e; font-size: 12px; font-weight: 500; padding: 10px; white-space: nowrap;">Prueba Ácida</td>
                    <td style="width: 40px; text-align: center; vertical-align: middle; padding: 5px;">
                      <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAACLElEQVR4nO1WzU4UQRCeu8aDYZmq2SEGJOq7KJ5Fn0DBA9EXIY5b3RNPnsgKnhTfBIWLbPWg8caPFwSiqZ5u3ZjNTvfuHPdLKplkqqu+ru6vqpNkhhkiUL3OFphw3RB+YoLPTPizNvu9yypdM2U3T9oGU95lQs0KL4zC3+OMFV4xYf9bAbdaST7oZQ+Z8NQmIDg3BFvcyx5Vvezu97fpNTH5ZsJV+Wd9hAjhaaWylel2rvC57MgF7B+W6WIz4fklVrg9VI31yXeubIBLQ7AxyseXfSR5DS9krcSIrgTXZ+7LPjJ5EwFPwvmcHOo5DCZgFLzxZR/vN56AJUG442LpGKldymVqOvMQAgPduS2xREFS2UYCLDqvS7/V5BtCwMXs11WAZyEEdl3JVlsk8MTF/NBMQMGBdS7y5bYISJ+oZQlfAgjgmTj/KDrXQwmMsmE/ieX6wlkzAarl1yaBg82bN7wcAwjAvjhXZXYnaQlHGu+5Cuy1eglDEXkJ07VQGUYQsDIcaHja6GzKbm7HLsG5DJapkxf5clQjErCC0p3ZdjIljIL3LpYKXjR4tZB5NchAmTQ5E7ysjxOPvxYdiFpcqWzFj+NJSEhyP46NTu/Hrv87F4YeJDsyWJKQM/9X9iu51Mk0qHrpA2kg/kkmN5o1PhZtS7MSk2+RGit8Zwh/+bJPvPP/caRxjgk2Ax+lFzL7ox4goRAZiZZZ4UfpatLbne1Jk7H/QqU2wwxJjT9fDxf2N4KlawAAAABJRU5ErkJggg==" style="height: 20px; width: 20px; margin-right: 5px; vertical-align: middle;" />
                    </td>
                    <td style="font-size: 12px; font-weight: 500; padding: 10px; border: 1px solid #ddd;">{_prueba_acida_anterior_}</td>
                    <td style="font-size: 12px; font-weight: 500; padding: 10px; border: 1px solid #ddd;">{_prueba_acida_previo_anterior_}</td>
                </tr>
                <tr style="background-color: #ffffff;">
                    <td style="color: #0a3d8e; font-size: 12px; font-weight: 500; padding: 10px; white-space: nowrap;">Grado General de Endeudamiento</td>
                    <td style="width: 40px; text-align: center; vertical-align: middle; padding: 5px;">
                      <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAACLElEQVR4nO1WzU4UQRCeu8aDYZmq2SEGJOq7KJ5Fn0DBA9EXIY5b3RNPnsgKnhTfBIWLbPWg8caPFwSiqZ5u3ZjNTvfuHPdLKplkqqu+ru6vqpNkhhkiUL3OFphw3RB+YoLPTPizNvu9yypdM2U3T9oGU95lQs0KL4zC3+OMFV4xYf9bAbdaST7oZQ+Z8NQmIDg3BFvcyx5Vvezu97fpNTH5ZsJV+Wd9hAjhaaWylel2rvC57MgF7B+W6WIz4fklVrg9VI31yXeubIBLQ7AxyseXfSR5DS9krcSIrgTXZ+7LPjJ5EwFPwvmcHOo5DCZgFLzxZR/vN56AJUG442LpGKldymVqOvMQAgPduS2xREFS2UYCLDqvS7/V5BtCwMXs11WAZyEEdl3JVlsk8MTF/NBMQMGBdS7y5bYISJ+oZQlfAgjgmTj/KDrXQwmMsmE/ieX6wlkzAarl1yaBg82bN7wcAwjAvjhXZXYnaQlHGu+5Cuy1eglDEXkJ07VQGUYQsDIcaHja6GzKbm7HLsG5DJapkxf5clQjErCC0p3ZdjIljIL3LpYKXjR4tZB5NchAmTQ5E7ysjxOPvxYdiFpcqWzFj+NJSEhyP46NTu/Hrv87F4YeJDsyWJKQM/9X9iu51Mk0qHrpA2kg/kkmN5o1PhZtS7MSk2+RGit8Zwh/+bJPvPP/caRxjgk2Ax+lFzL7ox4goRAZiZZZ4UfpatLbne1Jk7H/QqU2wwxJjT9fDxf2N4KlawAAAABJRU5ErkJggg==" style="height: 20px; width: 20px; margin-right: 5px; vertical-align: middle;" />
                    </td>
                    <td style="font-size: 12px; font-weight: 500; padding: 10px; border: 1px solid #ddd;">{_grado_general_endeudamiento_anterior_}</td>
                    <td style="font-size: 12px; font-weight: 500; padding: 10px; border: 1px solid #ddd;">{_grado_general_endeudamiento_previo_anterior_}</td>
                </tr>
                <tr style="background-color: #f2f8fc;">
                    <td style="color: #0a3d8e; font-size: 12px; font-weight: 500; padding: 10px; white-space: nowrap;">Apalancamiento Financiero</td>
                    <td style="width: 40px; text-align: center; vertical-align: middle; padding: 5px;">
                      <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAACLElEQVR4nO1WzU4UQRCeu8aDYZmq2SEGJOq7KJ5Fn0DBA9EXIY5b3RNPnsgKnhTfBIWLbPWg8caPFwSiqZ5u3ZjNTvfuHPdLKplkqqu+ru6vqpNkhhkiUL3OFphw3RB+YoLPTPizNvu9yypdM2U3T9oGU95lQs0KL4zC3+OMFV4xYf9bAbdaST7oZQ+Z8NQmIDg3BFvcyx5Vvezu97fpNTH5ZsJV+Wd9hAjhaaWylel2rvC57MgF7B+W6WIz4fklVrg9VI31yXeubIBLQ7AxyseXfSR5DS9krcSIrgTXZ+7LPjJ5EwFPwvmcHOo5DCZgFLzxZR/vN56AJUG442LpGKldymVqOvMQAgPduS2xREFS2UYCLDqvS7/V5BtCwMXs11WAZyEEdl3JVlsk8MTF/NBMQMGBdS7y5bYISJ+oZQlfAgjgmTj/KDrXQwmMsmE/ieX6wlkzAarl1yaBg82bN7wcAwjAvjhXZXYnaQlHGu+5Cuy1eglDEXkJ07VQGUYQsDIcaHja6GzKbm7HLsG5DJapkxf5clQjErCC0p3ZdjIljIL3LpYKXjR4tZB5NchAmTQ5E7ysjxOPvxYdiFpcqWzFj+NJSEhyP46NTu/Hrv87F4YeJDsyWJKQM/9X9iu51Mk0qHrpA2kg/kkmN5o1PhZtS7MSk2+RGit8Zwh/+bJPvPP/caRxjgk2Ax+lFzL7ox4goRAZiZZZ4UfpatLbne1Jk7H/QqU2wwxJjT9fDxf2N4KlawAAAABJRU5ErkJggg==" style="height: 20px; width: 20px; margin-right: 5px; vertical-align: middle;" />
                    </td>
                    <td style="font-size: 12px; font-weight: 500; padding: 10px; border: 1px solid #ddd;">{_apalancamiento_anterior_}</td>
                    <td style="font-size: 12px; font-weight: 500; padding: 10px; border: 1px solid #ddd;">{_apalancamiento_previo_anterior_}</td>
                </tr>
                <tr style="background-color: #ffffff;">
                  <td style="color: #0a3d8e; font-size: 12px; font-weight: 500; padding: 10px; white-space: nowrap;">Rotación de Inventarios</td>
                  <td style="width: 40px; text-align: center; vertical-align: middle; padding: 5px;">
                    <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAACLElEQVR4nO1WzU4UQRCeu8aDYZmq2SEGJOq7KJ5Fn0DBA9EXIY5b3RNPnsgKnhTfBIWLbPWg8caPFwSiqZ5u3ZjNTvfuHPdLKplkqqu+ru6vqpNkhhkiUL3OFphw3RB+YoLPTPizNvu9yypdM2U3T9oGU95lQs0KL4zC3+OMFV4xYf9bAbdaST7oZQ+Z8NQmIDg3BFvcyx5Vvezu97fpNTH5ZsJV+Wd9hAjhaaWylel2rvC57MgF7B+W6WIz4fklVrg9VI31yXeubIBLQ7AxyseXfSR5DS9krcSIrgTXZ+7LPjJ5EwFPwvmcHOo5DCZgFLzxZR/vN56AJUG442LpGKldymVqOvMQAgPduS2xREFS2UYCLDqvS7/V5BtCwMXs11WAZyEEdl3JVlsk8MTF/NBMQMGBdS7y5bYISJ+oZQlfAgjgmTj/KDrXQwmMsmE/ieX6wlkzAarl1yaBg82bN7wcAwjAvjhXZXYnaQlHGu+5Cuy1eglDEXkJ07VQGUYQsDIcaHja6GzKbm7HLsG5DJapkxf5clQjErCC0p3ZdjIljIL3LpYKXjR4tZB5NchAmTQ5E7ysjxOPvxYdiFpcqWzFj+NJSEhyP46NTu/Hrv87F4YeJDsyWJKQM/9X9iu51Mk0qHrpA2kg/kkmN5o1PhZtS7MSk2+RGit8Zwh/+bJPvPP/caRxjgk2Ax+lFzL7ox4goRAZiZZZ4UfpatLbne1Jk7H/QqU2wwxJjT9fDxf2N4KlawAAAABJRU5ErkJggg==" style="height: 20px; width: 20px; margin-right: 5px; vertical-align: middle;" />
                  </td>
                  <td style="font-size: 12px; font-weight: 500; border: 1px solid #ddd; padding: 8px;">{_formula_1_inventarios_rotacion_anterior_}</td>
                  <td style="font-size: 12px; font-weight: 500; border: 1px solid #ddd; padding: 8px;">{_formula_1_inventarios_rotacion_previo_anterior_}</td>
              </tr>
              <tr style="background-color: #ffffff;">
                  <td style="color: #0a3d8e; font-size: 12px; font-weight: 500; padding: 10px; white-space: nowrap;"></td>
                  <td style="width: 40px; text-align: center; vertical-align: middle; padding: 5px;">
                    <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAACXBIWXMAAAsTAAALEwEAmpwYAAAA+0lEQVR4nO2aQQ6DMAwE/QxvX9RT/19zakLfQRVRUEVBjSgIJ+xKPkCEk9EGO4eIZEqbcNV7iLDYpdB7COld7vdH5x+VEg+TfE4mheQfNSRfevaevzyQS/O4qcXn1N5pTCfaOiQzf1prWvMXSA6EJxD0MO1Pa3ezfqP8WBo/DYg6K79YDdI3rLBzQwy5+VeDeBMIUpojKCykehApRCCIM+H0jsDLz/yvI9WBiIOxJIKAjkRuLbBqGctvx/Jr7CMdOztqOqKglkMjagERB2NJBAEdidxaYNWyE5RfbwJBnAnVO6IW26N+6LWhcxcG3lc4ioFRi+3sFQ5KfOgF0BbNq3WbIGwAAAAASUVORK5CYII=" style="height: 20px; width: 20px; margin-right: 5px; vertical-align: middle;" />
                  </td>
                  <td style="font-size: 12px; font-weight: 500; border: 1px solid #ddd; padding: 8px;">{_formula_1_inventarios_rotacion_anterior2_}</td>
                  <td style="font-size: 12px; font-weight: 500; border: 1px solid #ddd; padding: 8px;">{_formula_1_inventarios_rotacion_previo_anterior2_}</td>
              </tr>
              
              <tr style="background-color: #f2f8fc;">
                  <td style="color: #0a3d8e; font-size: 12px; font-weight: 500; padding: 10px; white-space: nowrap;">Rotación de Cuentas por Cobrar</td>
                  <td style="width: 40px; text-align: center; vertical-align: middle; padding: 5px;">
                    <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAACXBIWXMAAAsTAAALEwEAmpwYAAAA+0lEQVR4nO2aQQ6DMAwE/QxvX9RT/19zakLfQRVRUEVBjSgIJ+xKPkCEk9EGO4eIZEqbcNV7iLDYpdB7COld7vdH5x+VEg+TfE4mheQfNSRfevaevzyQS/O4qcXn1N5pTCfaOiQzf1prWvMXSA6EJxD0MO1Pa3ezfqP8WBo/DYg6K79YDdI3rLBzQwy5+VeDeBMIUpojKCykehApRCCIM+H0jsDLz/yvI9WBiIOxJIKAjkRuLbBqGctvx/Jr7CMdOztqOqKglkMjagERB2NJBAEdidxaYNWyE5RfbwJBnAnVO6IW26N+6LWhcxcG3lc4ioFRi+3sFQ5KfOgF0BbNq3WbIGwAAAAASUVORK5CYII=" style="height: 20px; width: 20px; margin-right: 5px; vertical-align: middle;" />
                  </td>
                  <td style="font-size: 12px; font-weight: 500; border: 1px solid #ddd; padding: 8px;">{_rotacion_ctas_x_cobrar_anterior_}</td>
                  <td style="font-size: 12px; font-weight: 500; border: 1px solid #ddd; padding: 8px;">{_rotacion_ctas_x_cobrar_previo_anterior_}</td>
              </tr>
              <tr style="background-color: #ffffff;">
                  <td style="color: #0a3d8e; font-size: 12px; font-weight: 500; padding: 10px; white-space: nowrap;">Rotación de Pagos</td>
                  <td style="width: 40px; text-align: center; vertical-align: middle; padding: 5px;">
                    <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAACXBIWXMAAAsTAAALEwEAmpwYAAAA+0lEQVR4nO2aQQ6DMAwE/QxvX9RT/19zakLfQRVRUEVBjSgIJ+xKPkCEk9EGO4eIZEqbcNV7iLDYpdB7COld7vdH5x+VEg+TfE4mheQfNSRfevaevzyQS/O4qcXn1N5pTCfaOiQzf1prWvMXSA6EJxD0MO1Pa3ezfqP8WBo/DYg6K79YDdI3rLBzQwy5+VeDeBMIUpojKCykehApRCCIM+H0jsDLz/yvI9WBiIOxJIKAjkRuLbBqGctvx/Jr7CMdOztqOqKglkMjagERB2NJBAEdidxaYNWyE5RfbwJBnAnVO6IW26N+6LWhcxcG3lc4ioFRi+3sFQ5KfOgF0BbNq3WbIGwAAAAASUVORK5CYII=" style="height: 20px; width: 20px; margin-right: 5px; vertical-align: middle;" />
                  </td>
                  <td style="font-size: 12px; font-weight: 500; border: 1px solid #ddd; padding: 8px;">{_rotacion_pagos_anterior_}</td>
                  <td style="font-size: 12px; font-weight: 500; border: 1px solid #ddd; padding: 8px;">{_rotacion_pagos_previo_anterior_}</td>
              </tr>
              <tr style="background-color: #f2f8fc;">
                  <td style="color: #0a3d8e; font-size: 12px; font-weight: 500; padding: 10px; white-space: nowrap;">Solvencia</td>
                  <td style="width: 40px; text-align: center; vertical-align: middle; padding: 5px;">
                    <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAACLElEQVR4nO1WzU4UQRCeu8aDYZmq2SEGJOq7KJ5Fn0DBA9EXIY5b3RNPnsgKnhTfBIWLbPWg8caPFwSiqZ5u3ZjNTvfuHPdLKplkqqu+ru6vqpNkhhkiUL3OFphw3RB+YoLPTPizNvu9yypdM2U3T9oGU95lQs0KL4zC3+OMFV4xYf9bAbdaST7oZQ+Z8NQmIDg3BFvcyx5Vvezu97fpNTH5ZsJV+Wd9hAjhaaWylel2rvC57MgF7B+W6WIz4fklVrg9VI31yXeubIBLQ7AxyseXfSR5DS9krcSIrgTXZ+7LPjJ5EwFPwvmcHOo5DCZgFLzxZR/vN56AJUG442LpGKldymVqOvMQAgPduS2xREFS2UYCLDqvS7/V5BtCwMXs11WAZyEEdl3JVlsk8MTF/NBMQMGBdS7y5bYISJ+oZQlfAgjgmTj/KDrXQwmMsmE/ieX6wlkzAarl1yaBg82bN7wcAwjAvjhXZXYnaQlHGu+5Cuy1eglDEXkJ07VQGUYQsDIcaHja6GzKbm7HLsG5DJapkxf5clQjErCC0p3ZdjIljIL3LpYKXjR4tZB5NchAmTQ5E7ysjxOPvxYdiFpcqWzFj+NJSEhyP46NTu/Hrv87F4YeJDsyWJKQM/9X9iu51Mk0qHrpA2kg/kkmN5o1PhZtS7MSk2+RGit8Zwh/+bJPvPP/caRxjgk2Ax+lFzL7ox4goRAZiZZZ4UfpatLbne1Jk7H/QqU2wwxJjT9fDxf2N4KlawAAAABJRU5ErkJggg==" style="height: 20px; width: 20px; margin-right: 5px; vertical-align: middle;" />
                  </td>
                  <td style="font-size: 12px; font-weight: 500; border: 1px solid #ddd; padding: 8px;">{_solvencia_anterior_}</td>
                  <td style="font-size: 12px; font-weight: 500; border: 1px solid #ddd; padding: 8px;">{_solvencia_previo_anterior_}</td>
              </tr>
              <tr style="background-color: #ffffff;">
                  <td style="color: #0a3d8e; font-size: 12px; font-weight: 500; padding: 10px; white-space: nowrap;">Retorno sobre Capital de Acciones</td>
                  <td style="width: 40px; text-align: center; vertical-align: middle; padding: 5px;">
                    <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAACXBIWXMAAAsTAAALEwEAmpwYAAABOUlEQVR4nO2TPU7DQBCFhyI7b2xokeAScAmKhJ8iNwkNPy1cgZwFbhBCR8EZUOhCQzMZtKuRhSw7XqMUKTKSZVlrf29m/B7RrrayLIRzZZ4r8B3vFsKo8T0iMZFxb/gKsPplDSIKPMUzZX7MFlDmtwQEboyoNODWIa+1Ri4VWCnwY0Vxmi8ALJMA0X4CER0kAWBZwYviSJkX3sh1NtwnmPuHd1HEgPu/ExjRngLPLvoSn3sJGPNZHL3hHwzTucjEBb9M5LgXvBIJYRQ7dhfNKvhgcBJ3HhuwEK7+BW8VJYIC776aKW26FJg6/MOIio3CrcGSuWHshpfloTJ/ph8tMnH4RW4Y18Op2ZK5YewWkMqSixiuPmHshq+xpHaEMauU+aHNknHX9f17Iykv+VOIjNss2RbGXW1f/QJ2UPnMq9ECDgAAAABJRU5ErkJggg==" style="height: 20px; width: 20px; margin-right: 5px; vertical-align: middle;" />
                  </td>
                  <td style="font-size: 12px; font-weight: 500; border: 1px solid #ddd; padding: 8px;">{_retorno_capital_acciones_anterior_}</td>
                  <td style="font-size: 12px; font-weight: 500; border: 1px solid #ddd; padding: 8px;">{_retorno_capital_acciones_previo_anterior_}</td>
              </tr>
              <tr style="background-color: #f2f8fc;">
                  <td style="color: #0a3d8e; font-size: 12px; font-weight: 500; padding: 10px; white-space: nowrap;">Rendimiento del Capital</td>
                  <td style="width: 40px; text-align: center; vertical-align: middle; padding: 5px;">
                    <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAACXBIWXMAAAsTAAALEwEAmpwYAAABOUlEQVR4nO2TPU7DQBCFhyI7b2xokeAScAmKhJ8iNwkNPy1cgZwFbhBCR8EZUOhCQzMZtKuRhSw7XqMUKTKSZVlrf29m/B7RrrayLIRzZZ4r8B3vFsKo8T0iMZFxb/gKsPplDSIKPMUzZX7MFlDmtwQEboyoNODWIa+1Ri4VWCnwY0Vxmi8ALJMA0X4CER0kAWBZwYviSJkX3sh1NtwnmPuHd1HEgPu/ExjRngLPLvoSn3sJGPNZHL3hHwzTucjEBb9M5LgXvBIJYRQ7dhfNKvhgcBJ3HhuwEK7+BW8VJYIC776aKW26FJg6/MOIio3CrcGSuWHshpfloTJ/ph8tMnH4RW4Y18Op2ZK5YewWkMqSixiuPmHshq+xpHaEMauU+aHNknHX9f17Iykv+VOIjNss2RbGXW1f/QJ2UPnMq9ECDgAAAABJRU5ErkJggg==" style="height: 20px; width: 20px; margin-right: 5px; vertical-align: middle;" />
                  </td>
                  <td style="font-size: 12px; font-weight: 500; border: 1px solid #ddd; padding: 8px;">{_rendimiento_capital_anterior_}</td>
                  <td style="font-size: 12px; font-weight: 500; border: 1px solid #ddd; padding: 8px;">{_rendimiento_capital_previo_anterior_}</td>
              </tr>
              <tr style="background-color: #ffffff;">
                  <td style="color: #0a3d8e; font-size: 12px; font-weight: 500; padding: 10px; white-space: nowrap;">Rendimiento de los Activos</td>
                  <td style="width: 40px; text-align: center; vertical-align: middle; padding: 5px;">
                    <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAACXBIWXMAAAsTAAALEwEAmpwYAAABOUlEQVR4nO2TPU7DQBCFhyI7b2xokeAScAmKhJ8iNwkNPy1cgZwFbhBCR8EZUOhCQzMZtKuRhSw7XqMUKTKSZVlrf29m/B7RrrayLIRzZZ4r8B3vFsKo8T0iMZFxb/gKsPplDSIKPMUzZX7MFlDmtwQEboyoNODWIa+1Ri4VWCnwY0Vxmi8ALJMA0X4CER0kAWBZwYviSJkX3sh1NtwnmPuHd1HEgPu/ExjRngLPLvoSn3sJGPNZHL3hHwzTucjEBb9M5LgXvBIJYRQ7dhfNKvhgcBJ3HhuwEK7+BW8VJYIC776aKW26FJg6/MOIio3CrcGSuWHshpfloTJ/ph8tMnH4RW4Y18Op2ZK5YewWkMqSixiuPmHshq+xpHaEMauU+aHNknHX9f17Iykv+VOIjNss2RbGXW1f/QJ2UPnMq9ECDgAAAABJRU5ErkJggg==" style="height: 20px; width: 20px; margin-right: 5px; vertical-align: middle;" />
                  </td>
                  <td style="font-size: 12px; font-weight: 500; border: 1px solid #ddd; padding: 8px;">{_rendimiento_activos_anterior_}</td>
                  <td style="font-size: 12px; font-weight: 500; border: 1px solid #ddd; padding: 8px;">{_rendimiento_activos_previo_anterior_}</td>
              </tr>
            </tbody>
        </table>
      </div>
    ` :
      '';

    const accionista = datos_reporte?.certificacion?.[0]?.accionistas || [];
    logger.info(`${fileMethod} | ${customUuid} | Resumen-accionistas: ${JSON.stringify(accionista)}`)

    const accionistaControlante = accionista.find(a => a.controlante == 1);
    logger.info(`${fileMethod} | ${customUuid} | Resumen-accionista: ${JSON.stringify(accionistaControlante)}`)



    const alertas_preventivas_title = soloCompartirInfoEmpresa === 1 || (accionistaControlante &&
      accionistaControlante.razon_sat_rfc?.trim() === 'La razón social proporcionada no coincide con la registrada en el SAT') ?
      `
      <section style="width: 100%; margin: 0px 0px; margin-top: 60px; page-break-before: always;">
        <div style="display: flex; flex-direction: column;">
        <h3 style="
                  font-size: 16px;
                  font-weight: 700;
                  color: #0a3d8e;
                  text-transform: uppercase;
                  margin: 0px !important;
                  margin-bottom: 5px !important;
                  text-transform: uppercase;
                  
                ">
          ALERTAS PREVENTIVAS DE RESERVA
        </h3>
      </div>
        <div style="display: flex; width: 100%; align-items: center;">
          <hr style="
                    background: #0a3d8e;
                    width: 97%;
                    height: 2px;
                    border: none;
                    margin: 0px !important;
                  " />
          <div style="
                    height: 10px;
                    width: 10px;
                    border-radius: 50%;
                    padding: 1px;
                    background: #0a3d8e;
                  "></div>
        </div>
      </section>
    ` : '';

    const validacion = accionistaControlante &&
      accionistaControlante.razon_sat_rfc?.trim() === 'La razón social proporcionada no coincide con la registrada en el SAT'
      ? `
        <div style="
          margin-top: 2rem;
          margin-bottom: 2rem;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          border: 4px solid #2ba2af;
          padding: 10px 15px;
          background: #f1f8ff;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
          border-radius: 10px;
          ">
          <p style="color: #0a3d8e; font-size: 12px; font-weight: bold; margin-top: 10px; text-align: center;">
            ⚠️ Estimado cliente, le informamos que su comprador notificó un RFC de empresa controlante que no pertenece a la razón social comentada o dicho RFC no está vigente antes SAT por alguna incidencia. Favor de tomar en cuenta este dato para su decisión final.
          </p>
        </div>
      `: '';


    const alertas_preventivas = soloCompartirInfoEmpresa === 1 ?
      `
      <div style="
          margin-top: 2rem;
          margin-bottom: 2rem;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          border: 4px solid #2ba2af;
          padding: 10px 15px;
          background: #f1f8ff;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
          border-radius: 10px;
          ">
           <p style="color: #0a3d8e; font-size: 12px; font-weight: bold; margin-top: 10px; text-align: center;">
             ⚠️ Estimado cliente, este apartado contiene información adicional de validaciones realizadas por Credibusiness. Le sugerimos considerarlas antes de tomar su decisión final sobre el crédito.
           </p>
      </div>
     
      <section>
         <div
          style="background-color: #f1f8ff; border-left: 5px solid #2ba2af; padding: 10px 20px; margin-bottom: 10px; width: 45rem; margin-top: 1rem;">
          <table style="width: 100%; table-layout: fixed; border-collapse: collapse;">
            <colgroup>
              <col style="width: 80%;">
              <col style="width: 20%;">
            </colgroup>
            <thead>
              <tr style="background-color: #2ba2af; color: white; text-align: left;">
                <th style="padding: 10px; white-space: nowrap;">Alertas Cuantitativas</th>
                <th style="padding: 10px; white-space: nowrap;"></th>
              </tr>
            </thead>
            <tbody>
              <tr style="background-color: #ffffff;">
                <td style="color: #0a3d8e; font-size: 12px; font-weight: 500; padding: 10px; white-space: nowrap;">Incremento
                  de caja y bancos >200%</td>
                <td style="font-size: 12px; font-weight: 500; padding: 10px; border: 1px solid #ddd;">
                  {_incremento_caja_bancos_}</td>
              </tr>
              <tr style="background-color: #ffffff;">
                <td style="color: #0a3d8e; font-size: 12px; font-weight: 500; padding: 10px; white-space: nowrap;">Incremento
                  de Ventas anuales > 60%</td>
                <td style="font-size: 12px; font-weight: 500; padding: 10px; border: 1px solid #ddd;">
                  {_incremento_ventas_anuales_}</td>
              </tr>
              <tr style="background-color: #ffffff;">
                <td style="color: #0a3d8e; font-size: 12px; font-weight: 500; padding: 10px; white-space: nowrap;">Decremento
                  de costo de ventas anual > 60%</td>
                <td style="font-size: 12px; font-weight: 500; padding: 10px; border: 1px solid #ddd;">
                  {_decremento_costo_ventas_anuales_}</td>
              </tr>
              <tr style="background-color: #ffffff;">
                <td style="color: #0a3d8e; font-size: 12px; font-weight: 500; padding: 10px; white-space: nowrap;">Decremento
                  de Gatos de Administración >60%</td>
                <td style="font-size: 12px; font-weight: 500; padding: 10px; border: 1px solid #ddd;">
                  {_decremento_gastos_administracion_}</td>
              </tr>
              <tr style="background-color: #ffffff;">
                <td style="color: #0a3d8e; font-size: 12px; font-weight: 500; padding: 10px; white-space: nowrap;">Incremento
                  de Utilidad Operativa > 50%</td>
                <td style="font-size: 12px; font-weight: 500; padding: 10px; border: 1px solid #ddd;">
                  {_incremento_utilidad_operativa_}</td>
              </tr>
              <tr style="background-color: #ffffff;">
                <td style="color: #0a3d8e; font-size: 12px; font-weight: 500; padding: 10px; white-space: nowrap;">Incremento
                  de Activo total >60%</td>
                <td style="font-size: 12px; font-weight: 500; padding: 10px; border: 1px solid #ddd;">
                  {_incremento_total_activo_}</td>
              </tr>
              <tr style="background-color: #ffffff;">
                <td style="color: #0a3d8e; font-size: 12px; font-weight: 500; padding: 10px; white-space: nowrap;">Decremento
                  de Pasivo Total >60%</td>
                <td style="font-size: 12px; font-weight: 500; padding: 10px; border: 1px solid #ddd;">
                  {_decremento_total_pasivo_}</td>
              </tr>
              <tr style="background-color: #ffffff;">
                <td style="color: #0a3d8e; font-size: 12px; font-weight: 500; padding: 10px; white-space: nowrap;">Incremento
                  de Capital Social > 60%</td>
                <td style="font-size: 12px; font-weight: 500; padding: 10px; border: 1px solid #ddd;">
                  {_incremento_capital_social_}</td>
              </tr>
              <tr style="background-color: #ffffff;">
                <td style="color: #0a3d8e; font-size: 12px; font-weight: 500; padding: 10px; white-space: nowrap;">Decremento
                  de Capital social > 60%</td>
                <td style="font-size: 12px; font-weight: 500; padding: 10px; border: 1px solid #ddd;">
                  {_decremento_capital_social_}</td>
              </tr>
              <tr style="background-color: #ffffff;">
                <td style="color: #0a3d8e; font-size: 12px; font-weight: 500; padding: 10px; white-space: nowrap;">Incremento
                  de Total de capital contable o patrimonio> 60%</td>
                <td style="font-size: 12px; font-weight: 500; padding: 10px; border: 1px solid #ddd;">
                  {_incremento_capital_contable_}</td>
              </tr>
              <tr style="background-color: #ffffff;">
                <td style="color: #0a3d8e; font-size: 12px; font-weight: 500; padding: 10px; white-space: nowrap;">Decremento
                  de Total de capital contable o patrimonio> 60%</td>
                <td style="font-size: 12px; font-weight: 500; padding: 10px; border: 1px solid #ddd;">
                  {_decremento_capital_contable_}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    `
      : '';

    strHTML_paso = strHTML_paso.replace('{_emp_id_}', emp_id);
    strHTML_paso = strHTML_paso.replace('{_giro_}', giro);
    strHTML_paso = strHTML_paso.replace('{_valores_}', valores);
    strHTML_paso = strHTML_paso.replace('{_proposito_}', proposito);
    strHTML_paso = strHTML_paso.replace('{_emp_desc_}', emp_desc);
    strHTML_paso = strHTML_paso.replace('{_emp_mision_}', emp_mision);
    strHTML_paso = strHTML_paso.replace('{_emp_vision_}', emp_vision);

    strHTML_paso = strHTML_paso.replace('{_ratios_}', ratios_);

    strHTML_paso = strHTML_paso.replace('{_alertas_preventivas_title_}', alertas_preventivas_title);
    strHTML_paso = strHTML_paso.replace('{_validacion_}', validacion);
    strHTML_paso = strHTML_paso.replace('{_alertas_preventivas_}', alertas_preventivas);

    strHTML_paso = strHTML_paso.replace('{_empresas_info_basica_}', empresas_info_basica);
    // Variables para mostrar alertas
    strHTML_paso = strHTML_paso.replace('{_endeudamiento_comer_}', endeudamiento_comer)
    strHTML_paso = strHTML_paso.replace('{_DSO_SUGERIDO_}', DSO_SUGERIDO)

    strHTML_paso = strHTML_paso.replace('{_valores_}', infoEmpresa.result[0].valores)
    strHTML_paso = strHTML_paso.replace('{_imPortaciones_}', imPortaciones)
    strHTML_paso = strHTML_paso.replace('{_imExportaciones_}', imExportaciones)

    strHTML_paso = strHTML_paso.replace('{_mercado_obgetivo_}', m_o_p_c)
    strHTML_paso = strHTML_paso.replace('{_REFERENCIAS_COMERCIALES_}', REFERENCIAS_C || '');
    //strHTML_paso = strHTML_paso.replace('{_REFERENCIAS_CONSIDERADAS_}', REFERENCIAS_CONSIDERADAS || '');

    // Deploy
    strHTML_paso = strHTML_paso.replace('{_REFERENCIAS_CONSIDERADAS_}', '');

    logger.info(`${fileMethod} | ${customUuid} | Encabezado con HTML: ${JSON.stringify(strHTML_paso)}`)

    strHTML_paso = strHTML_paso.replace('{_noCompartir_}', mensaje_no_compartir)
    strHTML_paso = strHTML_paso.replace('{_tabla_1_}', tabla_1)
    strHTML_paso = strHTML_paso.replace('{_tabla_2_}', tabla_2)
    strHTML_paso = strHTML_paso.replace('{_ActividadGiro_}', actividad_economica[0]?.industria_nombre || '-')

    strHTML_paso = strHTML_paso.replace('{_color1_}', colorHexagono[0])
    strHTML_paso = strHTML_paso.replace('{_color2_}', colorHexagono[1])
    strHTML_paso = strHTML_paso.replace('{_color3_}', colorHexagono[2])
    strHTML_paso = strHTML_paso.replace('{_color4_}', colorHexagono[3])
    strHTML_paso = strHTML_paso.replace('{_color5_}', colorHexagono[4])
    strHTML_paso = strHTML_paso.replace('{_color6_}', colorHexagono[5])
    strHTML_paso = strHTML_paso.replace('{_color7_}', colorHexagono[6])


    strHTML_paso = strHTML_paso.replace('{_periodo_anterior_}', periodo_anterior ?? '')
    strHTML_paso = strHTML_paso.replace('{_periodo_previo_anterior_}', periodo_previo_anterior ?? '')
    // IMPORT-EXPORT
    /* strHTML_paso = strHTML_paso.replace('{_imports_}', imports)
    strHTML_paso = strHTML_paso.replace('{_exports_}', exportts) */

    // Encabezado
    function limpiarCampo(valor) {
      return valor && valor.trim() !== '' && valor !== '-' ? valor : '';
    }

    strHTML_paso = strHTML_paso.replace('{_razon_social_}', encabezado.razon_social);
    strHTML_paso = strHTML_paso.replace('{_rfc_}', encabezado.rfc);
    strHTML_paso = strHTML_paso.replace('{_pais_}', paisLimpio);
    strHTML_paso = strHTML_paso.replace('{_direccion_fiscal_}', encabezado.direccion_fiscal);
    strHTML_paso = strHTML_paso.replace('{_telefono_}', telefonoLimpio);
    strHTML_paso = strHTML_paso.replace('{_correo_}', correoLimpio);
    strHTML_paso = strHTML_paso.replace('{_pagina_web_}', encabezado.pagina_web);
    logger.info(`${fileMethod} | ${customUuid} | Encabezado con HTML: ${JSON.stringify(strHTML_paso)}`)

    function escapeHTML(str) {
      if (str == null) return ''
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    // Resumen

    strHTML_paso = strHTML_paso.replace('{_resumen_experiencia_}', escapeHTML(resumen.experiencia || '-'));
    strHTML_paso = strHTML_paso.replace('{_resumen_plantilla_laboral_}', resumen.plantilla_laboral || '-');
    strHTML_paso = strHTML_paso.replace('{_resumen_actividad_economica_}', resumen.actividad_economica);
    strHTML_paso = strHTML_paso.replace('{_resumen_sector_}', resumen.sector || '-');
    strHTML_paso = strHTML_paso.replace('{_resumen_sector_cliente_final_}', resumen.sector_cliente_final || '-');
    strHTML_paso = strHTML_paso.replace('{_resumen_empresa_controlante_rfc_}', resumen.empresa_controlante_rfc);
    strHTML_paso = strHTML_paso.replace('{_resumen_empresa_controlante_razon_social_}', resumen.empresa_controlante_razon_social);
    strHTML_paso = strHTML_paso.replace('{_resumen_capital_contable_}', resumen.capital_contable);
    strHTML_paso = strHTML_paso.replace('{_resumen_ventas_anuales_}', resumen.ventas_anuales);
    strHTML_paso = strHTML_paso.replace('{_resumen_caja_bancos_}', resumen.caja_bancos);
    strHTML_paso = strHTML_paso.replace('{_resumen_linea_credito_}', lineaCreditoLimpio);
    strHTML_paso = strHTML_paso.replace('{_resumen_plazo_pago_}', resumen.plazo_pago);
    strHTML_paso = strHTML_paso.replace('{_resumen_ventas_gobierno_}', resumen.ventas_gobierno);
    strHTML_paso = strHTML_paso.replace('{_resumen_empresas_relacionadas_}', resumen.empresas_relacionadas);
    strHTML_paso = strHTML_paso.replace('{_resumen_fecha_actualizacion_69_69B_}', resumen.fecha_actualizacion_69_69B);
    logger.info(`${fileMethod} | ${customUuid} | Resumen con HTML: ${JSON.stringify(strHTML_paso)}`)


    // Seteamos resultados
    strHTML_paso = strHTML_paso.replace('{_resultados_linea_credito_solicitada_}', resultados.linea_credito_solicitada);
    strHTML_paso = strHTML_paso.replace('{_resultados_riesgo_}', resultados.riesgo);
    strHTML_paso = strHTML_paso.replace('{_riesgoTexto_}', riesgoTexto);
    strHTML_paso = strHTML_paso.replace('{_resultados_riesgo_descripcion_}', resultados.riesgo_descripcion);
    strHTML_paso = strHTML_paso.replace('{_resultados_linea_credito_recomendada_}', resultados.linea_credito_recomendada);

    strHTML_paso = strHTML_paso.replace('{_resultados_porcentaje_endeudamiento_comercial_}', resultados.porcentaje_endeudamiento_comercial);
    strHTML_paso = strHTML_paso.replace('{_resultados_porcentaje_endeudamiento_comercial_descripcion_}', resultados.porcentaje_endeudamiento_comercial_descripcion);

    strHTML_paso = strHTML_paso.replace('{_resultados_dias_recomendacion_DSO_}', resultados.dias_recomendacion_DSO);
    strHTML_paso = strHTML_paso.replace('{_resultados_dias_recomendacion_DSO_descripcion_}', resultados.dias_recomendacion_DSO_descripcion);
    logger.info(`${fileMethod} | ${customUuid} | Resultados HTML: ${JSON.stringify(strHTML_paso)}`)


    // Balance
    // 
    strHTML_paso = strHTML_paso.replace(/{_performance_financiero_balance_anio_anterior_indicador_}/g, performance_financiero.balance_anio_anterior_indicador);
    // 
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_anterior_caja_bancos_}', performance_financiero.balance_anio_anterior_caja_bancos);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_anterior_saldo_clientes_}', performance_financiero.balance_anio_anterior_saldo_clientes);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_anterior_saldo_inventarios_}', performance_financiero.balance_anio_anterior_saldo_inventarios);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_anterior_deudores_diversos_}', performance_financiero.balance_anio_anterior_deudores_diversos);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_anterior_otros_activos_}', performance_financiero.balance_anio_anterior_otros_activos);
    // strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_anterior_total_activo_circulante_}', performance_financiero.balance_anio_anterior_total_activo_circulante);
    // 
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_anterior_total_activo_fijo_}', performance_financiero.balance_anio_anterior_total_activo_fijo);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_anterior_activo_intangible_}', performance_financiero.balance_anio_anterior_activo_intangible);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_anterior_activo_diferido_}', performance_financiero.balance_anio_anterior_activo_diferido);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_anterior_otros_activos_fijos_largo_plazo_}', performance_financiero.balance_anio_anterior_otros_activos_fijos_largo_plazo);
    // strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_anterior_total_activos_fijo_}', (
    //   Number(performance_financiero.balance_anio_anterior_total_activo_fijo) +
    //   Number(performance_financiero.balance_anio_anterior_activo_intangible) +
    //   Number(performance_financiero.balance_anio_anterior_activo_diferido) +
    //   Number(performance_financiero.balance_anio_anterior_otros_activos_fijos_largo_plazo))
    // );
    // strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_anterior_activo_total_}', (
    //   Number(performance_financiero.balance_anio_anterior_total_activo_fijo) +
    //   Number(performance_financiero.balance_anio_anterior_activo_intangible) +
    //   Number(performance_financiero.balance_anio_anterior_activo_diferido) +
    //   Number(performance_financiero.balance_anio_anterior_otros_activos_fijos_largo_plazo) +
    //   Number(performance_financiero.balance_anio_anterior_total_activo_circulante))
    // );
    // 
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_anterior_proveedores_}', performance_financiero.balance_anio_anterior_proveedores);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_anterior_acreedores_}', performance_financiero.balance_anio_anterior_acreedores);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_anterior_inpuestos_x_pagar_}', performance_financiero.balance_anio_anterior_inpuestos_x_pagar);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_anterior_otros_pasivos_}', performance_financiero.balance_anio_anterior_otros_pasivos);
    // strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_anterior_total_pasivo_circulante_}', performance_financiero.balance_anio_anterior_total_pasivo_circulante);
    // 
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_anterior_total_pasivo_largo_plazo_}', performance_financiero.balance_anio_anterior_total_pasivo_largo_plazo);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_anterior_pasivo_diferido_}', performance_financiero.balance_anio_anterior_pasivo_diferido);
    // strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_anterior_total_pasivos_largo_plazo_}', (Number(performance_financiero.balance_anio_anterior_total_pasivo_largo_plazo) + Number(performance_financiero.balance_anio_anterior_otros_pasivos_largo_plazo)));
    // strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_anterior_pasivo_total_}', (Number(performance_financiero.balance_anio_anterior_total_pasivo_circulante) + Number(performance_financiero.balance_anio_anterior_total_pasivo_largo_plazo) + Number(performance_financiero.balance_anio_anterior_otros_pasivos_largo_plazo)));
    // 
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_anterior_capital_social_}', performance_financiero.balance_anio_anterior_capital_social);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_anterior_resultado_ejercicios_anteriores_}', performance_financiero.balance_anio_anterior_resultado_ejercicios_anteriores);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_anterior_resultado_ejercicios_}', performance_financiero.balance_anio_anterior_resultado_ejercicios);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_anterior_otro_capital_}', performance_financiero.balance_anio_anterior_otro_capital);
    // strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_anterior_total_capital_contable_pat_}', performance_financiero.balance_anio_anterior_total_capital_contable_pat);

    // strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_anterior_deuda_corto_plazo_}', performance_financiero.balance_anio_anterior_deuda_corto_plazo);
    // strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_anterior_deuda_total_}', performance_financiero.balance_anio_anterior_deuda_total);
    // strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_anterior_capital_contable_}', performance_financiero.balance_anio_anterior_capital_contable);

    strHTML_paso = strHTML_paso.replace(/{_performance_financiero_balance_anio_previo_anterior_indicador_}/g, performance_financiero.balance_anio_previo_anterior_indicador);

    // 
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_previo_anterior_caja_bancos_}', performance_financiero.balance_anio_previo_anterior_caja_bancos);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_previo_anterior_saldo_clientes_}', performance_financiero.balance_anio_previo_anterior_saldo_clientes);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_previo_anterior_saldo_inventarios_}', performance_financiero.balance_anio_previo_anterior_saldo_inventarios);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_previo_anterior_deudores_diversos_}', performance_financiero.balance_anio_previo_anterior_deudores_diversos);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_previo_anterior_otros_activos_}', performance_financiero.balance_anio_previo_anterior_otros_activos);
    // strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_previo_anterior_total_activo_circulante_}', performance_financiero.balance_anio_previo_anterior_total_activo_circulante);
    // 
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_previo_anterior_total_activo_fijo_}', performance_financiero.balance_anio_previo_anterior_total_activo_fijo);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_previo_anterior_activo_intangible_}', performance_financiero.balance_anio_previo_anterior_activo_intangible);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_previo_anterior_activo_diferido_}', performance_financiero.balance_anio_previo_anterior_activo_diferido);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_previo_anterior_otros_activos_fijos_largo_plazo_}', performance_financiero.balance_anio_previo_anterior_otros_activos_fijos_largo_plazo);
    // strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_previo_anterior_total_activos_fijo_}', (
    //   Number(performance_financiero.balance_anio_previo_anterior_total_activo_fijo) +
    //   Number(performance_financiero.balance_anio_previo_anterior_activo_intangible) +
    //   Number(performance_financiero.balance_anio_previo_anterior_activo_diferido) +
    //   Number(performance_financiero.balance_anio_previo_anterior_otros_activos_fijos_largo_plazo))
    // );
    // strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_previo_anterior_activo_total_}', (
    //   Number(performance_financiero.balance_anio_previo_anterior_total_activo_fijo) +
    //   Number(performance_financiero.balance_anio_previo_anterior_activo_intangible) +
    //   Number(performance_financiero.balance_anio_previo_anterior_activo_diferido) +
    //   Number(performance_financiero.balance_anio_previo_anterior_otros_activos_fijos_largo_plazo) +
    //   Number(performance_financiero.balance_anio_previo_anterior_total_activo_circulante))
    // );
    // 
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_previo_anterior_proveedores_}', performance_financiero.balance_anio_previo_anterior_proveedores);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_previo_anterior_acreedores_}', performance_financiero.balance_anio_previo_anterior_acreedores);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_previo_anterior_inpuestos_x_pagar_}', performance_financiero.balance_anio_previo_anterior_inpuestos_x_pagar);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_previo_anterior_otros_pasivos_}', performance_financiero.balance_anio_previo_anterior_otros_pasivos);
    // strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_previo_anterior_total_pasivo_circulante_}', performance_financiero.balance_anio_previo_anterior_total_pasivo_circulante);
    // 
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_previo_anterior_total_pasivo_largo_plazo_}', performance_financiero.balance_anio_previo_anterior_total_pasivo_largo_plazo);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_previo_anterior_pasivo_diferido_}', performance_financiero.balance_anio_previo_anterior_pasivo_diferido);
    // strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_previo_anterior_total_pasivos_largo_plazo_}', (Number(performance_financiero.balance_anio_previo_anterior_total_pasivo_largo_plazo) + Number(performance_financiero.balance_anio_previo_anterior_otros_pasivos_largo_plazo)));
    // strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_previo_anterior_pasivo_total_}', (Number(performance_financiero.balance_anio_previo_anterior_total_pasivo_circulante) + Number(performance_financiero.balance_anio_previo_anterior_total_pasivo_largo_plazo) + Number(performance_financiero.balance_anio_previo_anterior_otros_pasivos_largo_plazo)));
    // 
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_previo_anterior_capital_social_}', performance_financiero.balance_anio_previo_anterior_capital_social);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_previo_anterior_resultado_ejercicios_anteriores_}', performance_financiero.balance_anio_previo_anterior_resultado_ejercicios_anteriores);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_previo_anterior_resultado_ejercicios_}', performance_financiero.balance_anio_previo_anterior_resultado_ejercicios);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_previo_anterior_otro_capital_}', performance_financiero.balance_anio_previo_anterior_otro_capital);
    // strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_previo_anterior_total_capital_contable_pat_}', performance_financiero.balance_anio_previo_anterior_total_capital_contable_pat);

    // strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_previo_anterior_deuda_corto_plazo_}', performance_financiero.balance_anio_previo_anterior_deuda_corto_plazo);
    // strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_previo_anterior_deuda_total_}', performance_financiero.balance_anio_previo_anterior_deuda_total);
    // strHTML_paso = strHTML_paso.replace('{_performance_financiero_balance_anio_previo_anterior_capital_contable_}', performance_financiero.balance_anio_previo_anterior_capital_contable);
    logger.info(`${fileMethod} | ${customUuid} | Estado de balance HTML: ${JSON.stringify(strHTML_paso)}`)

    // Estado de Resultados
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_estado_resultados_anio_anterior_indicador_}', performance_financiero.estado_resultados_anio_anterior_indicador);
    // 
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_estado_resultados_anio_anterior_ventas_anuales_}', performance_financiero.estado_resultados_anio_anterior_ventas_anuales);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_estado_resultados_anio_anterior_costo_ventas_anuales_}', performance_financiero.estado_resultados_anio_anterior_costo_ventas_anuales);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_estado_resultados_anio_anterior_utilidad_bruta_}', performance_financiero.estado_resultados_anio_anterior_utilidad_bruta);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_estado_resultados_anio_anterior_gastos_administracion_}', performance_financiero.estado_resultados_anio_anterior_gastos_administracion);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_estado_resultados_anio_anterior_utilidad_operativa_}', performance_financiero.estado_resultados_anio_anterior_utilidad_operativa);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_estado_resultados_anio_anterior_depreciacion_amortizacion_}', performance_financiero.estado_resultados_anio_anterior_depreciacion_amortizacion);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_estado_resultados_anio_anterior_otros_ingresos_}', performance_financiero.estado_resultados_anio_anterior_otros_ingresos);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_estado_resultados_anio_anterior_otros_gastos_}', performance_financiero.estado_resultados_anio_anterior_otros_gastos);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_estado_resultados_anio_anterior_gastos_productos_financieros_}', performance_financiero.estado_resultados_anio_anterior_gastos_productos_financieros);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_estado_resultados_anio_anterior_otros_egresos_}', performance_financiero.estado_resultados_anio_anterior_otros_egresos);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_estado_resultados_anio_anterior_utilidad_neta_}', performance_financiero.estado_resultados_anio_anterior_utilidad_neta);
    // strHTML_paso = strHTML_paso.replace('{_performance_financiero_estado_resultados_anio_anterior_total_partidas_estado_}', (
    //   Number(performance_financiero.estado_resultados_anio_anterior_ventas_anuales) +
    //   Number(performance_financiero.estado_resultados_anio_anterior_costo_ventas_anuales) +
    //   Number(performance_financiero.estado_resultados_anio_anterior_utilidad_bruta) +
    //   Number(performance_financiero.estado_resultados_anio_anterior_gastos_administracion) +
    //   Number(performance_financiero.estado_resultados_anio_anterior_utilidad_operativa) +
    //   Number(performance_financiero.estado_resultados_anio_anterior_depreciacion_amortizacion) +
    //   Number(performance_financiero.estado_resultados_anio_anterior_otros_ingresos) +
    //   Number(performance_financiero.estado_resultados_anio_anterior_otros_gastos) +
    //   Number(performance_financiero.estado_resultados_anio_anterior_gastos_productos_financieros) +
    //   Number(performance_financiero.estado_resultados_anio_anterior_otros_egresos) +
    //   Number(performance_financiero.estado_resultados_anio_anterior_utilidad_neta)
    // ));
    // strHTML_paso = strHTML_paso.replace('{_performance_financiero_estado_resultados_anio_anterior_suma_comprobacion_}', (Number(performance_financiero.estado_resultados_anio_anterior_utilidad_neta) - Number(performance_financiero.balance_anio_previo_anterior_resultado_ejercicios)));


    // strHTML_paso = strHTML_paso.replace('{_performance_financiero_estado_resultados_anio_anterior_costo_ventas_}', performance_financiero.estado_resultados_anio_anterior_costo_ventas);
    // strHTML_paso = strHTML_paso.replace('{_performance_financiero_estado_resultados_anio_anterior_utilidad_operativa_}', performance_financiero.estado_resultados_anio_anterior_utilidad_operativa);

    strHTML_paso = strHTML_paso.replace('{_performance_financiero_estado_resultados_anio_previo_anterior_indicador_}', performance_financiero.estado_resultados_anio_previo_anterior_indicador);
    // 
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_estado_resultados_anio_previo_anterior_ventas_anuales_}', performance_financiero.estado_resultados_anio_previo_anterior_ventas_anuales);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_estado_resultados_anio_previo_anterior_costo_ventas_anuales_}', performance_financiero.estado_resultados_anio_previo_anterior_costo_ventas_anuales);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_estado_resultados_anio_previo_anterior_utilidad_bruta_}', performance_financiero.estado_resultados_anio_previo_anterior_utilidad_bruta);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_estado_resultados_anio_previo_anterior_gastos_administracion_}', performance_financiero.estado_resultados_anio_previo_anterior_gastos_administracion);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_estado_resultados_anio_previo_anterior_utilidad_operativa_}', performance_financiero.estado_resultados_anio_previo_anterior_utilidad_operativa);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_estado_resultados_anio_previo_anterior_depreciacion_amortizacion_}', performance_financiero.estado_resultados_anio_previo_anterior_depreciacion_amortizacion);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_estado_resultados_anio_previo_anterior_otros_ingresos_}', performance_financiero.estado_resultados_anio_previo_anterior_otros_ingresos);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_estado_resultados_anio_previo_anterior_otros_gastos_}', performance_financiero.estado_resultados_anio_previo_anterior_otros_gastos);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_estado_resultados_anio_previo_anterior_gastos_productos_financieros_}', performance_financiero.estado_resultados_anio_previo_anterior_gastos_productos_financieros);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_estado_resultados_anio_previo_anterior_otros_egresos_}', performance_financiero.estado_resultados_anio_previo_anterior_otros_egresos);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_estado_resultados_anio_previo_anterior_utilidad_neta_}', performance_financiero.estado_resultados_anio_previo_anterior_utilidad_neta);
    // strHTML_paso = strHTML_paso.replace('{_performance_financiero_estado_resultados_anio_previo_anterior_total_partidas_estado_}', (
    //   Number(performance_financiero.estado_resultados_anio_previo_anterior_ventas_anuales) +
    //   Number(performance_financiero.estado_resultados_anio_previo_anterior_costo_ventas_anuales) +
    //   Number(performance_financiero.estado_resultados_anio_previo_anterior_utilidad_bruta) +
    //   Number(performance_financiero.estado_resultados_anio_previo_anterior_gastos_administracion) +
    //   Number(performance_financiero.estado_resultados_anio_previo_anterior_utilidad_operativa) +
    //   Number(performance_financiero.estado_resultados_anio_previo_anterior_depreciacion_amortizacion) +
    //   Number(performance_financiero.estado_resultados_anio_previo_anterior_otros_ingresos) +
    //   Number(performance_financiero.estado_resultados_anio_previo_anterior_otros_gastos) +
    //   Number(performance_financiero.estado_resultados_anio_previo_anterior_gastos_productos_financieros) +
    //   Number(performance_financiero.estado_resultados_anio_previo_anterior_otros_egresos) +
    //   Number(performance_financiero.estado_resultados_anio_previo_anterior_utilidad_neta)
    // ));
    // strHTML_paso = strHTML_paso.replace('{_performance_financiero_estado_resultados_anio_previo_anterior_suma_comprobacion_}', (Number(performance_financiero.estado_resultados_anio_previo_anterior_utilidad_neta) - Number(performance_financiero.balance_anio_previo_previo_anterior_resultado_ejercicios)));

    // strHTML_paso = strHTML_paso.replace('{_performance_financiero_estado_resultados_anio_previo_anterior_costo_ventas_}', performance_financiero.estado_resultados_anio_previo_anterior_costo_ventas);
    // strHTML_paso = strHTML_paso.replace('{_performance_financiero_estado_resultados_anio_previo_anterior_utilidad_operativa_}', performance_financiero.estado_resultados_anio_previo_anterior_utilidad_operativa);
    logger.info(`${fileMethod} | ${customUuid} | Estado de resultados HTML: ${JSON.stringify(strHTML_paso)}`)


    // Seteamos Ratio Financiero
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_ratio_financiero_indicador_}', ratio_financiero.ratio_financiero_indicador);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_ratio_financiero_ventas_anuales_}', ratio_financiero.ratio_financiero_ventas_anuales);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_ratio_financiero_evolucion_Ventas_}', ratio_financiero.ratio_financiero_evolucion_Ventas);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_ratio_financiero_payback_}', ratio_financiero.ratio_financiero_payback);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_ratio_financiero_apalancamiento_}', ratio_financiero.ratio_financiero_apalancamiento);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_ratio_financiero_DSO_}', ratio_financiero.ratio_financiero_DSO);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_ratio_financiero_DIO_}', ratio_financiero.ratio_financiero_DIO);
    strHTML_paso = strHTML_paso.replace('{_performance_financiero_ratio_financiero_flujo_caja_}', ratio_financiero.ratio_financiero_flujo_caja);
    logger.info(`${fileMethod} | ${customUuid} | Ratio financiero HTML: ${JSON.stringify(strHTML_paso)}`)

    strHTML_paso = strHTML_paso.replace('{_credito_total_}', mercado_objetivo_estructura_ventas.credito_total);
    strHTML_paso = strHTML_paso.replace('{_contado_total_}', mercado_objetivo_estructura_ventas.contado_total);
    strHTML_paso = strHTML_paso.replace('{_ventas_gobierno_}', mercado_objetivo_estructura_ventas.ventas_gobierno);
    logger.info(`${fileMethod} | ${customUuid} | Estructura de Ventas HTML: ${JSON.stringify(strHTML_paso)}`)

    // Reemplazar el marcador con las razones sociales
    strHTML_paso = strHTML_paso.replace('{_item_}', razonesSociales);
    logger.info(`${fileMethod} | ${customUuid} | Referencias Comereciales - prueba HTML: ${JSON.stringify(strHTML_paso)}`)

    strHTML_paso = strHTML_paso.replace('{_items_}', empresasRelaciones);
    logger.info(`${fileMethod} | ${customUuid} | Referencias Comereciales - prueba HTML: ${JSON.stringify(strHTML_paso)}`)
    strHTML_paso = strHTML_paso.replace('{_empresas_relacionadad_}', empresas_relacionadad)
    // Ratios 
    strHTML_paso = strHTML_paso.replace('{_capital_trabajo_anterior_}', nuevosRatios.capital_trabajo_anterior);
    strHTML_paso = strHTML_paso.replace('{_capital_trabajo_previo_anterior_}', nuevosRatios.capital_trabajo_previo_anterior);

    strHTML_paso = strHTML_paso.replace('{_capital_trabajo_anterior2_}', nuevosRatios.capital_trabajo_anterior_2);
    strHTML_paso = strHTML_paso.replace('{_capital_trabajo_previo_anterior2_}', nuevosRatios.capital_trabajo_previo_anterior_2);

    strHTML_paso = strHTML_paso.replace('{_prueba_acida_anterior_}', nuevosRatios.prueba_acida_anterior);
    strHTML_paso = strHTML_paso.replace('{_prueba_acida_previo_anterior_}', nuevosRatios.prueba_acida_previo_anterior);

    strHTML_paso = strHTML_paso.replace('{_grado_general_endeudamiento_anterior_}', nuevosRatios.grado_general_endeudamiento_anterior);
    strHTML_paso = strHTML_paso.replace('{_grado_general_endeudamiento_previo_anterior_}', nuevosRatios.grado_general_endeudamiento_previo_anterior);

    strHTML_paso = strHTML_paso.replace('{_apalancamiento_anterior_}', nuevosRatios.apalancamiento_anterior);
    strHTML_paso = strHTML_paso.replace('{_apalancamiento_previo_anterior_}', nuevosRatios.apalancamiento_previo_anterior);

    strHTML_paso = strHTML_paso.replace('{_formula_1_inventarios_rotacion_anterior_}', nuevosRatios.formula_1_inventarios_rotacion_anterior);
    strHTML_paso = strHTML_paso.replace('{_formula_1_inventarios_rotacion_previo_anterior_}', nuevosRatios.formula_1_inventarios_rotacion_previo_anterior);

    strHTML_paso = strHTML_paso.replace('{_formula_1_inventarios_rotacion_anterior2_}', nuevosRatios.formula_1_inventarios_rotacion_anterior_2);
    strHTML_paso = strHTML_paso.replace('{_formula_1_inventarios_rotacion_previo_anterior2_}', nuevosRatios.formula_1_inventarios_rotacion_previo_anterior_2);

    strHTML_paso = strHTML_paso.replace('{_rotacion_ctas_x_cobrar_anterior_}', nuevosRatios.rotacion_ctas_x_cobrar_anterior);
    strHTML_paso = strHTML_paso.replace('{_rotacion_ctas_x_cobrar_previo_anterior_}', nuevosRatios.rotacion_ctas_x_cobrar_previo_anterior);

    strHTML_paso = strHTML_paso.replace('{_rotacion_pagos_anterior_}', nuevosRatios.rotacion_pagos_anterior);
    strHTML_paso = strHTML_paso.replace('{_rotacion_pagos_previo_anterior_}', nuevosRatios.rotacion_pagos_previo_anterior);

    strHTML_paso = strHTML_paso.replace('{_solvencia_anterior_}', nuevosRatios.solvencia_anterior);
    strHTML_paso = strHTML_paso.replace('{_solvencia_previo_anterior_}', nuevosRatios.solvencia_previo_anterior);

    strHTML_paso = strHTML_paso.replace('{_retorno_capital_acciones_anterior_}', nuevosRatios.retorno_capital_acciones_anterior);
    strHTML_paso = strHTML_paso.replace('{_retorno_capital_acciones_previo_anterior_}', nuevosRatios.retorno_capital_acciones_previo_anterior);

    strHTML_paso = strHTML_paso.replace('{_rendimiento_capital_anterior_}', nuevosRatios.rendimiento_capital_anterior);
    strHTML_paso = strHTML_paso.replace('{_rendimiento_capital_previo_anterior_}', nuevosRatios.rendimiento_capital_previo_anterior);

    strHTML_paso = strHTML_paso.replace('{_rendimiento_activos_anterior_}', nuevosRatios.rendimiento_activos_anterior);
    strHTML_paso = strHTML_paso.replace('{_rendimiento_activos_previo_anterior_}', nuevosRatios.rendimiento_activos_previo_anterior);
    logger.info(`${fileMethod} | ${customUuid} | Nuevos Ratios HTML: ${JSON.stringify(strHTML_paso)}`)

    strHTML_paso = strHTML_paso.replace('{_accionistas_}', accionistasMayoritariosHTML);

    strHTML_paso = strHTML_paso.replace('{_directores_}', directoresPrincipalesHTML);

    strHTML_paso = strHTML_paso.replace('{_personal_}', html_personal);
    logger.info(`${fileMethod} | ${customUuid} | Personal HTML: ${JSON.stringify(strHTML_paso)}`)

    strHTML_paso = strHTML_paso.replace('{_transporte_}', html_transporte);
    logger.info(`${fileMethod} | ${customUuid} | Personal HTML: ${JSON.stringify(html_transporte)}`)

    logger.info(`${fileMethod} | ${customUuid} | Equipo de transporte HTML: ${JSON.stringify(strHTML_paso)}`)

    strHTML_paso = strHTML_paso.replace('{_seguros_}', html_seguros);
    logger.info(`${fileMethod} | ${customUuid} | Seguros HTML: ${JSON.stringify(strHTML_paso)}`)

    strHTML_paso = strHTML_paso.replace('{_referenciasComerciales_}', referenciasComerciales);
    strHTML_paso = strHTML_paso.replace('{_incidenciasMercantiles_}', incidenciasMercantiles);
    strHTML_paso = strHTML_paso.replace('{_contribuyenteIncumplido_}', contribuyenteIncumplido);

    /* Bloque para setear Alertas Cuantitativas */
    strHTML_paso = strHTML_paso.replace('{_incremento_caja_bancos_}', resultado.incremento_caja_bancos);
    strHTML_paso = strHTML_paso.replace('{_incremento_ventas_anuales_}', resultado.incremento_ventas_anuales);
    strHTML_paso = strHTML_paso.replace('{_decremento_costo_ventas_anuales_}', resultado.decremento_costo_ventas_anuales);
    strHTML_paso = strHTML_paso.replace('{_decremento_gastos_administracion_}', resultado.decremento_gastos_administracion);
    strHTML_paso = strHTML_paso.replace('{_incremento_utilidad_operativa_}', resultado.incremento_utilidad_operativa);
    strHTML_paso = strHTML_paso.replace('{_incremento_total_activo_}', resultado.incremento_total_activo);
    strHTML_paso = strHTML_paso.replace('{_decremento_total_pasivo_}', resultado.decremento_total_pasivo);
    strHTML_paso = strHTML_paso.replace('{_incremento_capital_social_}', resultado.incremento_capital_social);
    strHTML_paso = strHTML_paso.replace('{_decremento_capital_social_}', resultado.decremento_capital_social);
    strHTML_paso = strHTML_paso.replace('{_incremento_capital_contable_}', resultado.incremento_capital_contable);
    strHTML_paso = strHTML_paso.replace('{_decremento_capital_contable_}', resultado.decremento_capital_contable)
    logger.info(`${fileMethod} | ${customUuid} | Ratio financiero HTML: ${JSON.stringify(strHTML_paso)}`)

    // Seteamos Accionistas
    strHTML_paso = strHTML_paso.replace('{_accionistas_}', accionistas?.map(
      (accionista) => (`          
          <div
            style="
              display: grid;
              grid-template-columns: 3fr 1.5fr 1.5fr;
              padding: 2.5px 0px;
              border-bottom: 1px solid #787878;
            "
          >
            <div style="display: flex; align-items: flex-start;">
              <p
                style="
                  margin: 0px;
                  margin-bottom: 5px;
                  color: #2ba2af;
                  font-size: 11px;
                  font-weight: 400;
                "
              >
                ${accionista.nombre}
              </p>
            </div>
            <div style="display: flex; align-items: flex-start;">
              <p
                style="
                  margin: 0px;
                  margin-bottom: 5px;
                  color: #2ba2af;
                  font-size: 11px;
                  font-weight: 400;
                "
              >
                ${accionista.tax_id}
              </p>            
            </div>     
          </div>        
        ` )
    ).join(''));
    logger.info(`${fileMethod} | ${customUuid} | Accionistas HTML: ${JSON.stringify(strHTML_paso)}`)

    strHTML_paso = strHTML_paso.replace('{_directores_}', principales_directores?.map(
      (director) => (`          
        <div
          style="
            display: grid;
            grid-template-columns: 3fr 1.5fr 1.5fr;
            padding: 2.5px 0px;
            border-bottom: 1px solid #787878;
          "
        >
          <div style="display: flex; align-items: flex-start;">
            <p
              style="
                margin: 0px;
                margin-bottom: 5px;
                color: #2ba2af;
                font-size: 11px;
                font-weight: 400;
              "
            >
              ${director.nombre}
            </p>
          </div>
          <div style="display: flex; align-items: flex-start;">
            <p
              style="
                margin: 0px;
                margin-bottom: 5px;
                color: #2ba2af;
                font-size: 11px;
                font-weight: 400;
              "
            >
              ${director.puesto}
            </p>            
          </div> 
          <div style="display: flex; align-items: flex-start;">
            <p
              style="
                margin: 0px;
                margin-bottom: 5px;
                color: #2ba2af;
                font-size: 11px;
                font-weight: 400;
              "
            >
              ${director.poder}
            </p>            
          </div>     
        </div>        
      ` )
    ).join(''));
    logger.info(`${fileMethod} | ${customUuid} | Directores HTML: ${JSON.stringify(strHTML_paso)}`)

    strHTML_paso = strHTML_paso.replace('{_personal_}', `          
      <div
        style="
          display: grid;
          grid-template-columns: 3fr 1.5fr 1.5fr;
          padding: 2.5px 0px;
          border-bottom: 1px solid #787878;
        "
      >
        <div style="display: flex; align-items: flex-start;">
          <p
            style="
              margin: 0px;
              margin-bottom: 5px;
              color: #2ba2af;
              font-size: 11px;
              font-weight: 400;
            "
          >
            ${estructura_personal.operativo}
          </p>
        </div>
        <div style="display: flex; align-items: flex-start;">
          <p
            style="
              margin: 0px;
              margin-bottom: 5px;
              color: #2ba2af;
              font-size: 11px;
              font-weight: 400;
            "
          >
            ${estructura_personal.administrativo}
          </p>            
        </div> 
        <div style="display: flex; align-items: flex-start;">
          <p
            style="
              margin: 0px;
              margin-bottom: 5px;
              color: #2ba2af;
              font-size: 11px;
              font-weight: 400;
            "
          >
            ${estructura_personal.directivo}
          </p>            
        </div>     
      </div>        
    `
    )
    logger.info(`${fileMethod} | ${customUuid} | Personal HTML: ${JSON.stringify(strHTML_paso)}`)


    strHTML_paso = strHTML_paso.replace('{_equipo_transporte_}', `          
    <div
      style="
        display: grid;
        grid-template-columns: 3fr 1.5fr 1.5fr;
        padding: 2.5px 0px;
        border-bottom: 1px solid #787878;
      "
    >
      <div style="display: flex; align-items: flex-start;">
        <p
          style="
            margin: 0px;
            margin-bottom: 5px;
            color: #2ba2af;
            font-size: 11px;
            font-weight: 400;
          "
        >
          ${equipo_transporte.carga}
        </p>
      </div>
      <div style="display: flex; align-items: flex-start;">
        <p
          style="
            margin: 0px;
            margin-bottom: 5px;
            color: #2ba2af;
            font-size: 11px;
            font-weight: 400;
          "
        >
          ${equipo_transporte.otros}
        </p>            
      </div>            
    </div>        
  `
    )
    logger.info(`${fileMethod} | ${customUuid} | Equipo de transporte HTML: ${JSON.stringify(strHTML_paso)}`)

    strHTML_paso = strHTML_paso.replace('{_seguros_}', seguros?.map(
      (seguro) => (`          
    <div
      style="
        display: grid;
        grid-template-columns: 3fr 1.5fr 1.5fr;
        padding: 2.5px 0px;
        border-bottom: 1px solid #787878;
      "
    >
      <div style="display: flex; align-items: flex-start;">
        <p
          style="
            margin: 0px;
            margin-bottom: 5px;
            color: #2ba2af;
            font-size: 11px;
            font-weight: 400;
          "
        >
          ${seguro.nombre_aseguradora}
        </p>
      </div>
      <div style="display: flex; align-items: flex-start;">
        <p
          style="
            margin: 0px;
            margin-bottom: 5px;
            color: #2ba2af;
            font-size: 11px;
            font-weight: 400;
          "
        >
          ${seguro.bien_asegurado}
        </p>            
      </div>     
    </div>        
  ` )
    ).join(''));
    logger.info(`${fileMethod} | ${customUuid} | Seguros HTML: ${JSON.stringify(strHTML_paso)}`)


    // Mercado Objetivo
    // {_mercado_objetivo_ventas_}

    strHTML_paso = strHTML_paso.replace('{_mercado_objetivo_clientes_}', mercado_objetivo_principales_clientes?.map(
      (cliente) => (`          
    <div
      style="
        display: grid;
        grid-template-columns: 2fr 1.5fr 1.5fr 1.5fr;
        padding: 2.5px 0px;
        border-bottom: 1px solid #787878;
      "
    >
      <div style="display: flex; align-items: flex-start;">
        <p
          style="
            margin: 0px;
            margin-bottom: 5px;
            color: #2ba2af;
            font-size: 11px;
            font-weight: 400;
          "
        >
          ${cliente.nombre_empresa}
        </p>
      </div>
      <div style="display: flex; align-items: flex-start;">
        <p
          style="
            margin: 0px;
            margin-bottom: 5px;
            color: #2ba2af;
            font-size: 11px;
            font-weight: 400;
          "
        >
          ${cliente.anios_relacion}
        </p>            
      </div> 
      <div style="display: flex; align-items: flex-start;">
        <p
          style="
            margin: 0px;
            margin-bottom: 5px;
            color: #2ba2af;
            font-size: 11px;
            font-weight: 400;
          "
        >
          ${cliente.pais}
        </p>            
      </div>     
      <div style="display: flex; align-items: flex-start;">
        <p
          style="
            margin: 0px;
            margin-bottom: 5px;
            color: #2ba2af;
            font-size: 11px;
            font-weight: 400;
          "
        >
          ${cliente.sector}
        </p>            
      </div> 
    </div>        
  ` )
    ).join(''))
    logger.info(`${fileMethod} | ${customUuid} | Mercado Objetivo clientes HTML: ${JSON.stringify(strHTML_paso)}`)

    strHTML_paso = strHTML_paso.replace('{_mercado_objetivo_ventas_}', `          
  <div
    style="
      display: grid;
      grid-template-columns: 3fr 1.5fr 1.5fr;
      padding: 2.5px 0px;
      border-bottom: 1px solid #787878;
    "
  >
    <div style="display: flex; align-items: flex-start;">
      <p
        style="
          margin: 0px;
          margin-bottom: 5px;
          color: #2ba2af;
          font-size: 11px;
          font-weight: 400;
        "
      >
        ${mercado_objetivo_estructura_ventas.credito_total}
      </p>
    </div>
    <div style="display: flex; align-items: flex-start;">
      <p
        style="
          margin: 0px;
          margin-bottom: 5px;
          color: #2ba2af;
          font-size: 11px;
          font-weight: 400;
        "
      >
        ${mercado_objetivo_estructura_ventas.contado_total}
      </p>            
    </div>  
    <div style="display: flex; align-items: flex-start;">
      <p
        style="
          margin: 0px;
          margin-bottom: 5px;
          color: #2ba2af;
          font-size: 11px;
          font-weight: 400;
        "
      >
        ${mercado_objetivo_estructura_ventas.ventas_gobierno}
      </p>            
    </div>            
  </div>        
`
    )
    logger.info(`${fileMethod} | ${customUuid} | Mercado Objetivo ventas HTML: ${JSON.stringify(strHTML_paso)}`)


    strHTML_paso = strHTML_paso.replace(
      '{_mercado_objetivo_importaciones_display_}',
      mercado_objetivo_importaciones?.length > 0 ? 'block' : 'none'
    );

    strHTML_paso = strHTML_paso.replace(
      '{_mercado_objetivo_importaciones_}',
      (mercado_objetivo_importaciones || [])
        .map(im => `          
          <div
            style="
              display: grid;
              grid-template-columns: 3fr 1.5fr 1.5fr;
              padding: 2.5px 0px;
              border-bottom: 1px solid #787878;
            "
          >
            <div style="display: flex; align-items: flex-start;">
              <p
                style="
                  margin: 0px;
                  margin-bottom: 5px;
                  color: #2ba2af;
                  font-size: 11px;
                  font-weight: 400;
                "
              >
                ${im.pais}
              </p>
            </div>
            <div style="display: flex; align-items: flex-start;">
              <p
                style="
                  margin: 0px;
                  margin-bottom: 5px;
                  color: #2ba2af;
                  font-size: 11px;
                  font-weight: 400;
                "
              >
                ${im.porcentaje}
              </p>            
            </div>       
          </div>        
        `)
        .join('')
    );

    logger.info(`${fileMethod} | ${customUuid} | Mercado Objetivo importaciones HTML: ${JSON.stringify(strHTML_paso)}`);


    strHTML_paso = strHTML_paso.replace('{_mercado_objetivo_exportaciones_}', mercado_objetivo_exportaciones?.map(
      (ex) => (`          
    <div
      style="
        display: grid;
        grid-template-columns: 3fr 1.5fr 1.5fr;
        padding: 2.5px 0px;
        border-bottom: 1px solid #787878;
      "
    >
      <div style="display: flex; align-items: flex-start;">
        <p
          style="
            margin: 0px;
            margin-bottom: 5px;
            color: #2ba2af;
            font-size: 11px;
            font-weight: 400;
          "
        >
          ${ex.pais}
        </p>
      </div>
      <div style="display: flex; align-items: flex-start;">
        <p
          style="
            margin: 0px;
            margin-bottom: 5px;
            color: #2ba2af;
            font-size: 11px;
            font-weight: 400;
          "
        >
          ${ex.porcentaje}
        </p>            
      </div>       
    </div>        
  ` )
    ).join(''))
    logger.info(`${fileMethod} | ${customUuid} | Mercado Objetivo exportaciones HTML: ${JSON.stringify(strHTML_paso)}`)


    //  Demandas
    // _certification?.demandas

    let mensaje = '';
    const demandas = datos_reporte?.demandas || [];

    // Ordenar por fecha descendente
    const demandasOrdenadas = demandas.sort((a, b) => {
      const fechaA = a.fecha_demanda ? new Date(a.fecha_demanda) : new Date(0);
      const fechaB = b.fecha_demanda ? new Date(b.fecha_demanda) : new Date(0);
      return fechaB.getTime() - fechaA.getTime();
    });

    // Fecha de corte: hace 12 meses
    const hoy = new Date();
    const fechaCorte = new Date(hoy);
    fechaCorte.setFullYear(hoy.getFullYear() - 1);

    // Filtrar demandas válidas dentro de los últimos 12 meses
    const demandasFiltradas = demandasOrdenadas.filter(d => {
      const rawFecha = d?.fecha_demanda;
      if (!rawFecha) return false;
      const fecha = new Date(rawFecha);
      if (isNaN(fecha.getTime())) return false;
      return fecha >= fechaCorte;
    });

    // Tomar máximo 5
    const demandasMostradas = demandasFiltradas.slice(0, 5);

    // Mensaje
    if (demandasMostradas.length > 0) {
      mensaje = `
      <p style="font-size: 13px; font-weight: 600; margin: 10px 0;">
        Presentamos ${demandasMostradas.length} demanda(s) de un total de ${demandas.length}, correspondientes a los últimos 12 meses.
      </p>
    `;
    }

    // Reemplazo en el HTML (solo si hay demandas)
    strHTML_paso = strHTML_paso.replace('{_demandas_}', demandasMostradas.map(
      (demanda, i) => (`
    ${i === 0 ? mensaje : ''}    
      <div
      style="
        background: #ffff;
        /* box-shadow: 2px 2px 10px rgba(0, 0, 0, 0.3); */
        padding: 12px 12px;
        border: 1px solid #787878;
        width: 90%;
        margin-top: 10px;
        break-inside: avoid;
        page-break-inside: avoid;
      "
    >          
      <div>

        <div
          style="
            display: grid;
            grid-template-columns: 3fr 2fr;
            
          "
        >
          

          <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
            <p
              style="
                margin: 0px;
                margin-bottom: 5px;
                font-size: 12px;
                font-weight: 500;
              "
            >
              ${(demanda.fecha_demanda?.length > 0 || demanda.fecha_demanda === 'undefined') ? demanda.fecha_demanda : '-'}
            </p>
          </div>              

        </div> 

        <div
          style="
            display: grid;
            grid-template-columns: 3fr 2fr;
          "
        >
          

          <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
            <p
              style="
                margin: 0px;
                margin-bottom: 5px;
                font-size: 12px;
                font-weight: 500;
              "
            >
            ${(demanda.demandante?.length > 0 || demanda.demandante === 'undefined') ? demanda.demandante : '-'}
            </p>
          </div>              

        </div> 

        <div
          style="
            display: grid;
            grid-template-columns: 1fr 5fr;
            border-bottom: 1px solid #787878;
          "
        >
          <div style="display: flex; align-items: flex-start; padding: 3px 0px; ">
            <p
              style="
                margin: 0px;
                margin-bottom: 5px;
                color: #0a3d8e;
                font-size: 12px;
                font-weight: 700;
                
              "
            >
            Tipo de Juicio:
            </p>
          </div>

          <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
            <p
              style="
                margin: 0px;
                margin-bottom: 5px;
                font-size: 12px;
                font-weight: 500;
              "
            >
            ${(demanda.tipo_demanda?.length > 0 || demanda.tipo_demanda === 'undefined') ? demanda.tipo_demanda : '-'}
            </p>
          </div>              

        </div> 
        
        

        <div
          style="
            display: grid;
            grid-template-columns: 1fr 5fr;
            border-bottom: 1px solid #787878;
          "
        >
          <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
            <p
              style="
                margin: 0px;
                margin-bottom: 5px;
                color: #0a3d8e;
                font-size: 12px;
                font-weight: 700;
                
              "
            >
            Entidad:
            </p>
          </div>

          <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
            <p
              style="
                margin: 0px;
                margin-bottom: 5px;
                font-size: 12px;
                font-weight: 500;
              "
            >
              ${(demanda.entidad?.length > 0 || demanda.entidad === 'undefined') ? demanda.entidad : '-'}
            </p>
          </div> 
          
          

        </div> 


        <div
          style="
            display: grid;
            grid-template-columns: 1fr 5fr;
            border-bottom: 1px solid #787878;
          "
        >
          <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
            <p
              style="
                margin: 0px;
                margin-bottom: 5px;
                color: #0a3d8e;
                font-size: 12px;
                font-weight: 700;
                
              "
            >
            Juzgado:
            </p>
          </div>

          <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
            <p
              style="
                margin: 0px;
                margin-bottom: 5px;
                font-size: 12px;
                font-weight: 500;
              "
            >
              ${(demanda.juzgado?.length > 0 || demanda.juzgado === 'undefined') ? demanda.juzgado : '-'}
            </p>
          </div>              

        </div> 


        <div
          style="
            display: grid;
            
          "
        >
          

          <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
            <p
              style="
                margin: 0px;
                margin-bottom: 5px;
                font-size: 12px;
                font-weight: 500;
              "
            >
            ${(demanda.comentarios?.length > 0 || demanda.comentarios === 'undefined') ? demanda.comentarios : '-'}
            </p>
          </div>              

        </div>     

      </div>
        </div>      
    ` )
    ).join(''))
    logger.info(`${fileMethod} | ${customUuid} | Demandas HTML: ${JSON.stringify(strHTML_paso)}`)


    // Referencis

    strHTML_paso = strHTML_paso.replace('{_referencias_}', datos_reporte?.referenciasComerciales?.map(
      (referencia) => (`  
      <div
          style="
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: flex-start;
            margin-bottom: 20px;
            margin-top: 30px;
          "
        >
          <p
            style="
              color: #0a3d8e;
              margin: 0px;
              font-size: 12px;
              font-weight: 700;
            "
          >
            ${referencia.razon_social ?? '-'}
          </p>
        </div>        
             <div>                
          <div
            style="
              background: #ffff;
              /* box-shadow: 2px 2px 10px rgba(0, 0, 0, 0.3); */
              padding: 12px 12px;
              border: 1px solid #787878;
              width: 45%;
              display: inline-block;
              vertical-align: top;
            "
          >          
            <div>
              <div
                style="
                  display: grid;
                  grid-template-columns: 3fr 2fr;
                  border-bottom: 1px solid #787878;
                "
              >
                <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
                  <p
                    style="
                      margin: 0px;
                      margin-bottom: 5px;
                      color: #0a3d8e;
                      font-size: 12px;
                      font-weight: 700;
                    "
                  >
                  Direccion Fiscal:
                  </p>
                </div>

                <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                  <p
                    style="
                      margin: 0px;
                      margin-bottom: 5px;
                      font-size: 12px;
                      font-weight: 500;
                    "
                  >
                    ${referencia.direccion_fiscal ?? '-'}
                  </p>
                </div>              

              </div> 
              
              

              <div
                style="
                  display: grid;
                  grid-template-columns: 3fr 2fr;
                  border-bottom: 1px solid #787878;
                "
              >
                <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
                  <p
                    style="
                      margin: 0px;
                      margin-bottom: 5px;
                      color: #0a3d8e;
                      font-size: 12px;
                      font-weight: 700;
                    "
                  >
                  Antguedad Relacion:
                  </p>
                </div>

                <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                  <p
                    style="
                      margin: 0px;
                      margin-bottom: 5px;
                      font-size: 12px;
                      font-weight: 500;
                    "
                  >
                  ${referencia.antiguedad_relacion ?? '-'}
                  </p>
                </div>              

              </div> 


              <div
                style="
                  display: grid;
                  grid-template-columns: 3fr 2fr;
                  border-bottom: 1px solid #787878;
                "
              >
                <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
                  <p
                    style="
                      margin: 0px;
                      margin-bottom: 5px;
                      color: #0a3d8e;
                      font-size: 12px;
                      font-weight: 700;
                    "
                  >
                  Monto de Linea de Crédito Otorgada (LC):
                  </p>
                </div>

                <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                  <p
                    style="
                      margin: 0px;
                      margin-bottom: 5px;
                      font-size: 12px;
                      font-weight: 500;
                    "
                  >
                  -
                  </p>
                </div>              

              </div> 


              <div
                style="
                  display: grid;
                  grid-template-columns: 3fr 2fr;
                  border-bottom: 1px solid #787878;
                "
              >
                <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
                  <p
                    style="
                      margin: 0px;
                      margin-bottom: 5px;
                      color: #0a3d8e;
                      font-size: 12px;
                      font-weight: 700;
                    "
                  >
                  Plazo de Crédito DSO:
                  </p>
                </div>

                <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                  <p
                    style="
                      margin: 0px;
                      margin-bottom: 5px;
                      font-size: 12px;
                      font-weight: 500;
                    "
                  >
                  ${referencia.plazo ?? '-'}
                  </p>
                </div>              

              </div> 


              <div
                style="
                  display: grid;
                  grid-template-columns: 3fr 2fr;
                  border-bottom: 1px solid #787878;
                "
              >
                <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
                  <p
                    style="
                      margin: 0px;
                      margin-bottom: 5px;
                      color: #0a3d8e;
                      font-size: 12px;
                      font-weight: 700;
                    "
                  >
                  Fecha de Otorgamiento de LC: 
                  </p>
                </div>

                <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                  <p
                    style="
                      margin: 0px;
                      margin-bottom: 5px;
                      font-size: 12px;
                      font-weight: 500;
                    "
                  >
                  ${referencia.fecha_otorgamiento_linea_credito ?? '-'}
                  </p>
                </div>              

              </div> 

            </div>
          </div>

          <!-- 2 -->
          <div
            style="
              background: #ffff;
              padding: 12px 12px;
              border: 1px solid #787878;
              width: 45%;
              display: inline-block;
              vertical-align: top;
            "
          >          
              <div>
                <div
                  style="
                    display: grid;
                    grid-template-columns: 3fr 2fr;
                    border-bottom: 1px solid #787878;
                  "
                >
                  <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
                    <p
                      style="
                        margin: 0px;
                        margin-bottom: 5px;
                        color: #0a3d8e;
                        font-size: 12px;
                        font-weight: 700;
                      "
                    >
                    Monto de Saldo Vigente de la LC :
                    </p>
                  </div>

                  <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                    <p
                      style="
                        margin: 0px;
                        margin-bottom: 5px;
                        font-size: 12px;
                        font-weight: 500;
                      "
                    >
                    ${referencia.monto_saldo_vigente_linea_credito ?? '-'}
                    </p>
                  </div>              

                </div> 
                
                

                <div
                  style="
                    display: grid;
                    grid-template-columns: 3fr 2fr;
                    border-bottom: 1px solid #787878;
                  "
                >
                  <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
                    <p
                      style="
                        margin: 0px;
                        margin-bottom: 5px;
                        color: #0a3d8e;
                        font-size: 12px;
                        font-weight: 700;
                      "
                    >
                    Monto de Saldo Vencido de la LC: 
                    </p>
                  </div>

                  <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                    <p
                      style="
                        margin: 0px;
                        margin-bottom: 5px;
                        font-size: 12px;
                        font-weight: 500;
                      "
                    >
                    ${referencia.monto_saldo_vencido_linea_credito ?? '-'}
                    </p>
                  </div>              

                </div> 


                <div
                  style="
                    display: grid;
                    grid-template-columns: 3fr 2fr;
                    border-bottom: 1px solid #787878;
                  "
                >
                  <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
                    <p
                      style="
                        margin: 0px;
                        margin-bottom: 5px;
                        color: #0a3d8e;
                        font-size: 12px;
                        font-weight: 700;
                      "
                    >
                    Dias de atraso :
                    </p>
                  </div>

                  <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                    <p
                      style="
                        margin: 0px;
                        margin-bottom: 5px;
                        font-size: 12px;
                        font-weight: 500;
                      "
                    >
                    ${referencia.dias_atraso ?? '-'}
                    </p>
                  </div>              

                </div> 


                <div
                  style="
                    display: grid;
                    grid-template-columns: 3fr 2fr;
                    border-bottom: 1px solid #787878;
                  "
                >
                  <div style="display: flex; align-items: flex-start; padding: 3px 0px;">
                    <p
                      style="
                        margin: 0px;
                        margin-bottom: 5px;
                        color: #0a3d8e;
                        font-size: 12px;
                        font-weight: 700;
                      "
                    >
                    Resultado de la experiencia de pagos
                    </p>
                  </div>

                  <div style="display: flex; align-items: flex-start;  padding: 3px 0px;">
                    <p
                      style="
                        margin: 0px;
                        margin-bottom: 5px;
                        font-size: 12px;
                        font-weight: 500;
                      "
                    >
                      -
                    </p>
                  </div>              

                </div> 


            

              </div>
          </div>
        </div>
    ` )
    ).join(''))
    logger.info(`${fileMethod} | ${customUuid} | Referencias HTML: ${JSON.stringify(strHTML_paso)}`)


    // Oultamos bloques del reprte que no debemos mostrar

    // _mercado_objetivo_importaciones_display_
    // _mercado_objetivo_exportaciones_display_
    // _referencias_display_
    // _demandas_display_

    let _demandas_display_ = 'none';
    let _referencias_display_ = 'none';
    let _mercado_objetivo_importaciones_display_ = 'none';
    let _mercado_objetivo_exportaciones_display_ = 'none';

    //if (datos_reporte?.demandas?.length > 0) _demandas_display_ = 'block';

    if (demandasMostradas.length > 0) {
      _demandas_display_ = 'block';
    }

    if (datos_reporte?.referenciasComerciales?.length > 0) _referencias_display_ = 'block';

    if (datos_reporte?.mercado_objetivo_importaciones?.length > 0) _mercado_objetivo_importaciones_display_ = 'block';

    if (datos_reporte?.mercado_objetivo_exportaciones?.length > 0) _mercado_objetivo_exportaciones_display_ = 'block';

    strHTML_paso = strHTML_paso.replace('{_demandas_display_}', _demandas_display_);
    strHTML_paso = strHTML_paso.replace('{_referencias_display_}', _referencias_display_);
    strHTML_paso = strHTML_paso.replace('{_mercado_objetivo_importaciones_display_}', _mercado_objetivo_importaciones_display_);
    strHTML_paso = strHTML_paso.replace('{_mercado_objetivo_exportaciones_display_}', _mercado_objetivo_exportaciones_display_);
    //
    strHTML_paso = strHTML_paso.replace(/{_demandas_mensaje_}/g, mensaje);

    const options = {
      format: "A4",
      printBackground: true,  // Asegura que los colores de fondo y estilos CSS avanzados se rendericen
      margin: { top: 10, right: 10, bottom: 10, left: 10 },  // Ajusta los márgenes del PDF
      preferCSSPageSize: true,  // Usa el tamaño de la página definido en el CSS (opcional)
      path: "reporte.pdf"  // Guarda el archivo en el sistema
    }
    logger.info(`${fileMethod} | ${customUuid} | opciones de configuración: ${JSON.stringify(options)}`)

    const file = { content: strHTML_paso }
    logger.info(`${fileMethod} | ${customUuid} | HTML: ${JSON.stringify(file)}`)

    let pdfBuffer = ''
    try {
      pdfBuffer = await html_to_pdf.generatePdf(file, options)
      logger.info(`${fileMethod} | ${customUuid} | PDF BUFFER: ${JSON.stringify(pdfBuffer)}`)
    } catch (error) {
      logger.info(`${fileMethod} | ${customUuid} | ERROR PDF BUFFER: ${JSON.stringify(error)}`)
    }

    try {
      await fsp.writeFile(rutaArchivo + '.pdf', pdfBuffer);
      logger.info(`${fileMethod} | ${customUuid} | Escritura del archivo: ${JSON.stringify(rutaArchivo)}`)
    } catch (error) {
      logger.info(`${fileMethod} | ${customUuid} | Error en Escritura del archivo: ${JSON.stringify(error)}`)
    }

    const archivo64 = `data:doc/pdf;base64,${pdfBuffer.toString('base64')}`
    logger.info(`${fileMethod} | ${customUuid} | Archivo base64: ${JSON.stringify(archivo64)}`)

    // TODO:  Dsecomentar pruebas
    location = await subirReporteCreditoS3(archivo64)
    logger.info(`${fileMethod} | ${customUuid} | Archivo en AWS: ${JSON.stringify(location)}`)


    return {
      error: false,
      archivo: location.file
    }

    // Con Archivo
  } catch (error) {
    const errorJSON = serializeError(error)
    errorJSON.customUuid = customUuid
    errorJSON.origenError = `Error en catch del metodo: ${fileMethod}`
    const emailError = await sendEmailNodeMailer({ info_email_error: errorJSON })
    logger.info(`${fileMethod} | ${customUuid} | Error al enviar correo electronico: ${JSON.stringify(emailError)}`)
    logger.info(`${fileMethod} | ${customUuid} | Error general y no se genero el reporte de credito: ${error}`)
    return {
      error: true,
      descripcion: error
    }
  }

}

// Servicios complementarios

const subirReporteCreditoS3 = async (archivo) => {
  try {
    const pathBucket = 'reporteCredito';
    const Location = await uploadImageS3.uploadPdf(archivo, pathBucket)
    return { error: false, file: Location }
  } catch (err) {
    return { error: true }
  }
}

const consultaCertificacion = async (customUuid, idEmpresa) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: consultaCertificacion`
  try {
    logger.info(`${fileMethod} | ${customUuid} | Inicio de consulta de la ultima certificación`)
    const certificacion = await certificationService.getCertificacionByEmpresa(idEmpresa)

    if (certificacion.result.length == 0) {
      logger.info(`${fileMethod} | ${customUuid} | No se obtuvo certificacion: ${JSON.stringify(certificacion)}`)
      return null;
    }

    logger.info(`${fileMethod} | ${customUuid} | Detalle de la consulta de certificación: ${JSON.stringify(certificacion)}`)

    const idCertification = certificacion.result[0].id_certification
    logger.info(`${fileMethod} | ${customUuid} | ID de certificación: ${JSON.stringify(idCertification)}`)

    const [ratios_financieros] = await certificationService.getRatiosFnancieros(idCertification)
    logger.info(`${fileMethod} | ${customUuid} | Ratio financierox: ${JSON.stringify(ratios_financieros)}`)

    const infoEmpresa = await certificationService.consultaEmpresaInfo(idEmpresa)
    if (infoEmpresa.result.length == 0) {
      logger.info(`${fileMethod} | ${customUuid} | No se pudo obtener la información de la empresa ${JSON.stringify(infoEmpresa)}`)
      return null
    }
    logger.info(`${fileMethod} | ${customUuid} | Información de la empresa: ${JSON.stringify(infoEmpresa)}`)

    const [direccion] = await certificationService.consultaDireccionFiscal(idEmpresa)
    if (!direccion) {
      logger.info(`${fileMethod} | ${customUuid} | No se pudo obtener la direcci´n fiscal de la empresa ${JSON.stringify(direccion)}`)
      return null
    }
    logger.info(`${fileMethod} | ${customUuid} | Dirección de la empresa: ${JSON.stringify(direccion)}`)

    const accionistas = await certificationService.getAccionistas(idCertification)
    logger.info(`${fileMethod} | ${customUuid} | Accionistas: ${JSON.stringify(accionistas)}`)

    const principales_directores = await certificationService.getDirectores(idCertification)
    logger.info(`${fileMethod} | ${customUuid} | Principales directores: ${JSON.stringify(principales_directores)}`)

    const estructura_personal = await certificationService.getEstructuraPersonal(idCertification)
    logger.info(`${fileMethod} | ${customUuid} | Estructura de personal: ${JSON.stringify(estructura_personal)}`)

    const equipo_transporte = await certificationService.getEquipoTransporte(idCertification)
    logger.info(`${fileMethod} | ${customUuid} | Equipo de transporte: ${JSON.stringify(equipo_transporte)}`)

    const seguros = await certificationService.getSeguros(idCertification)
    logger.info(`${fileMethod} | ${customUuid} | Seguros: ${JSON.stringify(seguros)}`)

    const empresas_relacionadass = await certificationService.getEmpresasRelacionadasByCertification(idCertification);
    logger.info(`${fileMethod} | ${customUuid} | Empresas Relacionadasss: ${JSON.stringify(empresas_relacionadass)}`);

    certificacion.result[0].rfc = infoEmpresa.result[0].emp_rfc
    certificacion.result[0].razon_social = infoEmpresa.result[0].emp_razon_social
    certificacion.result[0].denominacion = infoEmpresa.result[0].denominacion
    certificacion.result[0].web_site = infoEmpresa.result[0].emp_website
    certificacion.result[0].direccion_fiscal = direccion
    certificacion.result[0].accionistas = accionistas.result
    certificacion.result[0].principales_directores = principales_directores
    certificacion.result[0].estructura_personal = estructura_personal
    certificacion.result[0].equipo_transporte = equipo_transporte
    certificacion.result[0].seguros = seguros
    certificacion.result[0].empresas_relacionadass = empresas_relacionadass

    const demandas = await certificationService.getDemandas(idCertification)
    logger.info(`${fileMethod} | ${customUuid} | Demandas: ${JSON.stringify(demandas)}`)
    // 
    const partidasFinancieras = await certificationService.getCertificacionPartidaFinanciera(idCertification)
    let data = partidasFinancieras.result
    logger.info(`${fileMethod} | ${customUuid} | Partidax: ${JSON.stringify(data)}`);

    const groupByTipoPeriodo = (data) => {
      const balanceMap = new Map()
      const resultadosMap = new Map()


      data.forEach(obj => {
        const tipoBalance = obj.tipo_periodo_estado_balance
        const tipoResultados = obj.tipo_periodo_estado_resultados

        if (!balanceMap.has(tipoBalance)) {
          balanceMap.set(tipoBalance, {
            id_certification: obj.id_certification,
            id_tipo_cifra: obj.id_tipo_cifra,
            compartir_balance: obj.compartir_estado_balance,
            compartir_info_empresa: obj.compartir_info_empresa,
            tipo_periodo_estado_balance: tipoBalance,
            caja_bancos: parseFloat(obj.caja_bancos),
            saldo_cliente_cuenta_x_cobrar: parseFloat(obj.saldo_cliente_cuenta_x_cobrar),
            saldo_inventarios: parseFloat(obj.saldo_inventarios),
            deuda_corto_plazo: parseFloat(obj.deuda_corto_plazo),
            deuda_total: parseFloat(obj.deuda_total),
            capital_contable: parseFloat(obj.capital_contable),
            deudores_diversos: parseFloat(obj.deudores_diversos),
            otros_activos: parseFloat(obj.otros_activos),
            otros_activos_fijos_largo_plazo: parseFloat(obj.otros_activos_fijos_largo_plazo),
            total_activo_circulante: parseFloat(obj.total_activo_circulante),
            total_activo_fijo: parseFloat(obj.total_activo_fijo),
            activo_intangible: parseFloat(obj.activo_intangible),
            activo_diferido: parseFloat(obj.activo_diferido),
            total_otros_activos: parseFloat(obj.total_otros_activos),
            activo_total: parseFloat(obj.activo_total),
            proveedores: parseFloat(obj.proveedores),
            acreedores: parseFloat(obj.acreedores),
            inpuestos_x_pagar: parseFloat(obj.inpuestos_x_pagar),
            otros_pasivos: parseFloat(obj.otros_pasivos),
            total_pasivo_largo_plazo: parseFloat(obj.total_pasivo_largo_plazo),
            pasivo_diferido: parseFloat(obj.pasivo_diferido),
            capital_social: parseFloat(obj.capital_social),
            resultado_ejercicios_anteriores: parseFloat(obj.resultado_ejercicios_anteriores),
            resultado_ejercicios: parseFloat(obj.resultado_ejercicios),
            otro_capital: parseFloat(obj.otro_capital),
            periodo_actual: obj.perioro_actual_estado_balance,
            periodo_anterior: obj.perioro_anterior_estado_balance,
            periodo_previo_anterior: obj.perioro_previo_anterior_estado_balance
          })
        }

        if (!resultadosMap.has(tipoResultados)) {
          resultadosMap.set(tipoResultados, {
            id_certification: obj.id_certification,
            id_tipo_cifra: obj.id_tipo_cifra,
            compartir_resultado: obj.compartir_estado_resultados,
            compartir_info_empresa: obj.compartir_info_empresa,
            tipo_periodo_estado_resultados: tipoResultados,
            ventas_anuales: parseFloat(obj.ventas_anuales),
            costo_ventas_anuales: parseFloat(obj.costo_ventas_anuales),
            utilidad_operativa: parseFloat(obj.utilidad_operativa),
            utilidad_bruta: parseFloat(obj.utilidad_bruta),
            gastos_administracion: parseFloat(obj.gastos_administracion),
            gastos_productos_financieros: parseFloat(obj.gastos_productos_financieros),
            depreciacion_amortizacion: parseFloat(obj.depreciacion_amortizacion),
            otros_ingresos: parseFloat(obj.otros_ingresos),
            otros_egresos: parseFloat(obj.otros_egresos),
            otros_gastos: parseFloat(obj.otros_gastos),
            utilidad_neta: parseFloat(obj.utilidad_neta),
            periodo_actual: obj.perioro_actual_estado_resultados,
            periodo_anterior: obj.perioro_anterior_estado_resultados,
            periodo_previo_anterior: obj.perioro_previo_anterior_estado_resultados
          })
        }
      })

      const balanceArray = Array.from(balanceMap.values())
      const resultadosArray = Array.from(resultadosMap.values())

      const sortedBalance = balanceArray.sort((a, b) => {
        if (a.tipo_periodo_estado_balance === "anterior" && b.tipo_periodo_estado_balance === "previo_anterior") {
          return -1
        }
        if (a.tipo_periodo_estado_balance === "previo_anterior" && b.tipo_periodo_estado_balance === "anterior") {
          return 1
        }
        return 0
      })

      const sortedData = resultadosArray.sort((a, b) => {
        if (a.tipo_periodo_estado_resultados === "anterior" && b.tipo_periodo_estado_resultados === "previo_anterior") {
          return -1
        }
        if (a.tipo_periodo_estado_resultados === "previo_anterior" && b.tipo_periodo_estado_resultados === "anterior") {
          return 1
        }
        return 0
      })

      return {
        certification_partidas_estado_balance: sortedBalance,
        certification_partidas_estado_resultados_contables: sortedData
      }
    }


    const finalObject = groupByTipoPeriodo(data)
    logger.info(`${fileMethod} | ${customUuid} | Partidas Financieras formateadas: ${JSON.stringify(finalObject)}`)

    const referenciasComerciales = await certificationService.getCertificacionReferenciasComerciales(idCertification)
    logger.info(`${fileMethod} | ${customUuid} | Referencias Comerciales: ${JSON.stringify(referenciasComerciales)}`)

    for (let i in referenciasComerciales.result) {
      const getContactos = await certificationService.getContactos(referenciasComerciales.result[i].id_certification_referencia_comercial)
      referenciasComerciales.result[i].contactos = getContactos.result
    }

    const reporte_credito = await certificationService.getReporteCredito(idCertification)
    logger.info(`${fileMethod} | ${customUuid} | Reporte de credito: ${JSON.stringify(reporte_credito)}`)

    const principales_clientes = await certificationService.getPrincipalesClientes(idCertification)
    logger.info(`${fileMethod} | ${customUuid} | Principales clientes: ${JSON.stringify(principales_clientes)}`)

    const estructuras_ventas = await certificationService.getEstructuraVentas(idCertification)
    logger.info(`${fileMethod} | ${customUuid} | Estructura ventas: ${JSON.stringify(estructuras_ventas)}`)

    const importaciones = await certificationService.getImportaciones(idCertification)
    logger.info(`${fileMethod} | ${customUuid} | Importaciones: ${JSON.stringify(importaciones)}`)

    const exportaciones = await certificationService.getExportaciones(idCertification)
    logger.info(`${fileMethod} | ${customUuid} | Exportaciones: ${JSON.stringify(exportaciones)}`)

    const [calculos_estado_balance] = await certificationService.getCalculoEstadoBalance(idCertification)
    logger.info(`${fileMethod} | ${customUuid} | Calculo del estado de balance: ${JSON.stringify(calculos_estado_balance)}`)

    const [calculos_estado_resultados] = await certificationService.getCalculoEstadoResultado(idCertification)
    logger.info(`${fileMethod} | ${customUuid} | Calculo del estado de resultados: ${JSON.stringify(calculos_estado_resultados)}`)

    const [ratio_financiero] = await certificationService.getRatiosFnancieros(idCertification)
    logger.info(`${fileMethod} | ${customUuid} | Ratio financiero: ${JSON.stringify(ratio_financiero)}`)

    const respuesta = {
      certificacion: certificacion?.result,
      demandas: demandas?.result,
      partidasFinancieras: finalObject ?? [],
      mercadoObjetivo: {
        principales_clientes: principales_clientes ?? [],
        estructuras_ventas: estructuras_ventas ?? [],
        importaciones: importaciones ?? [],
        exportaciones: exportaciones ?? []
      },
      referenciasComerciales: referenciasComerciales?.result,
      reporteCredito: reporte_credito?.result[0] ?? [],
      calculoEstadoBalance: calculos_estado_balance ?? [],
      calculoEstadoResultado: calculos_estado_resultados ?? [],
      calculoRatiosFinancieros: ratio_financiero ?? []
    }

    logger.info(`${fileMethod} | ${customUuid} | Respuesta: ${JSON.stringify(respuesta)}`)

    return respuesta

  } catch (err) {
    //next(err)
    logger.info(`${fileMethod} | ${customUuid} | Error general: ${JSON.stringify(err)}`)
    return null
  }

}

// TODO: PAsar a un utils hablar con Minoru lo usamos en varios Controllera
const getHash = async (variable) => {
  try {
    var charSet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    var charSetSize = charSet.length;
    var strId = "";

    for (var i = 1; i <= 20; i++) {
      var randPos = Math.floor(Math.random() * charSetSize);
      strId += charSet[randPos];
    }

    return strId;
  } catch (ex) {
    return "";
  }
}

// Enviamos invitaciones Referencias Externas
const enviarReferenciasComercialesExternos = async (id_empresa, certificacion_id, contactos, empresa_var, empresa_envia_var) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: enviarReferenciasComercialesExternos`
  try {

    if (contactos.length == 0 || !id_empresa || !certificacion_id) return null
    const _empreaa = await companiesService.getEmpresa(id_empresa)
    const nombre_empresa = _empreaa?.[0]?.emp_razon_social ?? 'Credi'

    let success = true
    for (const contacto of contactos) {
      const hash = await getHash(id_empresa + '_' + certificacion_id);
      const nuevo = await certificationService.insertExternalReference(hash, id_empresa, certificacion_id, contacto.correo, contacto.nombre, contacto.id_contacto, contacto.id_referencia, contacto.id_direccion, contacto.id_empresa_cliente_contacto)
      const link = `${process.env.URL_CALLBACK_STRIPE}/#/referencias-comerciales?hash=${hash}`
      logger.info(`${fileMethod} | Request para envio de correo: ${JSON.stringify({ link, contacto: { ...contacto, empresa_var, empresa_envia_var } })}`)
      if (process.env.NODE_ENV == 'production') {
        const envio = await enviaCorreoReferenciasExternas(link, { ...contacto, empresa_var, empresa_envia_var })
        if (!envio.success) {
          logger.error(`${fileMethod} | Error al enviar correo a ${contacto.correo}: ${envio.error}`)
          success = false
        } else {
          logger.info(`${fileMethod} | Correo enviado a ${contacto.correo} con estatus ${envio.status}`)
        }
      } else {
        const MAILJET_EMAIL_DEFAULT = process.env.MAILJET_EMAIL_DEFAULT || '';
        const MAILJET_EMAIL_DEFAULT_ARRAY = MAILJET_EMAIL_DEFAULT
          ? MAILJET_EMAIL_DEFAULT.split(',')
          : [];
        if (MAILJET_EMAIL_DEFAULT_ARRAY.length > 1) {
          for (const _email of MAILJET_EMAIL_DEFAULT_ARRAY) {
            const envio = await enviaCorreoReferenciasExternas(link, { ...contacto, correo: _email });
            if (!envio.success) {
              logger.error(`${fileMethod} | Error al enviar correo a ${_email}: ${envio.error}`)
              success = false
            } else {
              logger.info(`${fileMethod} | Correo enviado a ${_email} con estatus ${envio.status}`)
            }
          }
        }

        if (MAILJET_EMAIL_DEFAULT != '' && MAILJET_EMAIL_DEFAULT_ARRAY.length == 0) {
          const envio = await enviaCorreoReferenciasExternas(link, { ...contacto, correo: process.env.MAILJET_EMAIL_DEFAULT })
          if (!envio.success) {
            logger.error(`${fileMethod} | Error al enviar correo a ${process.env.MAILJET_EMAIL_DEFAULT}: ${envio.error}`)
            success = false
          } else {
            logger.info(`${fileMethod} | Correo enviado a ${process.env.MAILJET_EMAIL_DEFAULT} con estatus ${envio.status}`)
          }
        }
      }

    }

    return success;

  } catch (error) {
    logger.error(`${fileMethod} | Error general: ${error.message}`)
    return false
  }

}

const enviaCorreoReferenciasExternas = async (link, contacto) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: enviaCorreoReferenciasExternas`
  try {
    const {
      id_contacto,
      nombre,
      correo
    } = contacto

    const request_email = {
      Messages: [
        {
          From: {
            Email: 'mkt@credibusiness.site',
            Name: 'credibusiness'
          },
          To: [
            {
              Email: correo,
              Name: nombre
            }
          ],
          TemplateID: 6279989,
          TemplateLanguage: true,
          Variables: {
            link: link,
            empresa: contacto.empresa_var,
            empresa_envia: contacto.empresa_envia_var == null ? '' : contacto.empresa_envia_var
          }
        }
      ]
    }

    logger.info(`${fileMethod} | Request para mailjet: ${JSON.stringify(request_email)}`)

    const envio_email = await mailjet
      .post('send', { version: 'v3.1' })
      .request(request_email)

    const result_mailjet = envio_email.body
    logger.info(`${fileMethod} | Respuesta de envio de correo a referencia comercial: ${JSON.stringify(result_mailjet)}`)

    const message_href = result_mailjet.Messages[0].To[0].MessageHref
    const message_id = result_mailjet.Messages[0].To[0].MessageID
    const response_status_mailjet = await axios.get(message_href, {
      auth: {
        username: key,
        password: secretKey
      }
    })

    const result_estatus_envio = response_status_mailjet.data
    logger.info(`${fileMethod} | Respuesta del estatus del correo: ${JSON.stringify(result_estatus_envio)}`)

    const consulta_estatus_envio = result_estatus_envio.Data[0].Status

    if (consulta_estatus_envio === 'sent') {
      logger.info(`${fileMethod} | Correo enviado con exito, estatus ${consulta_estatus_envio}`)
    } else {
      logger.error(`${fileMethod} | El correo no se envio. Estatus: ${consulta_estatus_envio}`)
    }

    const now = new Date()

    const pad = n => String(n).padStart(2, '0')

    const year = now.getFullYear()
    const month = pad(now.getMonth() + 1)
    const day = pad(now.getDate())
    const hours = pad(now.getHours())
    const minutes = pad(now.getMinutes())
    const seconds = pad(now.getSeconds())

    const fecha = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`

    await certificationService.actualizaEstatusContacto(id_contacto, message_id, consulta_estatus_envio, fecha)
    return { success: consulta_estatus_envio === 'sent', status: consulta_estatus_envio }
  } catch (error) {
    logger.error(`${fileMethod} | Error al enviar correo: ${error.message}`)
    return { success: false, error: error.message }
  }
}

const consultaHashReferenciaExternas = async (req, res, next) => {

  try {
    const { hash } = req.params

    const referencia = await certificationService.getHashExternalReference(hash)

    res.status(200).json({
      error: false,
      results: referencia.result
    })
  } catch (error) {
    next(error)
  }

}

const actualizaHashReferenciaExternas = async (req, res, next) => {

  try {
    const { hash } = req.body

    const referencia = await certificationService.updateEstatusExternalReference(hash);

    res.status(200).json({
      error: false,
      results: 'ok'
    })
  } catch (error) {
    next(error)
  }

}

const getDataReporteGlobal = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: getDataReporteGlobal`
  try {
    const { id_emp } = req.params

    const { result } = await certificationService.getDataReporteGlobal(id_emp)

    logger.info(`${fileMethod} | Respuesta exitosa que regresara el endpoint: ${JSON.stringify({
      error: false,
      reult: 'OK',
      data: result
    })}`)

    res.status(200).json({
      error: false,
      reult: 'OK',
      data: result
    })
  } catch (error) {
    next(error)
  }
}
const getDemandasBloc = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: getDemandasBloc`
  try {
    const { nombre } = req.params

    const block_demandas = await globalConfig.find(item => item.nombre === 'block_demandas').valor
    const block_demandas_url = block_demandas
      .replace('||', encodeURIComponent(nombre))
      .replace('||', encodeURIComponent(''))

    const startTs = Date.now()
    let response
    let response_encoding
    let status
    let errorMsg = null
    try {
      response = await axios.get(block_demandas_url, { responseType: 'arraybuffer' });
      const dataString = Buffer.from(response.data, 'binary').toString('latin1');
      response_encoding = JSON.parse(dataString);
      status = response.status;
    } catch (err) {
      status = err.response ? err.response.status : null
      errorMsg = err.message
      response = err.response || { data: null }

      const responseTimeErr = Date.now() - startTs
      try {
        await blocService.saveBlocResponse({
          endpoint_name: 'block_demandas',
          request_url: block_demandas_url,
          http_status: status,
          response_time_ms: responseTimeErr,
          response_json: response ? JSON.stringify(response.data) : null,
          error_message: errorMsg
        })
      } catch (e) {
        logger.error(`Error saving bloc response: ${e.message}`)
      }

      throw err
    }

    const responseTime = Date.now() - startTs
    try {
      await blocService.saveBlocResponse({
        endpoint_name: 'block_demandas',
        request_url: block_demandas_url,
        http_status: status,
        response_time_ms: responseTime,
        response_json: response ? JSON.stringify(response.data) : null,
        error_message: errorMsg
      })
    } catch (e) {
      logger.error(`Error saving bloc response: ${e.message}`)
    }

    const data = response_encoding

    logger.info(`${fileMethod} | Respuesta exitosa que regresara el endpoint: ${JSON.stringify({
      error: false,
      reult: 'OK',
      data: data
    })}`)

    res.status(200).json({
      error: false,
      reult: 'OK',
      data: data
    })
  } catch (error) {
    next(error)
  }
}

// Servicios complementarios

module.exports = {
  getDemandasBloc,
  getCertificationByCompany,
  uploadDocuments,
  postCertification,
  getCertificationContries,
  payCertification,
  certificateMyCompanyForTest,
  resetCertificationsForTest,
  iniciaCertificacion,
  getIndustria,
  getPaisAlgoritmo,
  getSectorClientesFinalesAlgoritmo,
  getTiempoActividadComercialAlgoritmo,
  getSectorRiesgoSectorialAlgoritmo,
  getTipoCifrasAlgoritmo,
  guardaPartidasFinancieras,
  guardaReferenciasComerciales,
  getAlgoritmoResult,
  generaReporteInformativoCredito,
  updateCertificacion,
  updatePartidasFinancieras,
  updateReferenciasComerciales,
  getCertification,
  uploadDocumento,
  consultaCronos,
  setStatusCertification,
  checkInfoAlgoritmo,
  getCertificationStatus,
  consultaDocumento,
  updateDocumento,
  downloadLogs,
  getInformacionContacto,
  updateInformacionContacto,
  deleteDocumento,
  solicitarCredito,
  seteaEstatusSolicitudCredito,
  guardaMercadoObjetivo,
  getPais,
  getDenominaciones,
  getPuestos,
  getPoderes,
  getBienesAsegurados,
  consultaHashReferenciaExternas,
  actualizaHashReferenciaExternas,
  consultaMailjet,
  saveLog,
  getReferenciaComercialForm,
  getInfoContactoReferido,
  getDataReporteGlobal,
  validacionBloc,
  consultaBlocEmpresaControlante,
  consultaBloc,
  getMontoPlazo
  /* validarCertificacionBloc */
}
