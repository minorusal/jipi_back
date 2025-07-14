'use strict'

const express = require('express')
const fs = require('fs')
const path = require('path')
const router = express.Router()
const basename = path.basename(__filename)

const checkIfValidFile = file => (file.indexOf('.') !== 0) && (file !== basename) && (file.slice(-3) === '.js')

fs
  .readdirSync(__dirname + '/api')
  .filter(checkIfValidFile)
  .forEach(file => {
    const fileName = file.split('.')[0]
    let routerName = fileName === 'auth.ga' ? 'auth' : fileName
    routerName = routerName.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`) // Convert camelCase to kebab-case
    router.use(`/api/${routerName}`, require(path.join(__dirname, '/api/', file)))
  })

module.exports = router
