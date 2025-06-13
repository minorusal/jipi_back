'use strict'
const CatEnvioModel = require('../../models/legacy/cat_envio')

module.exports = {
  getEnvios: getEnvios
}

function getEnvios (idioma_id) {
  return new Promise(function (resolve, reject) {
    CatEnvioModel.getEnvios(idioma_id)
      .then(function (result) {
        resolve({ valido: 1, cat_envio: result.result })
      })
  })
}
