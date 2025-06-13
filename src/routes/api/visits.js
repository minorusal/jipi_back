'use strict'
const express = require('express')
const { createVisit } = require('../../utils/schemas/visits')
const validation = require('../../utils/middlewares/validationHandler')
const visitsController = require('../../controllers/api/visits')
const authMiddleware = require('../../utils/middlewares/authMiddleware')
const router = express.Router()

router.get('/', authMiddleware, visitsController.getVisits)
router.post('/', authMiddleware, validation(createVisit), visitsController.createVisit)

module.exports = router
