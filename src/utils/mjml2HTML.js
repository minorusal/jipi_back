'use strict'
const mjml = require('mjml')
const latin2HTML = require('./latin2HTML')

module.exports = text => {
  const { html } = mjml(latin2HTML(text), {})
  return html
}
