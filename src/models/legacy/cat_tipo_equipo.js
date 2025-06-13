'use strict'
const mysqlLib = require('../../lib/db')

async function getTipoEquipoCatalogo (d) {
  if (d.idioma == 1) {
    return await mysqlLib.mysqlQuery('GET',
      'SELECT cteq_id, cteq_desc_esp as cteq_desc FROM cat_tipo_equipo WHERE cteq_status = 1')
  } else {
    return await mysqlLib.mysqlQuery('GET',
      'SELECT cteq_id, cteq_desc_ing as cteq_desc FROM cat_tipo_equipo WHERE cteq_status = 1')
  }
}

module.exports = {
  getTipoEquipoCatalogo
}
