'use strict'
const express = require('express')
// quotes new
const quotesController = require('../../controllers/api/quotes')
const { validateGetQuotes, validateGetCheckQuotes } = require('../../utils/middlewares/validationQuotes')
const authMiddleware = require('../../utils/middlewares/authMiddleware')

const router = express.Router()

router.get('/', authMiddleware, (_req, res) => res.json({ ok: true, message: 'This are the quotes' }))
router.get('/user/:user', authMiddleware, validateGetQuotes, quotesController.getQuotesWithFilters)
router.get('/user/:user/check', authMiddleware, validateGetCheckQuotes, quotesController.nonComplianceQuotes)

module.exports = router
