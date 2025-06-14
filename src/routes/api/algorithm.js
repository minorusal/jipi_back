'use strict'

const express = require('express')
const router = express.Router()

const algorithmController = require('../../controllers/api/algorithm')

router.post('/result', algorithmController.getAlgorithmResult)

/**
 * @swagger
 * /api/algorithm/summary:
 *   get:
 *     summary: Obtiene un resumen de los valores usados en el algoritmo
 *     responses:
 *       200:
 *         description: Resumen generado
 */
router.get('/summary', algorithmController.getAlgorithmSummary)

/**
 * @swagger
 * /api/algorithm/summary/pdf:
 *   get:
 *     summary: Genera un reporte PDF con los valores del algoritmo
 *     responses:
 *       200:
 *         description: PDF generado en base64
 */
router.get('/summary/pdf', algorithmController.getAlgorithmSummaryPdf)
module.exports = router
