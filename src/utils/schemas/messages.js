'use strict'

const Joi = require('joi')

const createChatRoom = Joi.object({
  user: Joi.number().min(1).required(),
  company: Joi.number().min(1).required(),
  message: Joi.string().required()
})

const createChatMessage = Joi.object({
  user: Joi.number().min(1).required(),
  uuid: Joi.string().required(),
  message: Joi.string().required(),
  product: Joi.number().min(1)
})

const changeMessageStatus = Joi.object({
  user: Joi.number().min(1).required(),
  messages: Joi.array().items(Joi.string()).required(),
  status: Joi.string().valid('Seen', 'Not Seen').required()
})

module.exports = {
  createChatRoom,
  createChatMessage,
  changeMessageStatus
}
