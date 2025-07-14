'use strict'

const express = require('express')
const router = express.Router()
const seguimientoClientesController = require('../../controllers/api/seguimiento-clientes')

router.get('/', seguimientoClientesController.getAllSeguimientos)
router.post('/create-seguimiento', seguimientoClientesController.createSeguimiento)
router.put('/:id/estatus', seguimientoClientesController.updateEstatus)
router.post('/importar-masivo', seguimientoClientesController.importarSeguimientosMasivos)
router.put('/actualizar-estatus-masivo', seguimientoClientesController.actualizarEstatusMasivo)

module.exports = router
