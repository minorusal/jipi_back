const express = require('express')
const router = express.Router()
const CatMonedaCtrl = require('../../controllers/legacy/cat_moneda')

router.get('/cat-monedas/:idioma_id', getCatMonedas)

function getCatMonedas (req, res) {
  const idioma_id = req.params.idioma_id
  CatMonedaCtrl.getCatMonedas({ idioma_id: idioma_id })
    .then(function (result) {
      res.json(result)
    })
}
module.exports = router
