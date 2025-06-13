'use strict'
const express = require('express')
const validation = require('../../utils/middlewares/validationHandler')
const { createToken, deleteToken } = require('../../utils/schemas/tokens')
const tokensController = require('../../controllers/api/tokens')
const authMiddleware = require('../../utils/middlewares/authMiddleware')
const router = express.Router()

router.post('/', authMiddleware, validation(createToken), tokensController.createToken)
router.get('/user/:user', tokensController.getUserTokens)
router.delete('/token/:token/:type',  validation(deleteToken, 'params'), tokensController.deleteToken)
router.get('/companies', authMiddleware, tokensController.createCompaniesTokens)

module.exports = router
