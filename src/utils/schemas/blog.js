const Joi = require('joi')

exports.authUser = Joi.object({
  email: Joi.string().trim().lowercase().required(),
  password: Joi.string().trim().required()
})

exports.createComment = Joi.object({
  comment: Joi.string().required(),
  art_id: Joi.number().min(1).required()
})

exports.createSubcomment = Joi.object({
  subcomment: Joi.string().required(),
  comment_id: Joi.number().min(1).required()
})

exports.regStats = Joi.object({
  social: Joi.object({
    browser: Joi.string().required(),
    type: Joi.number().valid(1, 2, 3).required()
  }).optional(),
  search: Joi.object({
    browser: Joi.string().required(),
    term: Joi.string().required()
  }).optional(),
  origin: Joi.object({
    browser: Joi.string().required(),
    type: Joi.number().valid(0, 1).required()
  }).optional(),
  visit: Joi.object({
    browser: Joi.string().required(),
    art_id: Joi.number().required()
  }).optional()

}).or('social', 'search', 'origin', 'visit')
