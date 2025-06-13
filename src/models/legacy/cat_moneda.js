'use strict'

const mysqlLib = require('../../lib/db')

async function getCatMonedas (d) {
  if (d.idioma_id == 1) {
    return await mysqlLib.mysqlQuery('GET',
      'SELECT cmon_id, cmon_desc_esp as cmon_desc FROM cat_moneda WHERE cmon_status = 1 ORDER BY 2')
  } else {
    return await mysqlLib.mysqlQuery('GET',
      'SELECT cmon_id, cmon_desc_ing as cmon_desc FROM cat_moneda WHERE cmon_status = 1 ORDER BY 2')
  }
}
module.exports = {
  getCatMonedas
}
