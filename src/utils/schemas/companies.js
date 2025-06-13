'use strict'
const Joi = require('joi')

exports.createOrRemoveFavorite = Joi.object({
  user: Joi.number().min(1).required(),
  company: Joi.number().min(1).required()
})

exports.createCompany = Joi.object({
  empresa: Joi.object({
    nombre: Joi.string().required(),
    rfc: Joi.string().required(),
    razon_social: Joi.string().required(),
    telefono: Joi.string().required(),
    website: Joi.string().allow('').optional(),
    industria: Joi.number().allow('').optional()
  }),
  usuario: Joi.object({
    nombre: Joi.string().required(),
    apellido: Joi.string().allow('').optional(),
    email: Joi.string().email({ tlds: { allow: true } }).required(),
    password: Joi.string().required(),
    telefono: Joi.string().required()
  }),
  meta: Joi.object({
    from: Joi.string().valid('web', 'ios', 'android').required(),
    id: Joi.number().min(1).required()
  }).optional()
})
