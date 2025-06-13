'use strict'
const JoiBase = require('joi')
const JoiDate = require('@hapi/joi-date')
const Joi =JoiBase.extend(JoiDate)

const getNumbersByUser = Joi.object({
  admin: Joi.number().min(1).required(),
  start: Joi.date().format('YYYY-MM-DD').required(),
  finish: Joi.date().format('YYYY-MM-DD').required()
})

const createGoalForUser = Joi.object({
  admin: Joi.number().min(1).required(),
  goal: Joi.number().min(0).required()
})

const updateGoalForUser = Joi.object({
  admin: Joi.number().min(1).required(),
  goal: Joi.number().min(0).required()
})

module.exports = {
  getNumbersByUser,
  createGoalForUser,
  updateGoalForUser
}
