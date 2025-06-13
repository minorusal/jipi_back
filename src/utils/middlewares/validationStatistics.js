'use strict'

// Validador especial para estadisticas

const boom = require('boom')
const moment = require('moment')

const { getNumbersByUser } = require('../schemas/statistics')

const validate = (data, schema) => {
  const { error } = schema.validate(data)
  return error
}

const validateNumbersByUser = (req, res, next) => {
  const { query, params: { user } } = req
  const error = validate(query, getNumbersByUser)
  if (error) next(boom.badRequest(error))
  const { start, finish } = query
  if (!moment(finish).isAfter(start)) next(boom.badRequest('finish must be after start'))
  if (!Math.abs(user)) next(boom.badRequest('Wrong user'))
  req.query.admin = Math.abs(req.query.admin)
  req.params.user = Math.abs(req.params.user)
  next()
}

module.exports = {
  validateNumbersByUser
}
