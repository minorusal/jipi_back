'use strict'

const boom = require('boom')
const certificationService = require('../../services/certification')
const algorithmService = require('../../services/algorithm')
const utilitiesService = require('../../services/utilities')
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
    plazo
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
async function calcularScoresFinales (reporte) {
  const valores = Object.values(reporte.variables)
    .map(v => parseFloat(v.valor_algoritmo))
    .map(v => (Number.isNaN(v) ? 0 : v))

  const g45 = valores.reduce((a, b) => a + b, 0)
  const g46 = algorithmConstants.logitFactor * g45 + algorithmConstants.logitConstant
  const g49 = Math.exp(g46) / (1 + Math.exp(g46))
  const g48 = 1 - g49
  const g51 = g48 * 100

  const g52 = await certificationService.getClass(g51)
  const wording = await certificationService.getWordingUnderwriting(g52)
  const porcentajeLc = await certificationService.getScoreLc(g52)

  return { g45, g46, g49, g48, g51, g52, wording, porcentajeLc }
}

/**
 * Guarda el reporte y envía las notificaciones correspondientes.
 * Esta función solo registra la acción en bitácora por simplicidad.
 */
async function guardarYEnviarReporte (reporte, scores, datosCliente) {
  logger.info(`Guardar reporte para certificación ${datosCliente.id_certification}`)
  logger.info(`Scores finales: ${JSON.stringify(scores)}`)
  return { saved: true }
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

    const scores = await calcularScoresFinales(reporte)
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
