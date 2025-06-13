'use strict'

const { web: { url } } = require('../../../config')
const createEmail = require('../../createEmail')

const invitationSignup = (addressee, companyName) => createEmail(`
  <p>Hola ${addressee}</p>
  <p>${companyName} te está invitando para que descargues la aplicación móvil de Market Choice y te mantengas conectado con ellos y otras empresas, así como para que descubras muchas nuevas oportunidades de negocio con empresas de todo el mundo desde tu celular.</p>
  <p>Además, desde la aplicación móvil de Market Choice podrás acceder a:</p>
  <ul>
    <li>Chat con clientes y proveedores en tiempo real</li>
    <li>Contacto inmediato a proveedores y compradores de todo el mundo</li>
    <li>Transacciones, cotizaciones, seguimientos y cierres de venta en un solo lugar</li>
    <li>Posiciona tus productos en los primeros lugares de búsqueda</li>
    <li>Comercialización ilimitada de productos</li>
    <li>Estadísticas de actividad de perfil empresarial, y mucho más</li>
  </ul>
  <p>¡Descarga la aplicación de Market Choice ahora mismo haciendo clic aquí!</p>
  <p>Bienvenido</p>
  <p>El equipo de Market Choice</p>
  `)

module.exports = invitationSignup
