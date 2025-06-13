const express = require('express')
const router = express.Router()
const CatEnvioCtrl = require('../../controllers/legacy/cat_envio')

router.get('/cat_envios/:idioma_id', getEnvios)

function getEnvios (req, res) {
  const idioma_id = req.params.idioma_id
  CatEnvioCtrl.getEnvios({ idioma_id: idioma_id })
    .then(function (result) {
      res.json(result)
    })
}

module.exports = router
