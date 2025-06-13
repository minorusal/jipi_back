'use strict'

const AlertaModel = require('../../models/legacy/alerta')

module.exports = {
  getAlertaByUsuID: getAlertaByUsuID
}

function getAlertaByUsuID (datos) {
  return new Promise(function (resolve, reject) {
    AlertaModel.getAlertaByUsuID(datos)
      .then(function (result) {
        resolve({ valido: 1, alerta: result.result })
      })
  })
}
