'use strict'
const express = require('express')
const router = express.Router()

const friendsController = require('../../controllers/api/friends')
const authMiddleware = require('../../utils/middlewares/authMiddleware')

router.get('/', authMiddleware, friendsController.getFriends)
router.post('/refuse', authMiddleware, friendsController.refuseFriendship)
router.get('/check/:myId/:userId', authMiddleware, friendsController.checkFriendship)

module.exports = router
