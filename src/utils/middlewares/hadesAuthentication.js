'use strict'

// Para autorizar las llamadas a Hades con su secret key

const boom = require('boom')
const { cronosSecretKey } = require('../../config')

const hadesAuthentication = (req, _res, next) => {
  const { query: { token } } = req
  if (token !== cronosSecretKey) {
    next(boom.unauthorized('Invalid token'))
  }
  next()
}

module.exports = hadesAuthentication
