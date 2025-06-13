'use strict'

const { web: { url } } = require('../../../config')
const createEmail = require('../../createEmail')
const button = require('./components/button')
const { createToken } = require('../../jwt')

const recoverPasswordTemplate = (name, email) => createEmail(`
    <p>Hola ${name}</p>
    <p>Hemos recibido el aviso de que solicitaste restablecer la contraseña de tu cuenta de Market Choice.</p>
    <p>Haz clic en el siguiente enlace para restablecer tu contraseña.</p>
    ${button(`${url}/recuperar-contrasena/${createToken({ email })}`, 'Cambia tu contraseña')}
    <p>Si no has solicitado este cambio, ignora este mensaje.</p>
    <p>Saludos</p>
    <p>El equipo de Market Choice</p>
`)

module.exports = recoverPasswordTemplate
