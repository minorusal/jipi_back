'use strict'

const debug = require('debug')('old-api:invitations-controller')
const boom = require('boom')
const { email } = require('../../config')
const sendgrid = require('../../lib/sendgrid')
const userService = require('../../services/users')
const { invitationAdminTemplate, invitationSignupTemplate } = require('../../utils/templates/emails')

const sendInvitationAdmin = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { body: { correo } } = req

    // Checar si el correo electrónico ya se encuentra registrado
    // Si existe badrequest
    const [existeUsuario] = await userService.getByEmail(correo)
    if (existeUsuario) return next(boom.badRequest(`El correo electrónico ${correo} ya se encuentra registrado`))

    // Armar correo electrónico

    const msg = {
      to: `${correo}`,
      from: `${email.sender.name} <${email.sender.email}>`,
      replyTo: `${email.sender.email}`,
      subject: 'Has sido invitado a Market Choice',
      text: 'Has sido invitado a Market Choice, da de alta tu empresa como administrador',
      html: invitationAdminTemplate()
    }

    // Mandar correo electrónico
    await sendgrid(msg)

    // Todo ok

    return res.json({
      error: false,
      results: {
        mensaje: `Se invió una invitación a ${correo}`
      }
    })
  } catch (err) {
    next(err)
  }
}

const sendInvitationSignUp = async (req, res, next) => {
  try {
    
    debug(`[${req.method}] ${req.originalUrl}`)
    const { body: { email, user, name } } = req
    // Checar si el correo electrónico ya se encuentra registrado
    // Si existe badrequest
    const [existeUsuario] = await userService.getByEmail(email)
    if (existeUsuario) return next(boom.badRequest('Email already registered'))

    const userDetails = await userService.getUserAndCompanyDetails(user)
    if (!userDetails) return next(boom.badRequest('Wrong user'))
    const { emp_nombre: companyName } = userDetails

    // Armar correo electrónico
    const msg = {
      to: `${email}`,
      from: `${email.name} <${email.email}>`,
      replyTo: `${email.email}`,
      subject: 'Has sido invitado a Market Choice',
      text: 'Has sido invitado a Market Choice, da de alta tu empresa como administrador',
      html: invitationSignupTemplate(name, companyName)
    }

    // Mandar correo electrónico
    await sendgrid(msg)

    // Todo ok
    return res.json({
      error: false,
      results: {
        message: 'Invitation sent'
      }
    })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  sendInvitationAdmin,
  sendInvitationSignUp
}
