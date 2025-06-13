const Joi = require('joi')

const createSuggestion = Joi.object({
  user: Joi.number().min(0).required(),
  suggestion: Joi.string().required()
})

const createProblem = Joi.object({
  user: Joi.number().min(0).required(),
  problem: Joi.string().required()
})

module.exports = {
  createSuggestion,
  createProblem
}
