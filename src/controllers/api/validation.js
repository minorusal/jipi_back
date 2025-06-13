'use strict'

const boom = require('boom')
const jwt = require('jsonwebtoken')
const { externalJWTOptions: { secretKey: companySecretKey, expiresTime: companyExpiresTime }, email } = require('../../config')
const userService = require('../../services/users')
const companiesService = require('../../services/companies')
const validateEmailRegex = require('../../utils/validateEmailRegex')
const { emailjet: { key, secretKey, sender: { from } } } = require('../../config')
const mailjet = require('node-mailjet').apiConnect(key, secretKey)

const isEmailValid = async (req, res, next) => {
  try {
    const { email, taxid } = req.query

    if (!email && !taxid) return next(boom.badRequest('No query provided.'))

    const taxIdRegex = [
      /^([A-ZÑ&]{3,4}) ?(?:- ?)?(\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])) ?(?:- ?)?([A-Z\d]{2})([A\d])$/g, // MX
      /^([07][1-7]|1[0-6]|2[0-7]|[35][0-9]|[468][0-8]|9[0-589])-?\d{7}$/g, // US
      /^[0-9]{9}$/g, // CA
      /^[a-zA-Z0-9]*$/g // OTRO
    ]
    let results = {}
    let msg = ''

    if (email) {
      const emailNormalized = email.trim().toLowerCase()

      const isEmailFormatValid = validateEmailRegex(emailNormalized)
      const isEmailRegistered = (await userService.getByEmail(emailNormalized)).length !== 0

      const msgEmailRegistered = isEmailRegistered ? 'Email taken. ' : ''
      const msgEmailValid = isEmailFormatValid ? 'Provided email is valid. ' : 'Provided email has an invalid format. '
      msg += msgEmailValid + msgEmailRegistered
      results = { ...results, isEmailFormatValid, isEmailRegistered }
    }

    if (taxid) {
      const isTaxIdFormatValid = taxIdRegex.some((regexp) => regexp.test(taxid))
      const isTaxIdRegistered = (await companiesService.findRFC(taxid.toLowerCase())).length !== 0 || (await companiesService.findRFC(taxid.toUpperCase())).length !== 0

      const msgTaxIdRegistered = isTaxIdRegistered ? 'Tax ID already registered. ' : ''
      const msgTaxIdValid = isTaxIdFormatValid ? 'Tax ID format valid.' : 'Provided Tax ID has an invalid format.'
      msg += msgTaxIdRegistered + msgTaxIdValid
      results = { ...results, isTaxIdFormatValid, isTaxIdRegistered }
    }

    return res.json({
      ok: true,
      msg,
      results
    })
  } catch (error) {
    next(error)
  }
}

const sendEmailTemplateRegister = async (req, res, next) => {
  try {
    const { email, nombre, token, idUser } = req.body
    const response = await mailjet
      .post('send', { version: 'v3.1' })
      .request({
        Messages: [
          {
            From: {
              Email: 'mkt@credibusiness.site',
              Name: 'credibusiness'
            },
            To: [
              {
                Email: email,
                Name: nombre
              }
            ],
            TemplateID: 6185967,
            TemplateLanguage: true,
            Variables: {
              "token": token,
              "idUser": idUser
            }
          }
        ]
      });

      res.status(200).json(response.body)
  } catch (error) {
    next(error)
  }
}

const sendEmailTemplate = async (req, res, next) => {
  try {

    console.log('sendEmailTemplate ', req.body)

    const { email, nombre, templateID } = req.body
    const response = await mailjet
      .post('send', { version: 'v3.1' })
      .request({
        Messages: [
          {
            From: {
              Email: 'mkt@credibusiness.site',
              Name: 'credibusiness'
            },
            To: [
              {
                Email: email,
                Name: nombre
              }
            ],
            TemplateID: templateID,
            TemplateLanguage: true,
            Variables: req.body ?  {...req.body}  : { }
            
          }
        ]
      });

      console.log('response.body == ');
      console.log(response.body);

      res.status(200).json(response.body)
  } catch (error) {
    console.log('errr ', error)
    next(error)
  }
}

const sendEmail = async (req, res, next) => {
  try {
    const {
      to,
      from = 'mkt@credibusiness.site',
      subject,
      text,
      html,
      toName,
      fromName
    } = req.body;

    if (!to || !subject || !text) {
      return next(boom.badRequest('Información incompleta'))
    }

    const response = await configEmail({ to, from, subject, text, html, toName, fromName });
    res.status(200).json(response);

  } catch (error) {
    next(error)
  }
}

const configEmail = async (emailDetails) => {
  const {
    to,
    from,
    subject,
    text,
    html,
    toName = 'Recipient Name',
    fromName = 'Sender Name'
  } = emailDetails;
  try {
    const result = await mailjet
      .post('send', { version: 'v3.1' })
      .request({
        Messages: [
          {
            From: {
              Email: from,
              Name: fromName
            },
            To: [
              {
                Email: to,
                Name: toName
              }
            ],
            Subject: subject,
            TextPart: text,
            HTMLPart: html || ''
          }
        ]
      });
    return result.body;
  } catch (error) {
    throw error;
  }
}

const verifyToken = async (token) => {
  try {
    const decoded = jwt.verify(token, companySecretKey)
    return decoded
  } catch (error) {
    return error
  }
}


const validToken = async (req, res, next) => {
  try {
    const { token, userId } = req.params
    const [getToken] = await userService.getUserToken(userId)

    if (token !== getToken.token) return next(boom.badRequest('El token no coincide'))

    const tokenValid = await verifyToken(token)

    if (tokenValid.hasOwnProperty('message')) return next(boom.badRequest('El token ha expirado o el token es invalido'))

    const estatusActual = await userService.changeStatus(userId, 'confirmado')

    if (estatusActual.affectedRows == 0) return next(boom.badRequest('ENo se confirmo correctamente el registro'))

    return res.json({
      ok: true,
      userId,
      token,
      tokenValid,
      estatusActual
    })
  } catch (error) {
    next(error)
  }
}

const estatusRegistro = async (req, res, next) => {
  try {
    const { userId, estatus } = req.body
    const estatusActual = await userService.changeStatus(userId, estatus)
    return res.json({
      ok: true,
      estatusActual
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  isEmailValid,
  sendEmail,
  validToken,
  estatusRegistro,
  sendEmailTemplateRegister,
  sendEmailTemplate
}
