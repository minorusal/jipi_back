const express = require('express')
const router = express.Router()
const videosCtrl = require('../../controllers/api/videos')
const authMiddleware = require('../../utils/middlewares/authMiddleware')

router.post('/', authMiddleware, videosCtrl.registerConvertedVideo)

module.exports = router
