'use strict'
const express = require('express')
const router = express.Router()
const UsuarioCtrl = require('../../controllers/legacy/usuario')
const multerForLegacy = require('../../utils/multerForLegacy')

router.get('/usuario-login/:usu_gpid/usuario-psw/:usu_psw', LoginUsuario)
router.get('/usuarios', GetUsuarios)
router.get('/menus/:usu_id', GetMenus)
router.post('/usuario-add', UsuarioAdd)
router.post('/usuario-menu', UsuarioMenuAdd)
router.post('/usuario-update', UsuarioUpdate)
router.post('/change-pw', ChngePw)
router.post('/usuario-updatedatos', UpdateDatos)
router.post('/usuario-updatemenus', UpdateMenus)
router.post('/usuario-deletemenus', DeleteMenus)
router.get('/usuario-accesso/:usu_id', GetAccesoByID)
router.get('/codigo_registro/:codigo_user/usuario_id/:usu_id', getVerificaRegistro)
router.get('/usuario_email/:usu_email/usuario_psw/:usu_psw', getLoginUser)
router.get('/codigo_psw/:codigo_user/usuario_id/:usu_id/pw/:usu_pw', getVerificaPassword)
router.post('/usuario-updateportada/:usu_id', multerForLegacy('image'), subirImgPerfil)
router.post('/usuario-productofavorito', setProductoFavorito)
router.post('/usuario-productonofavorito', setProductoNoFavorito)
router.post('/usuario-productonofavorito', setProductoNoFavorito)
router.post('/usuario-favoritos', getFavoritos)
router.get('/usuario/:usu_id', getUsuarioByID)
router.post('/usuario-update-perfil', updateUsuarioPerfilDatos)
router.get('/usuario-empresa/:usu_id', getUsuarioEmpresa)

function subirImgPerfil (req, res) {
  UsuarioCtrl.subirImgPerfil(req)
    .then(function (result) {
      res.json(result)
    })
}

function LoginUsuario (req, res) {
  const { params } = req
  const { usu_gpid: usuGPID, usu_psw: password, usu_gpid: usuCorreo } = params
  UsuarioCtrl.LoginUsuario({ usu_gpid: usuGPID, usu_psw: password, usu_correo: usuCorreo })
    .then(function (result) {
      res.json(result)
    })
}

function GetUsuarios (req, res) {
  UsuarioCtrl.GetUsuarios()
    .then(function (result) {
      res.json(result)
    })
}

function GetMenus (req, res) {
  const usuID = req.params.usu_id
  UsuarioCtrl.GetMenus({ usu_id: usuID })
    .then(function (result) {
      res.json(result)
    })
}

function UsuarioAdd (req, res) {
  const datos = req.body
  UsuarioCtrl.UsuarioAdd(datos)
    .then(function (result) {
      res.json(result)
    })
}

function UsuarioMenuAdd (req, res) {
  const datos = req.body
  UsuarioCtrl.UsuarioMenuAdd(datos)
    .then(function (result) {
      res.json(result)
    })
}

function UsuarioUpdate (req, res) {
  const datos = req.body
  UsuarioCtrl.UsuarioUpdate(datos)
    .then(function (result) {
      res.json(result)
    })
}

function ChngePw (req, res) {
  const datos = req.body
  UsuarioCtrl.ChngePw(datos)
    .then(function (result) {
      res.json(result)
    })
}

function UpdateDatos (req, res) {
  const datos = req.body
  UsuarioCtrl.UpdateDatos(datos)
    .then(function (result) {
      res.json(result)
    })
}

function UpdateMenus (req, res) {
  const datos = req.body
  UsuarioCtrl.UpdateMenus(datos)
    .then(function (result) {
      res.json(result)
    })
}

function DeleteMenus (req, res) {
  const datos = req.body
  UsuarioCtrl.DeleteMenus(datos)
    .then(function (result) {
      res.json(result)
    })
}

function GetAccesoByID (req, res) {
  const usuID = req.params.usu_id
  UsuarioCtrl.GetAccesoByID({ usu_id: usuID })
    .then(function (result) {
      res.json(result)
    })
}

function getVerificaRegistro (req, res) {
  const { params } = req
  const { usu_id: usuID, codigo_user: code } = params
  UsuarioCtrl.getVerificaRegistro({ usu_id: usuID, codigo_user: code })
    .then(function (result) {
      res.json(result)
    })
}

function getVerificaPassword (req, res) {
  const { params } = req
  const { usu_id: usuID, codigo_user: code, usu_pw: password } = params
  UsuarioCtrl.getVerificaPassword({ usu_id: usuID, codigo_user: code, usu_pw: password })
    .then(function (result) {
      res.json(result)
    })
}

function getLoginUser (req, res) {
  const { params } = req
  const { usu_email: email, usu_psw: password } = params
  UsuarioCtrl.getLoginUser({ usu_email: email, usu_psw: password })
    .then(function (result) {
      res.json(result)
    })
}

function setProductoFavorito (req, res) {
  UsuarioCtrl.setProductoFavorito(req.body)
    .then(function (result) {
      res.json(result)
    })
}

function setProductoNoFavorito (req, res) {
  UsuarioCtrl.setProductoNoFavorito(req.body)
    .then(function (result) {
      res.json(result)
    })
}

function getFavoritos (req, res) {
  UsuarioCtrl.getFavoritos(req.body)
    .then(function (result) {
      res.json(result)
    })
}

function getUsuarioByID (req, res) {
  const usuID = req.params.usu_id
  UsuarioCtrl.getUsuarioByID({ usu_id: usuID })
    .then(function (result) {
      res.json(result)
    })
}

function updateUsuarioPerfilDatos (req, res) {
  const { body } = req
  UsuarioCtrl.updateUsuarioPerfilDatos(body)
    .then(function (result) {
      res.json(result)
    })
}

function getUsuarioEmpresa (req, res) {
  const usuID = req.params.usu_id
  UsuarioCtrl.getUsuarioEmpresa({ usu_id: usuID })
    .then(function (result) {
      res.json(result)
    })
}
module.exports = router
