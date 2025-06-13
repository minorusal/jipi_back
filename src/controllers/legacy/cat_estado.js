'use strict'

const CatEstadoModel = require('../../models/legacy/cat_estado')

module.exports = {
  GetCatEstado: GetCatEstado
}

function GetCatEstado (idioma_id) {
  return new Promise(function (resolve, reject) {
    CatEstadoModel.getEstadoCatalogo(idioma_id)
      .then(function (result) {
        resolve(!result.err ? { estado: { valido: 1, cat_estado: result.result } } : reject({ valido: 0, error: 'No se pudo Obtener estados' }))
      })
  })
}
