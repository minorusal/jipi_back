'use strict'
const mysqlLib = require('../../lib/db')

async function getAlertaByUsuID (d) {
  if (d.idioma_id == 1) {
    return await mysqlLib.mysqlQuery('GET',
        `SELECT alerta_id, a.usu_id, alerta_desc_esp as alerta_desc, alerta_status, alerta_update,
            coalesce(CONCAT(u.usu_nombre, ' ', u.usu_app), '') as nombre_origen,
            coalesce(u.usu_foto,'') as usu_foto,
            TIMESTAMPDIFF(HOUR, alerta_update, now()) as horas_faltante
        FROM alerta a LEFT OUTER JOIN usuario u ON a.usu_id_origen = u.usu_id
        WHERE a.usu_id = @usu_id and a.alerta_status in (1,2)
        ORDER BY a.alerta_update DESC`, d)
  } else {
    return await mysqlLib.mysqlQuery('GET',
        `SELECT alerta_id, a.usu_id, alerta_desc_esp as alerta_desc, alerta_status, alerta_update,
            coalesce(CONCAT(u.usu_nombre, ' ', u.usu_app), '') as nombre_origen,
            coalesce(u.usu_foto,'') as usu_foto,
            TIMESTAMPDIFF(HOUR, alerta_update, now()) as horas_faltante
        FROM alerta a LEFT OUTER JOIN usuario u ON a.usu_id_origen = u.usu_id
        WHERE a.usu_id = @usu_id and a.alerta_status in (1,2)
        ORDER BY a.alerta_update DESC`, d)
  }
}

async function setAlertasVisto (d) {
  return await mysqlLib.mysqlQuery('SET',
        `update alerta
        set alerta_status = 2
        where usu_id = @usu_id `
        , d)
}
module.exports = {
  getAlertaByUsuID,
  setAlertasVisto
}
