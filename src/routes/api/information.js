'use strict'
const express = require('express')
const { askForInformation } = require('../../utils/schemas/information')
const validation = require('../../utils/middlewares/validationHandler')
const router = express.Router()
const afiCtrl = require('../../controllers/api/information')
const authMiddleware = require('../../utils/middlewares/authMiddleware')

router.post('/', authMiddleware, validation(askForInformation), afiCtrl.askForInformation)

module.exports = router
