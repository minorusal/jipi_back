'use strict'
const Joi = require('joi')

const createCard = Joi.object({
  token: Joi.string().required()
})

module.exports = {
  createCard
}
