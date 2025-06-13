'use strict'

// Sendgrid se utiliza para enviar correos electrónicos
// el parámetro `msg` es un objeto con los datos del mail

const sgMail = require('@sendgrid/mail')
const { email: { key } } = require('../config')

sgMail.setApiKey(key)

function sendgrid (msg) {
  console.log(key);
  return sgMail.send(msg)
}

module.exports = sendgrid
