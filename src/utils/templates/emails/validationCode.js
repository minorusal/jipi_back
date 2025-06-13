'use strict'

const createEmail = require('../../createEmail')

const validationCode = (code, name = '') => createEmail(`
  <p>Hola ${name}</p>
  <p>Hemos recibido el aviso de que solicitaste el código de verificación para registrarte en Market Choice.</p>
  <p>Si has intentado registrarte en Market Choice utiliza este código de verificación para completar el proceso: ${code}</p>
  <p>Saludos</p>
  <p>El equipo de Market Choice</p>
`)

module.exports = validationCode
