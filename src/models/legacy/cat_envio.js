'use strict'
const mysqlLib = require('../../lib/db')

async function getEnvios (d) {
  if (d.idioma_id == 1) {
    return await mysqlLib.mysqlQuery('GET',
      'SELECT cenvio_id, cenvio_desc_esp as cenvio_desc FROM cat_envio WHERE cenvio_status = 1 ORDER BY 2')
  } else {
    return await mysqlLib.mysqlQuery('GET',
      'SELECT cenvio_id, cenvio_desc_ing as cenvio_desc FROM cat_envio WHERE cenvio_status = 1 ORDER BY 2')
  }
}
module.exports = {
  getEnvios
}
