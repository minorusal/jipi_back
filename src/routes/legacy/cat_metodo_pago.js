const express = require('express')
const router = express.Router()
const CatMetodoPago = require('../../controllers/legacy/cat_metodo_pago')

router.get('/cat_metodo_pagos/:idioma_id', getMetodoPago)

function getMetodoPago (req, res) {
  const idioma_id = req.params.idioma_id
  CatMetodoPago.getMetodoPago({ idioma_id: idioma_id })
    .then(function (result) {
      res.json(result)
    })
}
module.exports = router
