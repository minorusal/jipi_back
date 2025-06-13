const express = require('express')
const router = express.Router()
const CatEstadoCtrl = require('../../controllers/legacy/cat_estado')

router.get('/cat_estados/:idioma_id', GetCatEstado)

function GetCatEstado (req, res) {
  const idioma_id = req.params.idioma_id
  CatEstadoCtrl.GetCatEstado({ idioma_id: idioma_id })
    .then(function (result) {
      res.json(result)
    })
}

module.exports = router
