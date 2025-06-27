'use strict'

const boom = require('boom')
const certificationService = require('../../services/certification')
const algorithmService = require('../../services/algorithm')
const utilitiesService = require('../../services/utilities')
const logger = require('../../utils/logs/logger')
const { getLimits } = require('../../utils/numberUtils')

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
    ventas,
    clienteFinal,
    tiempoActividad,
    influenciaControlante,
    tipoCifras,
    incidenciasLegales,
    evolucionVentas,
    apalancamiento,
    flujoNeto,
    payback,
    rotacionCtas,
    referenciasComerciales
  ] = await Promise.all([
    getCountryScore(id_certification, algoritmo_v, parametros),
    getSectorScore(id_certification, algoritmo_v, parametros),
    getCapitalScore(id_certification, algoritmo_v, parametros),
    getPlantillaScore(id_certification, algoritmo_v, parametros),
    getVentasScore(id_certification, algoritmo_v, parametros),
    getClienteFinalScore(id_certification, algoritmo_v, parametros),
    getTiempoActividadScore(id_certification, algoritmo_v, parametros),
    getInfluenciaControlanteScore(id_certification, algoritmo_v, parametros),
    getTipoCifrasScore(id_certification, algoritmo_v, parametros),
    getIncidenciasLegalesScore(id_certification, algoritmo_v, parametros),
    getEvolucionVentasScore(id_certification, algoritmo_v, parametros),
    getApalancamientoScore(id_certification, algoritmo_v, parametros),
    getFlujoNetoScore(id_certification, algoritmo_v, parametros),
    getPaybackScore(id_certification, algoritmo_v, parametros),
    getRotacionCtasXCobrarScore(id_certification, algoritmo_v, parametros),
    getReferenciasComercialesScore(id_certification, algoritmo_v, parametros)
  ])

  return {
    pais,
    sector,
    capital,
    plantilla,
    ventas,
    clienteFinal,
    tiempoActividad,
    influenciaControlante,
    tipoCifras,
    incidenciasLegales,
    evolucionVentas,
    apalancamiento,
    flujoNeto,
    payback,
    rotacionCtas,
    referenciasComerciales
  }
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

async function getClienteFinalScore (id_certification, algoritmo_v, parametros) {
  const info = await certificationService.getScoreClienteFinal(id_certification, { v_alritmo: algoritmo_v })
  if (!info) return { error: true }
  const cfg = parametros.sectorClienteFinalScore.find(s => s.nombre === info.nombre)
  const score = cfg ? (algoritmo_v === 2 ? cfg.v2 : cfg.v1) : info.valor_algoritmo
  return { nombre: info.nombre, valor_algoritmo: score }
}

async function getTiempoActividadScore (id_certification, algoritmo_v, parametros) {
  const info = await certificationService.getScoreTiempoActividad(id_certification)
  if (!info) return { error: true }
  const cfg = parametros.tiempoActividadScore.find(t => t.nombre === info.nombre)
  const score = cfg ? (algoritmo_v === 2 ? cfg.v2 : cfg.v1) : info.valor_algoritmo
  return { nombre: info.nombre, valor_algoritmo: score }
}

async function getInfluenciaControlanteScore (id_certification, algoritmo_v, parametros) {
  const accionistas = await certificationService.getAccionistas(id_certification)
  const controlante = accionistas && accionistas.result ? accionistas.result.find(a => parseInt(a.controlante) === 1) : null
  const regla = controlante ? 'Positivo' : 'Desconocido'
  const cat = await certificationService.getInfluenciaControlanteScore(regla)
  if (!cat) return { error: true }
  return { regla, valor_algoritmo: cat.valor_algoritmo }
}

async function getTipoCifrasScore (id_certification, algoritmo_v, parametros) {
  const idTipo = await certificationService.getTipoCifra(id_certification)
  if (idTipo == null) return { error: true }
  const info = await certificationService.getScoreTipoCifra(idTipo)
  if (!info) return { error: true }
  const cfg = parametros.tipoCifrasScore.find(t => t.nombre === info.nombre)
  const score = cfg ? (algoritmo_v === 2 ? cfg.v2 : cfg.v1) : info.valor_algoritmo
  return { descripcion: info.nombre, valor_algoritmo: score }
}

