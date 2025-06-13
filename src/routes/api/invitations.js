'use strict'
const express = require('express')
const router = express.Router()

const validator = require('../../utils/middlewares/validationHandler')
const { sendInvitationSignUp } = require('../../utils/schemas/invitations')

const invitationsController = require('../../controllers/api/invitations')
const authMiddleware = require('../../utils/middlewares/authMiddleware')

router.post('/', authMiddleware, invitationsController.sendInvitationAdmin)
router.post('/signup', authMiddleware, validator(sendInvitationSignUp), invitationsController.sendInvitationSignUp)

module.exports = router
