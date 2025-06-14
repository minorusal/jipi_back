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

    const pais = await algorithmService.getCountryByCertificationId(id_certification)
    if (!pais) {
      return next(boom.badRequest('No se pudo obtener información del país'))
    }

    const reporteCredito = {
      _01_pais: {
        descripcion: pais.nombre,
        score: pais.valor_algoritmo
      }
    }

    return res.json({
      error: false,
      id_certification,
      reporteCredito
    })
  } catch (error) {
    logger.error(`${fileMethod} | ${error.message}`)
    next(error)
  }
}

const getAlgorithmSummary = async (req, res, next) => {
  const fileMethod = 'file: src/controllers/api/algorithm.js - method: getAlgorithmSummary'
  try {
    const resumenValores = await algorithmService.getGeneralSummary()

    return res.json({
      error: false,
      resumenValores
    })
  } catch (error) {
    logger.error(`${fileMethod} | ${error.message}`)
    next(error)
  }
}

module.exports = {
  getAlgorithmResult,
  getAlgorithmSummary
}
