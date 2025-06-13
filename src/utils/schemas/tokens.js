'use strict'

const Joi = require('joi')

const createToken = Joi.object({
  usuario: Joi.number().required(),
  token: Joi.string().required(),
  tipo: Joi.string().valid('Android', 'iOS').required()
})

const deleteToken = Joi.object({
  token: Joi.string().required(),
  type: Joi.string().valid('Android', 'iOS').required()
})

module.exports = {
  createToken,
  deleteToken
}
