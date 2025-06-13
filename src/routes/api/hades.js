'use strict'
const express = require('express')
const router = express.Router()
const hadesController = require('../../controllers/api/hades')
const hadesAuthentication = require('../../utils/middlewares/hadesAuthentication')
const validation = require('../../utils/middlewares/validationHandler')
const authMiddleware = require('../../utils/middlewares/authMiddleware')
const { companyCertification, creditReport } = require('../../utils/schemas/hades')

router.get('/', authMiddleware, (_req, res) => res.json('Hades'))
router.post('/company-certification', authMiddleware, hadesAuthentication, validation(companyCertification), hadesController.companyCertification)
router.post('/company-certification-test', authMiddleware, hadesAuthentication, validation(companyCertification), hadesController.companyCertificationTest)
router.post('/credit-report', authMiddleware, hadesAuthentication, validation(creditReport), hadesController.creditReport)
router.post('/credit-report-test', authMiddleware, hadesAuthentication, validation(creditReport), hadesController.creditReportTest)

module.exports = router
