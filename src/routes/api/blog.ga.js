'use strict'

const express = require('express')
const schemaValidator = require('../../utils/middlewares/validationHandler')
const router = express.Router()
const blogSchema = require('../../utils/schemas/blog')
const blogCtrl = require('../../controllers/api/blog')
const { notAllowGenericToken } = require('../../utils/middlewares/globalAuth')
const validateImages = require('../../utils/middlewares/validFiles')
const authMiddleware = require('../../utils/middlewares/authMiddleware');

router.post('/articles', authMiddleware, [notAllowGenericToken(), validateImages(false)], blogCtrl.createArticle)
router.get('/articles/all', authMiddleware, blogCtrl.getAllArticles)
router.get('/articles/ids', authMiddleware, blogCtrl.getAllArticlesIds)
router.get('/articles/search', authMiddleware, blogCtrl.searchArticles)
router.get('/articles/:artId', authMiddleware, blogCtrl.getArticleById)
router.put('/articles/:artId', authMiddleware, [notAllowGenericToken(), validateImages(false, ['images'])], blogCtrl.modifyArticle)

router.get('/comments/:artId', authMiddleware, blogCtrl.getCommentsAndSubcommentsTreeByArtId)
router.post('/comments', authMiddleware, [notAllowGenericToken(), schemaValidator(blogSchema.createComment)], blogCtrl.createComment)
// router.post('/comments/subcomments', [notAllowGenericToken(), schemaValidator(blogSchema.createSubcomment)], blogCtrl.createSubcomment)

router.post('/stats', schemaValidator(blogSchema.regStats), blogCtrl.regStats)
module.exports = router
