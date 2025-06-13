'use strict'

const express = require('express')
const fs = require('fs')
const path = require('path')
const { globalAuthMiddleware } = require('../utils/middlewares/globalAuth')

const router = express.Router()
const routesDirAPI = path.join(__dirname, '/api')
const routesDirLegacy = path.join(__dirname, '/legacy')
const routesMediaLegacy = path.join(__dirname, '../media')
const basename = path.basename(__filename)

const checkIfValidFile = file => (file.indexOf('.') !== 0) && (file !== basename) && (file.slice(-3) === '.js')

fs
  .readdirSync(routesDirAPI)
  .filter(checkIfValidFile)
  .forEach(file => {
    const [fileNameWithoutExt, globalAuthExtension] = file.split('.')
    const hasGlobalAuth = globalAuthExtension === 'ga'
    router.use(`/api/${fileNameWithoutExt}`,
      hasGlobalAuth ? [globalAuthMiddleware()] : [],
      require(path.join(routesDirAPI, `/${fileNameWithoutExt}${hasGlobalAuth ? '.ga' : ''}`)))
  })

fs
  .readdirSync(routesDirLegacy)
  .filter(checkIfValidFile)
  .forEach(file => {
    const [fileNameWithoutExt] = file.split('.')
    router.use(`/${fileNameWithoutExt}`, require(path.join(routesDirLegacy, `/${fileNameWithoutExt}`)))
  })

// publicacion de las portadas de los productos
router.use('/media/', express.static(routesMediaLegacy))

// En realidad me parece que estas rutas de media/X ya no hacen falta
// ya que antes de usar AWS las imágenes caían dentro de esas carpetas
// El único que sí se utiliza es el declarado arriba, por el archivo
// json que consulta la aplicación de iOS, como lo mencioné en el README
router.use('/media/producto/', express.static(path.join(routesMediaLegacy, '/producto')))
router.use('/media/fotoperfil/', express.static(path.join(routesMediaLegacy, '/fotoperfil')))
router.use('/media/empresa/', express.static(path.join(routesMediaLegacy, '/empresa')))
router.use('/media/evento/', express.static(path.join(routesMediaLegacy, '/evento')))
router.use('/media/publicacion/', express.static(path.join(routesMediaLegacy, '/publicacion')))
router.use('/media/logo/', express.static(path.join(routesMediaLegacy, '/logo')))
router.use('/media/certificacion/', express.static(path.join(routesMediaLegacy, '/certificacion')))
router.use('/pdf/certificacion/', express.static(path.join(__dirname, '../pdf/certificacion')))

module.exports = router
