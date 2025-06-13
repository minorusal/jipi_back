'use strict'
const debug = require('debug')('old-api:companies-router')
const express = require('express')

const { createFollow, deleteFollow } = require('../../utils/schemas/followers')
const validation = require('../../utils/middlewares/validationHandler')
const authMiddleware = require('../../utils/middlewares/authMiddleware')

const followersController = require('../../controllers/api/followers')

const router = express.Router()

router.post('/', authMiddleware, validation(createFollow), followersController.createFollow)

module.exports = router
