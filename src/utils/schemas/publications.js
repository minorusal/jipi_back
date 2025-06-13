const Joi = require('joi')

exports.createPublication = Joi.object({
  usuario_id: Joi.number().required(),
  imagen: Joi.string(),
  video: Joi.string(),
  comentario: Joi.string(),
  origen: Joi.string().valid('Corporativo')
})

exports.updatePublication = Joi.object({
  comentario: Joi.string().required()
})

exports.createComment = Joi.object({
  usuario_id: Joi.number().required(),
  comentario: Joi.string().required(),
  imagen: Joi.string()
})

exports.updateComment = Joi.object({
  comentario_id: Joi.number().required(),
  comentario: Joi.string().required()
})

exports.deleteComment = Joi.object({
  comentario_id: Joi.number().required()
})

exports.likeComment = Joi.object({
  comentario_id: Joi.number().min(0).required(),
  usuario_id: Joi.number().min(0).required()
})

exports.createSubComment = Joi.object({
  usuario: Joi.number().min(1).required(),
  comentario_id: Joi.number().min(1).required(),
  comentario: Joi.string().required()
})

exports.editSubComment = Joi.object({
  usuario: Joi.number().min(1).required(),
  comentario_id: Joi.number().min(1).required(),
  comentario: Joi.string().required()
})

exports.deleteSubComment = Joi.object({
  usuario: Joi.number().min(1).required(),
  comentario_id: Joi.number().min(1).required()
})

exports.likeSubComment = Joi.object({
  usuario: Joi.number().min(1).required()
})
