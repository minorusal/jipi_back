'use strict'

const express = require('express')
const router = express.Router()
const tradeNameController = require('../../controllers/api/tradeName')
const authMiddleware = require('../../utils/middlewares/authMiddleware')

router.get('/', /*authMiddleware,*/ tradeNameController.getTradeNames)
router.delete('/:tradeId', authMiddleware, tradeNameController.deleteTradeNames)

module.exports = router
