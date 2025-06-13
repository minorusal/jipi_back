const Joi = require('joi')

const commentProduct = Joi.object({
  usuario: Joi.number().required(),
  comentario: Joi.string().required(),
  calificacion: Joi.number().min(0).max(10).required()
})

const deleteCommentProduct = Joi.object({
  usuario: Joi.number().required()
})

const createProductCategory = Joi.object({
  categoria: Joi.number().min(1).required(),
  producto: Joi.number().min(1).required()
})

const createProductReview = Joi.object({
  token: Joi.string().required(),
  review: Joi.object({
    title: Joi.string().required(),
    comment: Joi.string(),
    quality: Joi.number().min(0).max(10).required(),
    price: Joi.number().min(0).max(10).required(),
    delivery: Joi.number().min(0).max(10).required()
  })
})

module.exports = {
  commentProduct,
  deleteCommentProduct,
  createProductCategory,
  createProductReview
}
