'use strict'
const mysqlLib = require('../../lib/db')

async function getCatLogisticaCatalogo (d) {
  if (d.idioma == 1) {
    return await mysqlLib.mysqlQuery('GET',
      'SELECT ctl_id, ctl_desc_esp as cteq_desc FROM cat_tipo_logistica WHERE ctl_status = 1')
  } else {
    return await mysqlLib.mysqlQuery('GET',
      'SELECT ctl_id, ctl_desc_ing as cteq_desc FROM cat_tipo_logistica WHERE ctl_status = 1')
  }
}
module.exports = {
  getCatLogisticaCatalogo
}
