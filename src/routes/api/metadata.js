const express = require('express')
const router = express.Router()
const metaDataCtrl = require('../../controllers/api/metadata')
const authMiddleware = require('../../utils/middlewares/authMiddleware')

router.get('/', authMiddleware, metaDataCtrl.getMetaData)

module.exports = router
