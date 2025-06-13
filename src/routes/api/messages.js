'use strict'

const express = require('express')
const { createChatRoom, createChatMessage, changeMessageStatus } = require('../../utils/schemas/messages')
const validation = require('../../utils/middlewares/validationHandler')

const messagesController = require('../../controllers/api/messages')
const authMiddleware = require('../../utils/middlewares/authMiddleware')

const router = express.Router()

router.get('/', authMiddleware, messagesController.getMessages)
router.get('/company', authMiddleware, messagesController.getChatRoomByCompany)
router.get('/:roomUUID', authMiddleware, messagesController.getRoomDetails)
router.delete('/:roomUUID/:messageUUID/:userID', authMiddleware, messagesController.deleteMessage)
router.put('/:roomUUID/messages', authMiddleware, validation(changeMessageStatus), messagesController.changeSeenStatus)
router.post('/', authMiddleware, validation(createChatRoom), messagesController.createChatRoom)
router.post('/message', validation(createChatMessage), messagesController.createMessage)

module.exports = router
