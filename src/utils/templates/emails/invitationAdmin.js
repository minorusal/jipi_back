'use strict'

const { web: { url } } = require('../../../config')
const createEmail = require('../../createEmail')

const invitationAdmin = () => createEmail(`
  <p>
    Alguien te ha invitado a unirte a <b>Market Choice</b>, el nuevo market place B2B con una red social para comprar y vender a <b>Crédito</b> miles de productos entre empresas cerrando negocios de manera rápida y segura.
  </p>
  <p>
  Para unirte necesitas descargar la aplicación desde <a href="https://adan.marketchoiceb2b.com">este enlace</a> o crear tu cuenta desde nuestro <a href="${url}">sitio web</a>
  </p>
  `)

module.exports = invitationAdmin
