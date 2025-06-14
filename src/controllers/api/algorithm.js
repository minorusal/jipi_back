'use strict'

const boom = require('boom')
const algorithmService = require('../../services/algorithm')
const logger = require('../../utils/logs/logger')

const getAlgorithmResult = async (req, res, next) => {
  const fileMethod = 'file: src/controllers/api/algorithm.js - method: getAlgorithmResultV2'
  try {
    const { id_cliente, id_reporte_credito, monto_solicitado, plazo } = req.body

    if (!id_cliente || !id_reporte_credito || !monto_solicitado || !plazo) {
      return next(boom.badRequest('Información incompleta'))
    }

    const id_certification = await algorithmService.getLastCertificationId(id_cliente)
    if (!id_certification) {
      return next(boom.notFound('Certificación no encontrada'))
    }

    const data = await algorithmService.getInitialData(id_certification)
    if (!data) {
      return next(boom.badRequest('No se encontraron datos del algoritmo'))
    }

    const scores = {
      paisScore: data.pais_score,
      sectorRiesgoScore: data.sector_riesgo_score,
      plantillaLaboralScore: data.plantilla_score,
      sectorClienteFinalScore: data.sector_cliente_final_score,
      tiempoActividadScore: data.tiempo_actividad_score
    }

    let g45 = 0
    Object.values(scores).forEach(v => {
      const val = parseInt(v, 10)
      if (!isNaN(val)) g45 += val
    })

    const g46 = g45 * 0.0784 + 2.9834
    const g49 = parseFloat((1 / (1 + Math.exp(-g46))).toFixed(4))
    const g48 = 1 - g49
    const g51 = g48 * 100
    const g52 = g51 < 25 ? 'A' : g51 < 50 ? 'B' : 'C'

    return res.json({
      error: false,
      id_certification,
      scores,
      g45,
      g46,
      g49,
      g48,
      g51,
      g52
    })
  } catch (error) {
    logger.error(`${fileMethod} | ${error.message}`)
    next(error)
  }
}

module.exports = {
  getAlgorithmResult
}
