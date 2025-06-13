'use strict'
const Joi = require('joi')


const sendInvitationSignUp = Joi.object({
  email: Joi.string().email().required(),
  name: Joi.string().required(),
  user: Joi.number().min(1).required()
})

module.exports = {
  sendInvitationSignUp
}
