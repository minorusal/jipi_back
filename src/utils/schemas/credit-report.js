'use strict'
const Joi = require('joi')

const askForCertification = Joi.object({
  quote: Joi.number().min(1).required(),
  origin: Joi.number().min(1).required(),
  destiny: Joi.number().min(1).required()
})

const editCertificationSolicitude = Joi.object({
  status: Joi.string().valid('Rechazado', 'Aceptado').required(),
  company: Joi.number().min(1).required()
})

const payForCertification = Joi.object({
  quote: Joi.number().min(1).required(),
  origin: Joi.number().min(1).required(),
  destiny: Joi.number().min(1).required(),
  payment: Joi.string().required()
})

module.exports = {
  askForCertification,
  editCertificationSolicitude,
  payForCertification
}
