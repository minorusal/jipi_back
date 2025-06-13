'use strict'

const createEmail = require('../../createEmail')

// Mail de bienvenida para los proveedores y clientes invitados por las empresas ya registradas para que califique e incremente la reputación de tu compañía.

const welcomeNewProvidersAndClientsInvitedByCompanies = name => createEmail(`
  <p>¡Hola ${name}!</p>
  <p>Te damos la más cordial bienvenida a Market Choice, la plataforma B2B a crédito más grande del mercado.</p>
  <p>Ahora que eres miembro de Market Choice podrás conectar con negocios de todo el mundo, ya sea para comprar o vender.</p>
  <p>Además podrás acceder a:</p>
  <ul>
    <li>Chat con clientes y proveedores en tiempo real</li>
    <li>Contacto inmediato a proveedores y compradores de todo el mundo</li>
    <li>Transacciones, cotizaciones, seguimientos y cierres de venta en un solo lugar</li>
    <li>Posiciona tus productos en los primeros lugares de búsqueda</li>
    <li>Comercialización ilimitada de productos</li>
    <li>Estadísticas de actividad de perfil empresarial, y mucho más</li>
  </ul>
  <p>Esperamos que alcances tus metas en Market Choice manteniéndote conectado con clientes y proveedores así como llevar tu negocio al siguiente nivel.</p>
  <p>El equipo de Market Choice</p>
`)

module.exports = welcomeNewProvidersAndClientsInvitedByCompanies
