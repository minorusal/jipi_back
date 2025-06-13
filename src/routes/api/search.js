const express = require('express')
const router = express.Router()

const searchController = require('../../controllers/api/search')
const authMiddleware = require('../../utils/middlewares/authMiddleware')

router.get('/', /*authMiddleware,*/ searchController.globalSearch)
router.get('/suggestions', /*authMiddleware,*/ searchController.suggestions)
router.get('/sugerenciasBusqueda', /*authMiddleware,*/ searchController.sugerenciasBusqueda)
router.get('/category', authMiddleware, searchController.category)

router.get('/taxId/:taxId', searchController.taxId)

router.get('/taxIdComplete/:taxId', searchController.taxIdComplete)

router.get('/buscador', searchController.buscador)

module.exports = router
