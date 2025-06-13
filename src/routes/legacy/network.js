const express = require('express')
const router = express.Router()
const NetworkCtrl = require('../../controllers/legacy/network')

router.get('/networks', getNetworks)
router.get('/network/:usu_id', getNetwork)
router.post('/network-add', AddNetwork)
router.post('/network-delete', DeleteNetwork)
router.get('/network-buscador/:nombre', GetBuscadorNetwork)
router.get('/network-sendfriends/:usu_id', GetFiendsNetwork)
router.post('/network-adduser', GetAddUserNetwork)

function getNetworks (req, res) {
  NetworkCtrl.getNetworks()
    .then(function (result) {
      res.json(result)
    })
}

function getNetwork (req, res) {
  const usu_id = req.params.usu_id
  NetworkCtrl.getNetwork({ usu_id: usu_id })
    .then(function (result) {
      res.json(result)
    })
}

function AddNetwork (req, res) {
  const datos_network = req.body
  NetworkCtrl.AddNetwork(datos_network)
    .then(function (result) {
      res.json(result)
    })
}
function DeleteNetwork (req, res) {
  const datos_network = req.body
  NetworkCtrl.DeleteNetwork(datos_network)
    .then(function (result) {
      res.json(result)
    })
}

function GetBuscadorNetwork (req, res) {
  const nombre = req.params.nombre
  NetworkCtrl.GetBuscadorNetwork({ nombre: nombre })
    .then(function (result) {
      res.json(result)
    })
}

function GetFiendsNetwork (req, res) {
  const usu_id = req.params.usu_id
  NetworkCtrl.GetFiendsNetwork({ usu_id: usu_id })
    .then(function (result) {
      res.json(result)
    })
}

function GetAddUserNetwork (req, res) {
  const datos = req.body
  NetworkCtrl.GetAddUserNetwork(datos)
    .then(function (result) {
      res.json(result)
    })
}
module.exports = router
