'use strict'

const boom = require('boom')
const path = require('path')
const ejs = require('ejs')
const html_to_pdf = require('html-pdf-node')
const certificationService = require('../../services/certification')
const algorithmService = require('../../services/algorithm')
const utilitiesService = require('../../services/utilities')
const uploadImageS3 = require('../../utils/uploadImageS3')
const { sendCompaniEmail } = require('./mailjet-controler')
const logger = require('../../utils/logs/logger')

// Valores por defecto de configuración del algoritmo
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

/**
 * Carga los parámetros de configuración del algoritmo.
 * Se consultan desde la tabla `parametros`.
 */
async function loadAlgorithmConstants () {
  try {
    const params = await utilitiesService.getParametros()
    const getValue = name => {
      const p = params.find(it => it.nombre === name)
      return p ? parseFloat(p.valor) : null
    }

    algorithmConstants = {
      monto_mayor1500: getValue('monto_mayor1500') ?? algorithmConstants.monto_mayor1500,
      monto_menor500: getValue('monto_menor500') ?? algorithmConstants.monto_menor500,
      dpo_mayor1500: {
        sin: getValue('dpo_mayor1500_sin') ?? algorithmConstants.dpo_mayor1500.sin,
        conUno: getValue('dpo_mayor1500_con_uno') ?? algorithmConstants.dpo_mayor1500.conUno,
        conDos: getValue('dpo_mayor1500_con_dos') ?? algorithmConstants.dpo_mayor1500.conDos
      },
      dpo_menor500: {
        sin: getValue('dpo_menor500') ?? algorithmConstants.dpo_menor500.sin
      },
      dpo_entre500y1500: {
        sin: getValue('dpo_entre500y1500_sin') ?? algorithmConstants.dpo_entre500y1500.sin,
        conUno: getValue('dpo_entre500y1500_con_uno') ?? algorithmConstants.dpo_entre500y1500.conUno,
        conDos: getValue('dpo_entre500y1500_con_dos') ?? algorithmConstants.dpo_entre500y1500.conDos
      },
      logitFactor: getValue('algoritmo_logit_factor') ?? algorithmConstants.logitFactor,
      logitConstant: getValue('algoritmo_logit_constant') ?? algorithmConstants.logitConstant,
      ref_malas_porcentaje: getValue('referencia_malas_porcentaje') ?? algorithmConstants.ref_malas_porcentaje,
      ref_malas_dias: getValue('referencia_malas_dias') ?? algorithmConstants.ref_malas_dias
    }
  } catch (err) {
    logger.error(`loadAlgorithmConstants | ${err.message}`)
  }
}

loadAlgorithmConstants()

/**
 * Obtiene la información inicial necesaria para ejecutar el algoritmo.
 * Valida los parámetros recibidos y determina la certificación a utilizar.
 */
async function obtenerDatosIniciales (req) {
  const { id_cliente, id_reporte_credito, monto_solicitado, plazo } = req.body
  if (!id_cliente || !id_reporte_credito || !monto_solicitado || !plazo) {
    throw boom.badRequest('Información incompleta')
  }

  const id_certification = await certificationService.getLastIdCertification(id_cliente)
  if (!id_certification) {
    throw boom.badRequest(`No se encontró certificación para el cliente ${id_cliente}`)
  }

  const parametrosAlgoritmo = await algorithmService.getGeneralSummary()
  const algoritmo_v = await determinarVersionAlgoritmo(id_certification)
  const customUuid = new Date().toISOString().replace(/\D/g, '')

  return {
    id_certification,
    customUuid,
    parametrosAlgoritmo,
    algoritmo_v,
    monto_solicitado,
    plazo,
    id_cliente,
    id_reporte_credito
  }
}

/**
 * Determina la versión del algoritmo que se debe ejecutar.
 */
async function determinarVersionAlgoritmo (id_certification) {
  const partidas = await certificationService.obtenerPartidasFinancieras(id_certification)
  const bandera = partidas && partidas[0] ? partidas[0].bandera : 'true'
  return bandera === 'false' ? 2 : 1
}

