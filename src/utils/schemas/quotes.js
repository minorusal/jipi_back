const JoiBase = require('joi')
const JoiDate = require('@hapi/joi-date')
const Joi = JoiBase.extend(JoiDate)

const createQuoteSchema = Joi.object({
  usu_id_comprador: Joi.number().required(),
  cot_delivery: Joi.date().format('YYYY-MM-DD'),
  cot_comentario: Joi.string().allow(''),
  cmetodo_id: Joi.number().min(1).max(3).required(),
  credito_dias: Joi.number().min(1),
  address_id: Joi.number().required(),
  products: Joi.array().items({
    prod_id: Joi.number().required(),
    cp_cantidad: Joi.number().required(),
    comentario: Joi.string()
  }).required()
})

const createExperience = Joi.object({
  comprador_id: Joi.number().required(),
  vendedor_id: Joi.number().required(),
  tiempo: Joi.number().min(0).max(5).required(),
  calidad: Joi.number().min(0).max(5).required(),
  servicio: Joi.number().min(0).max(5).required(),
  comentario: Joi.string().allow(null).allow('')
})

const editExperience = Joi.object({
  comprador_id: Joi.number().required(),
  tiempo: Joi.number().min(0).max(5).required(),
  calidad: Joi.number().min(0).max(5).required(),
  servicio: Joi.number().min(0).max(5).required(),
  comentario: Joi.string().allow(null).allow('')
})

const createProofOfPayment = Joi.object({
  cot_id: Joi.number().min(1).required(),
  imagen: Joi.string()
})

const getQuotes = Joi.object({
  type: Joi.string().valid('open', 'closed', 'deleted', 'reported', 'can-report').required()
})

const getCheckQuotes = Joi.object({
  type: Joi.string().valid('deal', 'reported', 'can-report').required(),
  company: Joi.number().min(1).required()
})

module.exports = {
  createQuoteSchema,
  createExperience,
  editExperience,
  createProofOfPayment,
  getQuotes,
  getCheckQuotes
}
