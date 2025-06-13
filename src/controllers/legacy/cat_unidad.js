'use strict'

const CatUnidadModel = require('../../models/legacy/cat_unidad')

module.exports = {
  getUnidades: getUnidades
}

function getUnidades (idioma_id) {
  return new Promise(function (resolve, reject) {
    CatUnidadModel.getUnidades(idioma_id)
      .then(function (result) {
        resolve({ cat_unidad: result.result, valido: 1 })
      })
  })
}
