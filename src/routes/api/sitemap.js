const express = require('express')
const sitemapCtrl = require('../../controllers/api/sitemap')
const router = express.Router()
const authMiddleware = require('../../utils/middlewares/authMiddleware')

router.get('/', authMiddleware, sitemapCtrl.generateXML)
router.get('/sub', authMiddleware, sitemapCtrl.generateSubXML)

module.exports = router
