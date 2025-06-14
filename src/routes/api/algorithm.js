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

module.exports = router
