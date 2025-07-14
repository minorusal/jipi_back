const Joi = require('joi')

const id = Joi.number().integer().min(1)

module.exports = id 