const Joi = require('joi')

const createNotification = Joi.object({
  origen: Joi.number().required(),
  destino: Joi.number().required(),
  tipo: Joi.number().min(1).max(11).required(),
  data: Joi.number().min(1).required()
})

const deleteNotification = Joi.object({
  origen: Joi.number().required(),
  destino: Joi.number().required(),
  tipo: Joi.number().min(1).max(10).required()
})

module.exports = {
  createNotification,
  deleteNotification
}
