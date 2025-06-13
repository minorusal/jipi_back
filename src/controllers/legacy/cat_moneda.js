'use strict'
const CatMonedaModel = require('../../models/legacy/cat_moneda')

module.exports = {
  getCatMonedas: getCatMonedas
}

function getCatMonedas (idioma_id) {
  return new Promise(function (resolve, reject) {
    CatMonedaModel.getCatMonedas(idioma_id)
      .then(function (result) {
        resolve({ valido: 1, cat_moneda: result.result })
      })
  })
}
