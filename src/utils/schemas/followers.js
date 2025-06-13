const Joi = require('joi')

const createFollow = Joi.object({
  origen: Joi.number().required(),
  destino: Joi.number().required()
})

module.exports = {
  createFollow
}
