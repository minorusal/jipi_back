'use strict'
const express = require('express')
const validations = require('../../utils/middlewares/validationHandler')
const { commentProduct, deleteCommentProduct, createProductCategory, createProductReview } = require('../../utils/schemas/products')
const productsController = require('../../controllers/api/products')
const validFiles = require('../../utils/middlewares/validFiles')
const jsonParser = require('../../utils/middlewares/jsonParser')
const authMiddleware = require('../../utils/middlewares/authMiddleware')
const router = express.Router()

router.get('/', authMiddleware, productsController.getProducts)
router.get('/categorias', /*authMiddleware,*/ productsController.getCategories)
router.get('/:productId', authMiddleware, productsController.getProductByID)
router.get('/web/:productId', authMiddleware, productsController.getProductByIDWebVersion)
router.post('/search', authMiddleware, productsController.search)
router.post('/comentar/:productoID', authMiddleware, validations(commentProduct), productsController.createComment)
router.put('/comentar/:id', authMiddleware, validations(commentProduct), productsController.editComment)
router.delete('/comentar/:id', authMiddleware, validations(deleteCommentProduct), productsController.deleteComment)
router.put('/categorias', authMiddleware, validations(createProductCategory), productsController.createProductCategory)
router.post('/reviews', authMiddleware, validFiles(), jsonParser(createProductReview), productsController.createProductReview)

module.exports = router
