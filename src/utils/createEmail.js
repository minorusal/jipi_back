'use strict'

const header = require('./templates/emails/components/header')
const footer = require('./templates/emails/components/footer')
const mjml2html = require('./mjml2HTML')

module.exports = body => mjml2html(`
${header}
${body}
${footer}
`)
