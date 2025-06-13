'use strict'

const express = require('express')
const statisticsController = require('../../controllers/api/statistics')
const router = express.Router()
const { validateNumbersByUser } = require('../../utils/middlewares/validationStatistics')
const validation = require('../../utils/middlewares/validationHandler')
const { createGoalForUser, updateGoalForUser } = require('../../utils/schemas/statistics')
const authMiddleware = require('../../utils/middlewares/authMiddleware')

router.get('/company/:empresa', authMiddleware, statisticsController.getStatisticsByCompany)
router.get('/user/:user', authMiddleware, statisticsController.getStatisticsByUser)
router.get('/homepage', authMiddleware, statisticsController.getStatisticsForHomepage)
router.get('/numbers/:user', authMiddleware, validateNumbersByUser, statisticsController.getNumbersByUser)
router.post('/numbers/:user', authMiddleware, validation(createGoalForUser), statisticsController.createGoalForUser)
router.put('/numbers/:user', authMiddleware, validation(updateGoalForUser), statisticsController.updateGoalForUser)

module.exports = router
