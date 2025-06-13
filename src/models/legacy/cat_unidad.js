'use strict'
const mysqlLib = require('../../lib/db')

async function getCatUnidad (d) {
  if (d.idioma == 1) {
    return await mysqlLib.mysqlQuery('GET',
      'SELECT cuni_id, cuni_desc_esp as cuni_desc FROM cat_unidad WHERE cuni_status = 1 ORDER BY 2')
  } else {
    return await mysqlLib.mysqlQuery('GET',
      'SELECT cuni_id, cuni_desc_ing as cuni_desc FROM cat_unidad WHERE cuni_status = 1 ORDER BY 2')
  }
}

async function getUnidades (d) {
  if (d.idioma_id == 1) {
    return await mysqlLib.mysqlQuery('GET',
      'SELECT cuni_id, cuni_desc_esp as cuni_desc FROM cat_unidad WHERE cuni_status = 1 ORDER BY 2')
  } else {
    return await mysqlLib.mysqlQuery('GET',
      'SELECT cuni_id, cuni_desc_ing as cuni_desc FROM cat_unidad WHERE cuni_status = 1 ORDER BY 2')
  }
}
module.exports = {
  getCatUnidad,
  getUnidades
}
