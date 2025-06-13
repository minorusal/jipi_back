'use strict'

const express = require('express')
const router = express.Router()
const ProductoCtrl = require('../../controllers/legacy/producto')
const validFiles = require('../../utils/middlewares/validFiles')

router.get('/productos', getProductos)
router.get('/producto/:prod_id', getProductoByID)
router.post('/producto-add', AddProducto)
router.post('/producto-update', UpdateProducto)
router.post('/producto-img-prod/:prod_id', ProductoCtrl.subirFotoProducto)
router.get('/producto-buscador/:texto/idioma/:idioma/:usu_id', BuscadorProducto)
router.get('/producto-productos-empresa/:emp_id/idioma/:idioma', BuscadorProductoEmpresa)
router.get('/producto-detalle/:prod_id', getProductoDetalle)
router.post('/producto-delete', DeleteProducto)
router.get('/producto-foto/:prod_id', getProductoFoto)
router.post('/producto-imagen-delete', DeleteImageProducto)

function getProductos (req, res) {
  ProductoCtrl.getProductos()
    .then(function (result) {
      res.json(result)
    })
}

function getProductoByID (req, res) {
  const prod_id = require.params.prod_id
  ProductoCtrl.getProductoByID({ prod_id: prod_id })
    .then(function (result) {
      res.json(result)
    })
}

function AddProducto (req, res) {
  const producto = req.body
  ProductoCtrl.AddProducto(producto)
    .then(function (result) {
      res.json(result)
    })
}

function UpdateProducto (req, res) {
  const producto = req.body
  ProductoCtrl.UpdateProducto(producto)
    .then(function (result) {
      res.json(result)
    })
}

function BuscadorProducto (req, res) {
  const texto = req.params.texto
  const idioma = req.params.idioma
  const usu_id = req.params.usu_id
  ProductoCtrl.BuscadorProducto({ texto: texto, idioma_id: idioma, usu_id: usu_id })
    .then(function (result) {
      res.json(result)
    })
}

function getProductoDetalle (req, res) {
  const prod_id = req.params.prod_id
  ProductoCtrl.getProductoDetalle({ prod_id: prod_id })
    .then(function (result) {
      res.json(result)
    })
}

function BuscadorProductoEmpresa (req, res) {
  const emp_id = req.params.emp_id
  const idioma = req.params.idioma
  ProductoCtrl.BuscadorProductoEmpresa({ emp_id: emp_id, idioma: idioma })
    .then(function (result) {
      res.json(result)
    })
}

function DeleteProducto (req, res) {
  const datos = req.body
  ProductoCtrl.DeleteProducto(datos)
    .then(function (result) {
      res.json(result)
    })
}

function getProductoFoto (req, res) {
  const prod_id = req.params.prod_id
  ProductoCtrl.getProductoFoto({ prod_id: prod_id })
    .then(function (result) {
      res.json(result)
    })
}
function DeleteImageProducto (req, res) {
  const datos = req.body

  ProductoCtrl.DeleteImageProducto(datos)
    .then(function (result) {
      res.json(result)
    })
}

module.exports = router