async function getIncidenciasLegalesScore (id_certification, algoritmo_v, parametros) {
  const data = await certificationService.getDemandas(id_certification)
  if (!data || !data.result) return { error: true }
  let countMerc = 0
  let penal = false
  let tipo = null
  let fecha = null
  for (const inc of data.result) {
    tipo = inc.tipo_demanda
    fecha = inc.fecha_demanda
    if (tipo === 'mercantil') {
      const diff = (new Date() - new Date(fecha)) / (1000 * 60 * 60 * 24)
      if (diff <= 365) countMerc++
    } else if (tipo === 'penal') {
      penal = true
    }
  }
  let caso = 'NINGUNA'
  if (penal) caso = '>= 1 INCIDENCIA PENAL ( no importando el año)'
  else if (countMerc === 1) caso = '1 INCIDENCIA MERCANTIL <= 1 AÑO'
  else if (countMerc >= 2) caso = '2 INCIDENCIAS MERCANTILES <= 1 AÑO'
  const cat = parametros.incidenciasLegalesScore.find(i => i.nombre === caso)
  if (!cat) return { error: true }
  const score = algoritmo_v === 2 ? cat.v2 : cat.v1
  return { score, tipo: penal || countMerc ? tipo : null, fecha: penal || countMerc ? fecha : null, caso: cat.nombre }
}

async function getEvolucionVentasScore (id_certification, algoritmo_v, parametros) {
  const [anteriorRow, previoRow] = await Promise.all([
    certificationService.getVentasAnualesAnioAnterior(id_certification),
    certificationService.getVentasAnualesAnioPrevioAnterior(id_certification)
  ])
  if (!anteriorRow || !previoRow) return { error: true }
  const anterior = parseFloat(anteriorRow.ventas_anuales)
  const previo = parseFloat(previoRow.ventas_anuales)
  const evolucion = ((anterior - previo) / previo) * 100
  if (!Number.isFinite(evolucion)) {
    return {
      score: '0',
      nombre: `(${anterior} - ${previo}) / ${previo} * 100`,
      rango_numerico: 'null'
    }
  }
  const conf = parametros.evolucionVentasScore.find(e => {
    const [inf, sup] = getLimits(e)
    return evolucion >= inf && evolucion <= sup
  })
  if (!conf) return { error: true }
  const score = algoritmo_v === 2 ? conf.v2 : conf.v1
  return { nombre: conf.nombre, rango_numerico: conf.rango, valor_algoritmo: score }
}

async function getApalancamientoScore (id_certification, algoritmo_v, parametros) {
  const [pasivo, capital] = await Promise.all([
    certificationService.pasivoLargoPlazoPCA(id_certification),
    certificationService.capitalContablePCA(id_certification)
  ])
  if (!pasivo || !capital) return { error: true }
  const valor = parseFloat(pasivo.total_pasivo_largo_plazo) / parseFloat(capital.capital_contable)
  if (!Number.isFinite(valor)) return { error: true }
  const config = parametros.apalancamientoScore.find(a => {
    return valor >= parseFloat(a.limite_inferior) && valor <= parseFloat(a.limite_superior)
  })
  if (!config) return { error: true }
  const score = algoritmo_v === 2 ? config.v2 : config.v1
  return { descripcion_apalancamiento: config.nombre, valor_algoritmo: score, apalancamiento: valor }
}

async function getFlujoNetoScore (id_certification, algoritmo_v, parametros) {
  const data = await certificationService.cajaBancoPCA(id_certification)
  if (!data) return { error: true }
  const config = parametros.flujoNetoScore.find(c => {
    const [inf, sup] = getLimits(c)
    return data.caja_bancos >= inf && data.caja_bancos <= sup
  })
  if (!config) return { error: true }
  const score = algoritmo_v === 2 ? config.v2 : config.v1
  return { descripcion: config.nombre, valor_algoritmo: score }
}

