const express = require('express')
const router = express.Router()
const AlertaCtrl = require('../../controllers/legacy/alerta')

router.get('/alertas/:usu_id/:idioma_id', getAlertaByUsuID)

function getAlertaByUsuID (req, res) {
  const idioma_id = req.params.idioma_id
  const usu_id = req.params.usu_id
  AlertaCtrl.getAlertaByUsuID({ idioma_id: idioma_id, usu_id: usu_id })
    .then(function (result) {
      res.json(result)
    })
}

module.exports = router
