const express = require('express')
const router = express.Router()
const CatUnidad = require('../../controllers/legacy/cat_unidad')

router.get('/cat_unidades/:idioma_id', getUnidades)

function getUnidades (req, res) {
  const idioma_id = req.params.idioma_id
  CatUnidad.getUnidades({ idioma_id: idioma_id })
    .then(function (result) {
      res.json(result)
    })
}
module.exports = router
