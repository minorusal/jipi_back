'use strict'

// Un validador especial para las cotizaciones

const boom = require('boom')

const { getQuotes, getCheckQuotes } = require('../schemas/quotes')

const validate = (data, schema) => {
  const { error } = schema.validate(data)
  return error
}

const validateGetQuotes = (req, _res, next) => {
  const { query } = req
  const error = validate(query, getQuotes)
  if (error) next(boom.badRequest(error))
  next()
}

const validateGetCheckQuotes = (req, _res, next) => {
  const { query } = req
  const error = validate(query, getCheckQuotes)
  if (error) next(boom.badRequest(error))
  const company = Number(query.company)
  query.company = company
  next()
}

module.exports = {
  validateGetQuotes,
  validateGetCheckQuotes
}
