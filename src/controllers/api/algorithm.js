'use strict'

const boom = require('boom')
const path = require('path')
const ejs = require('ejs')
const fsp = require('fs').promises
const html_to_pdf = require('html-pdf-node')
const algorithmService = require('../../services/algorithm')
const logger = require('../../utils/logs/logger')

const getAlgorithmResult = async (req, res, next) => {
  const fileMethod = 'file: src/controllers/api/algorithm.js - method: getAlgorithmResultV2'
  try {
    const { id_cliente, id_reporte_credito, monto_solicitado, plazo } = req.body

    if (!id_cliente || !id_reporte_credito || !monto_solicitado || !plazo) {
      return next(boom.badRequest('Información incompleta'))
    }

    const parametrosAlgoritmo = await algorithmService.getGeneralSummary()

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
      reporteCredito,
      parametrosAlgoritmo
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

const getAlgorithmSummaryPdf = async (req, res, next) => {
  const fileMethod = 'file: src/controllers/api/algorithm.js - method: getAlgorithmSummaryPdf'
  try {
    const resumenValores = await algorithmService.getGeneralSummary()

    const templatePath = path.join(__dirname, '../../utils/pdfs/templates/algorithm-summary.ejs')
    const html = await ejs.renderFile(templatePath, { resumenValores })

    const options = {
      format: 'A4',
      printBackground: true,
      margin: { top: 10, right: 10, bottom: 10, left: 10 }
    }

    const pdfBuffer = await html_to_pdf.generatePdf({ content: html }, options)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename=algorithm-summary.pdf')
    return res.send(pdfBuffer)
  } catch (error) {
    logger.error(`${fileMethod} | ${error.message}`)
    next(error)
  }
}

const getParametrosAlgoritmoPdf = async (req, res, next) => {
  const fileMethod = 'file: src/controllers/api/algorithm.js - method: getParametrosAlgoritmoPdf'
  try {
    const parametrosAlgoritmo = await algorithmService.getGeneralSummary()
    // Remove scoreDescripcion from the report
    const { scoreDescripcion, ...cleanSummary } = parametrosAlgoritmo

    const templatePath = path.join(__dirname, '../../utils/pdfs/templates/algorithm-summary.ejs')
    const html = await ejs.renderFile(templatePath, {
      resumenValores: cleanSummary,
      fechaEmision: new Date().toLocaleDateString('es-ES')
    })

    const options = {
      format: 'A4',
      printBackground: true,
      margin: { top: 10, right: 10, bottom: 10, left: 10 }
    }

    const pdfBuffer = await html_to_pdf.generatePdf({ content: html }, options)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename=parametros-algoritmo.pdf')
    return res.send(pdfBuffer)
  } catch (error) {
    logger.error(`${fileMethod} | ${error.message}`)
    next(error)
  }
}

const updateAlgorithmRanges = async (req, res, next) => {
  const fileMethod = 'file: src/controllers/api/algorithm.js - method: updateAlgorithmRanges'
  try {
    const { body } = req
    await algorithmService.updateAlgorithmRanges(body)

    return res.json({
      error: false,
      message: 'Valores actualizados'
    })
  } catch (error) {
    logger.error(`${fileMethod} | ${error.message}`)
    next(error)
  }
}

module.exports = {
  getAlgorithmResult,
  getAlgorithmSummary,
  getAlgorithmSummaryPdf,
  getParametrosAlgoritmoPdf,
  updateAlgorithmRanges
}