async function getPaybackScore (id_certification, algoritmo_v, parametros) {
  const [pasivoData, utilidad] = await Promise.all([
    certificationService.totalPasivoCirculanteAnterior(id_certification),
    certificationService.utilidadOperativa(id_certification)
  ])
  if (!pasivoData || !utilidad) return { error: true }
  const deuda = parseFloat(pasivoData.total_pasivo_circulante)
  const util = parseFloat(utilidad.utilidad_operativa)
  if (util === 0) return { score: 'N/A' }
  const payback = deuda / util
  const info = await certificationService.getScorePayback(payback)
  if (!info) return { error: true }
  return { descripcion: info.nombre, valor_algoritmo: info.valor_algoritmo, payback }
}

async function getRotacionCtasXCobrarScore (id_certification, algoritmo_v, parametros) {
  const [saldoCli, ventas, inventarios, costoVentas] = await Promise.all([
    certificationService.saldoClienteCuentaXCobrar(id_certification),
    certificationService.ventasAnuales(id_certification),
    certificationService.saldoInventarios(id_certification),
    certificationService.costoVentasAnuales(id_certification)
  ])
  if (!saldoCli || !ventas || !inventarios || !costoVentas) return { error: true }
  const dso = ventas.ventas_anuales ? (parseFloat(saldoCli.saldo_cliente_cuenta_x_cobrar) / parseFloat(ventas.ventas_anuales)) * 360 : 0
  const dio = costoVentas.costo_ventas_anuales ? (parseFloat(inventarios.saldo_inventarios) / parseFloat(costoVentas.costo_ventas_anuales)) * 360 : 0
  const info = await certificationService.getScoreRotacion(Math.round(dso), Math.round(dio))
  if (!info) return { error: true }
  return { descripcion: info.nombre, valor_algoritmo: info.valor_algoritmo }
}

async function getReferenciasComercialesScore (id_certification, algoritmo_v, parametros) {
  const refs = await certificationService.getReferenciasComercialesByIdCertificationScore(id_certification)
  if (!refs) return { error: true }
  if (refs.length === 0) {
    const sin = await certificationService.getResultadoReferenciaById(6, { v_alritmo: algoritmo_v })
    if (!sin) return { error: true }
    return { descripcion: sin.nombre, valor_algoritmo: sin.valor_algoritmo }
  }
  let buenas = 0
  let malas = 0
  let regulares = 0
  let porcentaje_deuda = 0
  let dias_atraso = 0
  for (const r of refs) {
    const [cal] = await certificationService.getCalificacionsReferencias(r.id_certification_referencia_comercial)
    if (!cal) return { error: true }
    const c = String(cal.calificacion_referencia || '').toLowerCase()
    if (c === 'mala') {
      malas++
      porcentaje_deuda = Math.max(porcentaje_deuda, cal.porcentaje_deuda || 0)
      dias_atraso = Math.max(dias_atraso, cal.dias_atraso || 0)
    } else if (c === 'buena') buenas++
    else if (c === 'regular') regulares++
  }
  let catalogoId = 6
  if (buenas === 0 && malas > 0 && regulares === 0 && porcentaje_deuda >= algorithmConstants.ref_malas_porcentaje && dias_atraso >= algorithmConstants.ref_malas_dias) {
    catalogoId = 4
  } else if (buenas >= 2 && buenas <= 3 && malas === 0 && regulares === 0) {
    catalogoId = 2
  } else if (buenas >= 4 && malas === 0 && regulares === 0) {
    catalogoId = 1
  } else if (regulares > 0) {
    catalogoId = 5
  } else if (buenas === 1 && malas === 0 && regulares === 0) {
    catalogoId = 3
  }
  const cat = await certificationService.getResultadoReferenciaById(catalogoId, { v_alritmo: algoritmo_v })
  if (!cat) return { error: true }
  return { descripcion: cat.nombre, valor_algoritmo: cat.valor_algoritmo }
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
