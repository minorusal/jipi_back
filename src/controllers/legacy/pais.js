
'use strict'
const PaisModel = require('../../models/legacy/cat_paises')

module.exports = {
  getPaises: getPaises,
  getPaisByID: getPaisByID,
  AddPais: AddPais,
  UpdatePais: UpdatePais,
  getPaisesCatalogo: getPaisesCatalogo,
  getPaisesLenguaje: getPaisesLenguaje
}

function getPaises () {
  return new Promise(function (resolve, reject) {
    PaisModel.getPaises()
      .then(function (result) {
        resolve(!result.err ? { valido: 1, paises: result.result } : { valido: 0, err: 'Error en obtener Paises' })
      })
  })
}

function getPaisByID (pais_id) {
  return new Promise(function (resolve, reject) {
    PaisModel.getPaisByID(pais_id)
      .then(function (result) {
        resolve(!result.err ? { valido: 1, pais: result.result } : { valido: 0, err: 'Error en obtener Pais' })
      })
  })
}

function AddPais (pais) {
  return new Promise(function (resolve, reject) {
    PaisModel.AddPais(pais)
      .then(function (result) {
        resolve(!result.err ? { valido: 1, err: 'Se a agregado correctamente el pais' } : { valido: 0, err: 'Error en agregar Pais' })
      })
  })
}

function UpdatePais (pais) {
  return new Promise(function (resolve, reject) {
    PaisModel.UpdatePais(pais)
      .then(function (result) {
        resolve(!result.err ? { valido: 1, err: 'Se a agregado correctamente el pais' } : { valido: 0, err: 'Error en Acualizar Pais' })
      })
  })
}

function getPaisesCatalogo (idioma) {
  return new Promise(function (resolve, reject) {
    PaisModel.getPaisesCatalogo(idioma)
      .then(function (result) {
        resolve(!result.err ? { valido: 1, paises: result.result } : { valido: 0, err: 'No se pudo consultar los paises' })
      })
  })
}

function getPaisesLenguaje (idioma_id) {
  return new Promise(function (resolve, reject) {
    PaisModel.getPaisesLenguaje(idioma_id)
      .then(function (result) {
        resolve(!result.err ? { valido: 1, paises: result.result } : reject({ valido: 0, error: 'Error en Paises Lenguaje' }))
      })
  })
}
