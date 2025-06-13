'use strict'
const express = require('express')
const router = express.Router()

const paymentsController = require('../../controllers/api/payments')
const authMiddleware = require('../../utils/middlewares/authMiddleware')

const validate = require('../../utils/middlewares/validationHandler')
const { createCard } = require('../../utils/schemas/payments')

// router.get('/', (req, res) => res.json('Implement me!'))
router.get('/:user/intent', authMiddleware, paymentsController.getSetupIntent)
router.post('/:user', authMiddleware, paymentsController.creteCustomerID)
router.post('/:user/card', authMiddleware, validate(createCard), paymentsController.createUserCard)
router.get('/:user/card', authMiddleware, paymentsController.getPaymentsCards)
router.delete('/:user/card/:card', authMiddleware, paymentsController.deleteUserCard)
router.get('/:companyID/payments', authMiddleware, paymentsController.getPayments)

module.exports = router
