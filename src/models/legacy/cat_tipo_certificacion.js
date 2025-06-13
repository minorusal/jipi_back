'use strict'
const mysqlLib = require('../../lib/db')

async function getCatTipoCertificacion (d) {
  if (d.idioma == 1) {
    return await mysqlLib.mysqlQuery('GET',
        `SELECT ctc.ctcer_id, ctc.ctcer_desc_esp as ctcer_desc, ctc.ctcer_tit_esp as ctcer_tit, ctc.ctcer_precio, cm.cmon_desc_esp as cmon_desc
        FROM cat_tipo_certificacion ctc, cat_moneda cm WHERE ctc.ctcer_status = 1  and ctc.cmon_id = cm.cmon_id and ctc.cter_tipo = @tipo`, d)
  } else {
    return await mysqlLib.mysqlQuery('GET',
        `SELECT ctc.ctcer_id, ctc.ctcer_desc_ing as ctcer_desc, ctc.ctcer_tit_ing as ctcer_tit, ctc.ctcer_precio, cm.cmon_desc_ing as cmon_desc
        FROM cat_tipo_certificacion ctc, cat_moneda cm WHERE ctc.ctcer_status = 1  and ctc.cmon_id = cm.cmon_id and ctc.cter_tipo = @tipo`, d)
  }
}
module.exports = {
  getCatTipoCertificacion
}
