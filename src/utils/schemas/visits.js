'use strict'
const Joi = require('joi')

const createVisit = Joi.object({
  origen: Joi.number().min(1).required(),
  destino: Joi.number().min(1).required()
})

module.exports = {
  createVisit
}
