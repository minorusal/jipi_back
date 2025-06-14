'use strict'

const express = require('express')
const router = express.Router()

const algorithmController = require('../../controllers/api/algorithm')

router.post('/result', algorithmController.getAlgorithmResult)

module.exports = router
