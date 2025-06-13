'use strict'

const IndustriaModel = require('../../models/legacy/cat_industria')

module.exports = {
  getIndustrias: getIndustrias,
  getIndustriaByID: getIndustriaByID,
  AddIndustria: AddIndustria,
  UpdateIndustria: UpdateIndustria
}

function getIndustrias (idioma) {
  return new Promise(function (resolve, reject) {
    IndustriaModel.getIndustriaCatalogo(idioma)
      .then(function (result) {
        resolve(!result.err ? { valido: 1, industrias: result.result } : { valido: 0, err: 'No se logro consultar las Industrias' })
      })
  })
}

function getIndustriaByID (industria_id) {
  return new Promise(function (resolve, reject) {
    IndustriaModel.getIndustriaByID(industria_id)
      .then(function (result) {
        resolve(!result.err ? { valido: 1, industrias: result.result } : { valido: 0, err: 'No se logro consultar las Industrias' })
      })
  })
}
function AddIndustria (industria) {
  return new Promise(function (resolve, reject) {
    IndustriaModel.AddIndustria(industria)
      .then(function (result) {
        resolve(!result.err ? { valido: 1, err: 'Se agrego correctamente la industria' } : { valido: 0, err: 'No se logro agregar las Industrias' })
      })
  })
}
function UpdateIndustria (industria) {
  return new Promise(function (resolve, reject) {
    IndustriaModel.UpdateIndustria(industria)
      .then(function (result) {
        resolve(!result.err ? { valido: 1, err: 'Se agrego correctamente la industria' } : { valido: 0, err: 'No se logro agregar las Industrias' })
      })
  })
}
