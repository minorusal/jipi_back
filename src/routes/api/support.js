'use strict'
const express = require('express')
const router = express.Router()

const supportController = require('../../controllers/api/support')
const multerSupport = require('../../utils/multerSupport')
const { createSuggestion, createProblem } = require('../../utils/schemas/support')
const authMiddleware = require('../../utils/middlewares/authMiddleware')

router.get('/', authMiddleware, (req, res) => res.json('Support!'))
router.post('/suggestions', authMiddleware, supportController.createSuggestions)
router.post('/problems', authMiddleware, supportController.createProblems)

module.exports = router
