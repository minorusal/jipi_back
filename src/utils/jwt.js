'use strict'

// La aplicación por si no cuenta con seguridad de JWT
// pero se utiliza un JWT en un correo electrónico para solicitar el review
// de productos, ya que ese JWT ya cuenta con info del usuario y la compra

const jwt = require('jsonwebtoken')
const { tokenSecretKey } = require('../config')

const createToken = (data, expires = '24h') => jwt.sign(data, tokenSecretKey, { expiresIn: expires })

const verifyToken = (token) => {
  return jwt.verify(token, tokenSecretKey, (error, decoded) => {
    if (error) {
      return null
    }
    return decoded
  })
}

module.exports = {
  createToken,
  verifyToken
}
