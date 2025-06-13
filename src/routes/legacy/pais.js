const express = require('express')
const router = express.Router()
const PaisCtrl = require('../../controllers/legacy/pais')

router.get('/paises', getPaises)
router.get('/pais/:pais_id', getPaisByID)
router.post('/pais-add', AddPais)
router.post('/pais-update', UpdatePais)
router.get('/paises_catalogo/:idioma', getPaisesCatalogo)
router.get('/paises-lenguaje/:idioma_id', getPaisesLenguaje)
function getPaises (req, res) {
  PaisCtrl.getPaises()
    .then(function (result) {
      res.json(result)
    })
}

function getPaisByID (req, res) {
  const pais_id = require.params.pais_id
  PaisCtrl.getPaisByID({ pais_id: pais_id })
    .then(function (result) {
      res.json(result)
    })
}

function AddPais (req, res) {
  const pais = req.body
  PaisCtrl.AddPais(pais)
    .then(function (result) {
      res.json(result)
    })
}

function UpdatePais (req, res) {
  const pais = req.body
  PaisCtrl.UpdatePais(pais)
    .then(function (result) {
      res.json(result)
    })
}

function getPaisesCatalogo (req, res) {
  const idioma = req.params.idioma

  PaisCtrl.getPaisesCatalogo({ idioma: idioma })
    .then(function (result) {
      res.json(result)
    })
}

function getPaisesLenguaje (req, res) {
  const idioma_id = req.params.idioma_id
  PaisCtrl.getPaisesLenguaje({ idioma_id: idioma_id })
    .then(function (result) {
      res.json(result)
    })
}
module.exports = router
