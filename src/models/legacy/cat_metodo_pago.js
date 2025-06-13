'use strict'
const mysqlLib = require('../../lib/db')

async function getMetodoPago (d) {
  if (d.idioma_id == 1) {
    return await mysqlLib.mysqlQuery('GET',
      'SELECT cmetodo_id, cmetodo_desc_esp as cmetodo_desc FROM cat_metodo_pago WHERE cmetodo_status = 1 ORDER BY 2')
  } else {
    return await mysqlLib.mysqlQuery('GET',
      'SELECT cmetodo_id, cmetodo_desc_ing as cmetodo_desc FROM cat_metodo_pago WHERE cmetodo_status = 1 ORDER BY 2')
  }
}
module.exports = {
  getMetodoPago
}
