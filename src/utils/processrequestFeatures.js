'use strict'

const debug = require('debug')('old-api:companies-router')
const sendgrid = require('../lib/sendgrid')
const { contactCustomer, contactMC } = require('./templates/emails')
const { email } = require('../config')

const generateEmailsProcess302 = async (email, name, title, desc) => {
  const msgToMC = {
    to: `Contacto Market Choice B2B <${email.sender.hola}>`,
    from: `${email.sender.name} <${email.sender.email}>`,
    replyTo: `${email}`,
    subject: `${name} está interesado en Market Choice B2B.`,
    text: title,
    html: contactMC(name, email, desc, title)
  }
  const msgToCust = {
    to: `${name} <${email}>`,
    from: `${email.sender.name} <${email.sender.email}>`,
    replyTo: `${email.sender.replyTo}`,
    subject: 'Gracias por tu interés en Market Choice B2B.',
    text: 'Nosotros te contactaremos.',
    html: contactCustomer(name, email)
  }
  try {
    await sendgrid(msgToCust)
    await sendgrid(msgToMC)
  } catch (error) {
    debug('Something went wrong sending emails. Process 302')
  }
}

module.exports = {
  generateEmailsProcess302
}