/**
 * Calcula las variables principales del algoritmo.
 */
async function calcularVariablesAlgoritmo (id_certification, algoritmo_v, parametros, uuid) {
  const [
    pais,
    sector,
    capital,
    plantilla,
    ventas
  ] = await Promise.all([
    getCountryScore(id_certification, algoritmo_v, parametros),
    getSectorScore(id_certification, algoritmo_v, parametros),
    getCapitalScore(id_certification, algoritmo_v, parametros),
    getPlantillaScore(id_certification, algoritmo_v, parametros),
    getVentasScore(id_certification, algoritmo_v, parametros)
  ])

  return { pais, sector, capital, plantilla, ventas }
}

async function getCountryScore (id_certification, algoritmo_v, parametros) {
  const pais = await certificationService.getPaisAlgoritmoByIdCertification(id_certification)
  if (!pais) return { error: true }
  const config = parametros.paisScore.find(p => p.nombre === pais.nombre)
  if (!config) return { error: true }
  const score = algoritmo_v === 2 ? config.v2 : config.v1
  return { nombre: pais.nombre, valor_algoritmo: score }
}

async function getSectorScore (id_certification, algoritmo_v, parametros) {
  const sector = await certificationService.getSectorRiesgoByIdCertification(id_certification, { v_alritmo: algoritmo_v })
  if (!sector) return { error: true }
  const config = parametros.sectorRiesgoScore.find(s => s.nombre === sector.nombre)
  if (!config) return { error: true }
  const score = algoritmo_v === 2 ? config.v2 : config.v1
  return { nombre: sector.nombre, valor_algoritmo: score }
}

async function getCapitalScore (id_certification, algoritmo_v, parametros) {
  const capital = await certificationService.capitalContableEBPA(id_certification)
  if (!capital || capital.capital_contable == null) return { error: true }
  const value = Number(capital.capital_contable)
  const config = parametros.capitalContableScore.find(c => {
    const sup = c.limite_superior == null ? 9999999999 : c.limite_superior
    return value >= c.limite_inferior && value <= sup
  })
  if (!config) return { error: true }
  const score = algoritmo_v === 2 ? config.v2 : config.v1
  return { nombre: config.nombre, valor_algoritmo: score }
}

async function getPlantillaScore (id_certification, algoritmo_v, parametros) {
  const plantilla = await certificationService.getPlantillaCertification(id_certification)
  if (!plantilla) return { error: true }
  const plantillaInfo = await certificationService.getScorePlantillaLaboral(plantilla.plantilla_laboral, { v_alritmo: algoritmo_v })
  if (!plantillaInfo) return { error: true }
  return { nombre: plantillaInfo.nombre, valor_algoritmo: plantillaInfo.valor_algoritmo }
}

async function getVentasScore (id_certification, algoritmo_v, parametros) {
  const ventas = await certificationService.ventasAnuales(id_certification)
  if (!ventas) return { error: true }
  const config = await certificationService.getScoreVentasAnualesAnioAnterior(ventas.ventas_anuales)
  if (!config) return { error: true }
  return { nombre: config.nombre, valor_algoritmo: config.valor_algoritmo }
}

/**
 * Construye el objeto de reporte de crédito a partir de las variables calculadas.
 */
function construirReporteCredito (variables, algoritmo_v, monto, plazo) {
  return {
    version: algoritmo_v,
    montoSolicitado: monto,
    plazo,
    variables
  }
}

/**
 * Calcula los scores finales y la clase del reporte.
 */
function calcularScoresFinales (reporte) {
  const valores = Object.values(reporte.variables)
    .map(v => parseFloat(v.valor_algoritmo))
    .map(v => (Number.isNaN(v) ? 0 : v))
  const promedio = valores.length
    ? valores.reduce((a, b) => a + b, 0) / valores.length
    : 0
  const g45 = promedio
  const g46 = algorithmConstants.logitFactor * g45 + algorithmConstants.logitConstant
  const g49 = Math.exp(g46) / (1 + Math.exp(g46))
  const g51 = g49 * 100
  const g52 = g51 >= 80 ? 1 : g51 >= 60 ? 2 : 3
  return { g45, g46, g49, g51, g52 }
}

