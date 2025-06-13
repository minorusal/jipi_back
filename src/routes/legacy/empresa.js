'use strict'

const express = require('express')
const router = express.Router()
const EmpresaCtrl = require('../../controllers/legacy/empresa')
const validFiles = require('../../utils/middlewares/validFiles')
const multerForLegacy = require('../../utils/multerForLegacy')

router.get('/empresas', getEmpresas)
router.get('/empresa/:empresa_id', getEmpresaByID)
router.post('/empresa-add', AddEmpresa)
router.post('/empresa-update', UpdateEmpresa)
router.post('/empresa-img', EmpresaCtrl.subirBannerDeEmpresa)
router.post('/empresa-logo/:emp_id', multerForLegacy('image'), subirLogoDeEmpresa)
router.get('/empresas-imagen/:emp_id/idioma/:idioma_id', GetImagenesEmpresa)
router.post('/delete-imagen-baner', DeleteImgCaruselEmpresaPerfil)
router.get('/empresa-consultar/:emp_id', GetEmpresaConsultarByID)
router.get('/empresa-publicaciones/:emp_id/:usu_id', getPublicacionesByEmpresa)
router.get('/empresa-contadores/:emp_id', getEmpresaContadores)
router.get('/empresa-getvideo/:emp_id', getEmpresaVideobyID)
router.post('/empresa-deletevideo', DeleteVideo)

async function subirLogoDeEmpresa (req, res) {
  const result = await EmpresaCtrl.subirLogoDeEmpresa(req)
  res.json(result)
}

function getEmpresas (req, res) {
  EmpresaCtrl.getEmpresas()
    .then(function (result) {
      res.json(result)
    })
}

function getEmpresaByID (req, res) {
  const empresa_id = req.params.empresa_id
  EmpresaCtrl.GetEmpresaConsultarByID({ emp_id: empresa_id })
    .then(function (result) {
      res.json(result)
    })
}

function AddEmpresa (req, res) {
  const empresa = req.body
  EmpresaCtrl.AddEmpresa(empresa)
    .then(function (result) {
      res.json(result)
    })
}

function UpdateEmpresa (req, res) {
  const empresa = req.body

  EmpresaCtrl.UpdateEmpresa(empresa)
    .then(function (result) {
      res.json(result)
    })
}

function GetImagenesEmpresa (req, res) {
  const emp_id = req.params.emp_id
  const idioma_id = req.params.idioma_id
  EmpresaCtrl.GetImagenesEmpresa({ emp_id: emp_id, idioma_id: idioma_id })
    .then(function (result) {
      res.json(result)
    })
}

function GetEmpresaConsultarByID (req, res) {
  const emp_id = req.params.emp_id
  EmpresaCtrl.GetEmpresaConsultarByID({ emp_id: emp_id })
    .then(function (result) {
      res.json(result)
    })
}

function DeleteImgCaruselEmpresaPerfil (req, res) {
  const ef_id = req.body
  EmpresaCtrl.DeleteImgCaruselEmpresaPerfil(ef_id)
    .then(function (result) {
      res.json(result)
    })
}

function getPublicacionesByEmpresa (req, res) {
  const emp_id = req.params.emp_id
  const usu_id = req.params.usu_id
  EmpresaCtrl.getPublicacionesByEmpresa(emp_id, usu_id)
    .then(function (result) {
      res.json(result)
    })
}

function getEmpresaContadores (req, res) {
  const emp_id = req.params.emp_id
  EmpresaCtrl.getEmpresaContadores({ emp_id: emp_id })
    .then(function (result) {
      res.json(result)
    })
}

function getEmpresaVideobyID (req, res) {
  const emp_id = req.params.emp_id
  EmpresaCtrl.getEmpresaVideobyID({ emp_id: emp_id })
    .then(function (result) {
      res.json(result)
    })
}

function DeleteVideo (req, res) {
  const datos_video = req.body
  EmpresaCtrl.DeleteVideo(datos_video)
    .then(function (result) {
      res.json(result)
    })
}

module.exports = router
