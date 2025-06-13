'use strict'
const CatMetodoPagoModel = require('../../models/legacy/cat_metodo_pago')

module.exports = {
  getMetodoPago: getMetodoPago
}

function getMetodoPago (idioma_id) {
  return new Promise(function (resovle, reject) {
    CatMetodoPagoModel.getMetodoPago(idioma_id)
      .then(function (result) {
        resovle({ valido: 1, cat_metodo_pago: result.result })
      })
  })
}
