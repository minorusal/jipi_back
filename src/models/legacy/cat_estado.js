'use strict'
const mysqlLib = require('../../lib/db')

async function getEstadoCatalogo (d) {
  if (d.idioma == 1) {
    return await mysqlLib.mysqlQuery('GET',
      'SELECT cedo_id, cedo_nombre_esp as cpaid_nombre FROM cat_estado WHERE cedo_satatus = 1'
      , d)
  } else {
    return await mysqlLib.mysqlQuery('GET',
      'SELECT cedo_id, cedo_nombre_ing as cpaid_nombre FROM cat_estado WHERE cedo_satatus = 1'
      , d)
  }
}
module.exports = {
  getEstadoCatalogo
}
