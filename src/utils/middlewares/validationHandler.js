'use strict'

// El validador de schemas de joi más general que existe
// la mayor parte de las rutas implementa este validador

const boom = require('boom')

function validate (data, schema) {
  const { error } = schema.validate(data)
  return error
}

function validationHandler (schema, type = 'body') {
  return function (req, res, next) {
    const error = validate(req[type], schema)
    error ? next(boom.badRequest(error)) : next()
  }
}

module.exports = validationHandler
