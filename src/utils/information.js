'use strict'

// Esto lo utilcé en el controlador de cotizaciones para generar los email
// para poder solicitar al comprador su review

const { email } = require('../config')
const askForInformationTemplate = require('./templates/emails/information')

const getInfoByGroups = products => products.reduce((iv, obj) => {
  const key = obj.emp_id
  if (!iv[key]) {
    iv[key] = []
  }
  iv[key].push(obj)
  return iv
}, {})

const getProductsNames = products => products.map(p => p.prod_nombre)

const generateMessage = async (info, body) => {
  const [first] = info
  const products = getProductsNames(info)
  const msg = {
    to: `${first.usu_nombre} <${first.usu_email}>`,
    from: `${email.sender.name} <${email.sender.email}>`,
    replyTo: email.sender.replyTo,
    subject: 'Alguien tiene interés en tus productos',
    text: 'Alguien solicita información sobre tus productos',
    html: askForInformationTemplate(first, body, products)
  }
  return msg
}

const generateEmailBody = async (objects, body) => {
  const groups = getInfoByGroups(objects)
  const messages = []
  for (const key in groups) {
    const information = [...groups[key]]
    const message = await generateMessage(information, body)
    messages.push(message)
  }
  return messages
}

module.exports = generateEmailBody
