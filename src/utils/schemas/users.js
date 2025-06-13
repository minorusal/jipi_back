const Joi = require('joi')

const updateUserSchema = Joi.object({
  usu_nombre: Joi.string().min(2).max(70),
  usu_app: Joi.string().min(2).max(70),
  usu_puesto: Joi.string().min(2).max(70),
  usu_psw: Joi.string().min(1).max(30),
  new_pass: Joi.string().min(1).max(30),
  new_pass_confirm: Joi.string().min(1).max(30),
  usu_foto: Joi.string().max(255),
  usu_boletin: Joi.number().valid(0, 1),
  usu_email: Joi.string().email()
})

const requestChangePassword = Joi.object({
  email: Joi.string().email().required()
})

const changePassword = Joi.object({
  password: Joi.string().required()
})

const requestCodeResend = Joi.object({
  user: Joi.number().min(1),
  email: Joi.string().email()
})

module.exports = {
  updateUserSchema,
  requestChangePassword,
  changePassword,
  requestCodeResend
}