async function generarPdfReporte (reporte, scores, uuid) {
  const templatePath = path.join(
    __dirname,
    '../../utils/pdfs/templates/credit-evaluation.ejs'
  )
  const html = await ejs.renderFile(templatePath, { reporte, scores })
  const options = {
    format: 'A4',
    printBackground: true,
    margin: { top: 10, right: 10, bottom: 10, left: 10 }
  }
  const pdfBuffer = await html_to_pdf.generatePdf({ content: html }, options)
  const pdf64 = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`
  const location = await uploadImageS3.uploadPdf(pdf64, 'reporteCredito')
  logger.info(`generarPdfReporte | ${uuid} | location: ${JSON.stringify(location)}`)
  return location
}

/**
 * Guarda el reporte y envía las notificaciones correspondientes.
 * Esta función solo registra la acción en bitácora por simplicidad.
 */
async function guardarYEnviarReporte (reporte, scores, datosCliente) {
  const {
    id_certification,
    customUuid,
    id_cliente,
    id_reporte_credito,
    monto_solicitado,
    plazo
  } = datosCliente

  logger.info(`Guardar reporte para certificación ${id_certification}`)
  const reporteCredito = {
    id_reporte_credito,
    monto_solicitado,
    plazo
  }

  const map = {
    pais: '_01_pais',
    sector: '_02_sector_riesgo',
    capital: '_03_capital_contable',
    plantilla: '_04_plantilla_laboral',
    ventas: '_08_ventas_anuales'
  }

  for (const [k, v] of Object.entries(reporte.variables)) {
    const key = map[k]
    if (key) {
      reporteCredito[key] = { descripcion: v.nombre, score: v.valor_algoritmo }
    }
  }

  const pdfLocation = await generarPdfReporte(reporte, scores, customUuid)
  reporteCredito.reporte_pdf = pdfLocation.file
  reporteCredito.score = scores.g45

  await certificationService.insertReporteCredito(id_certification, reporteCredito, customUuid)

  if (pdfLocation?.file) {
    const [solicitud] = await certificationService.getSolicitudCreditoById(id_reporte_credito)
    if (solicitud) {
      const empresa_info = await certificationService.getUsuarioEmail(solicitud.id_proveedor)
      if (empresa_info && empresa_info[0]) {
        const [{ usu_nombre: nombre, usu_email: email }] = empresa_info
        const cliente = await certificationService.consultaEmpresaInfo(id_cliente)
        const _cliente = cliente?.result?.[0]?.emp_razon_social || 'No encontrado'
        const proveedor = await certificationService.consultaEmpresaInfo(solicitud.id_proveedor)
        const _proveedor = proveedor?.result?.[0]?.emp_razon_social || 'No encontrado'
        await sendCompaniEmail({
          email,
          nombre,
          templateID: 6967845,
          empresa: _cliente,
          empresa_envia: _proveedor
        })
      }
    }
  }

  return { saved: true, pdf: pdfLocation.file }
}

/**
 * Orquesta la ejecución completa del nuevo algoritmo.
 */
async function getAlgoritmoResultV2 (req, res, next) {
  const fileMethod = 'controllers/api/creditEvaluation.js - getAlgoritmoResultV2'
  try {
    const datos = await obtenerDatosIniciales(req)
    const variables = await calcularVariablesAlgoritmo(
      datos.id_certification,
      datos.algoritmo_v,
      datos.parametrosAlgoritmo,
      datos.customUuid
    )

    const reporte = construirReporteCredito(
      variables,
      datos.algoritmo_v,
      datos.monto_solicitado,
      datos.plazo
    )

    const scores = calcularScoresFinales(reporte)
    await guardarYEnviarReporte(reporte, scores, datos)

    return res.json({
      error: false,
      reporte,
      scores
    })
  } catch (err) {
    logger.error(`${fileMethod} | ${err.message}`)
    return next(err)
  }
}

module.exports = {
  getAlgoritmoResultV2
}
