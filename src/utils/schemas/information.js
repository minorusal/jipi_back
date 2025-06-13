'use strict'
const Joi = require('joi').extend(require('@joi/date'))

const askForInformation = Joi.object({
  producto: Joi.string().required(),
  email: Joi.string().email().required(),
  comentario: Joi.string().min(10),
  detalles: Joi.object({
    entrega: Joi.date().format('YYYY-MM-DD').raw().required(),
    metodo: Joi.string().valid('Efectivo', 'Credito', '50%').required(),
    presupuesto: Joi.number().min(0).required()
  })
})

module.exports = {
  askForInformation
}
