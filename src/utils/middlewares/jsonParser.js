'use strict'

// Un validador de schema de joi

const boom = require('boom')

const validate = (data, schema) => {
  const { error } = schema.validate(data)
  return error
}

const jsonParser = (schema) => {
  return (req, _res, next) => {
    const { body: { body: bodyRaw } } = req
    const body = JSON.parse(bodyRaw)
    const error = validate(body, schema)
    if (error) {
      next(boom.badRequest(error))
    } else {
      next()
    }
  }
}

module.exports = jsonParser
