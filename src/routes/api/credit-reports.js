'use strict'
const express = require('express')
const router = express.Router()

const creditReportController = require('../../controllers/api/credit-report')
const authMiddleware = require('../../utils/middlewares/authMiddleware')

const validate = require('../../utils/middlewares/validationHandler')
const { askForCertification, editCertificationSolicitude, payForCertification } = require('../../utils/schemas/credit-report')

router.post('/ask', authMiddleware,  validate(askForCertification), creditReportController.askForCertification)
router.put('/report/:reportID', authMiddleware,  validate(editCertificationSolicitude), creditReportController.editCertificationSolicitude)
router.get('/report/:reportID', authMiddleware,  creditReportController.getCreditReport)
router.post('/pay', authMiddleware,  validate(payForCertification), creditReportController.payCreditReport)

router.get('/getPaymentType', creditReportController.getPaymentType)


module.exports = router
