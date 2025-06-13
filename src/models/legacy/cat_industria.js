'use strict'
const mysqlLib = require('../../lib/db')

async function getIndustriaCatalogo (d) {
  if (d.idioma == 1) {
    return await mysqlLib.mysqlQuery('GET',
      'SELECT cind_id, cind_nombre_esp as cind_nombre FROM cat_industria WHERE cind_status = 1')
  } else {
    return await mysqlLib.mysqlQuery('GET',
      'SELECT cind_id, cind_nombre_ing as cind_nombre FROM cat_industria WHERE cind_status = 1')
  }
}
module.exports = {

  getIndustriaCatalogo

}
