'use strict'

const createEmail = require('../../createEmail')

// Cuando han creado un evento ellos mismos. (Decirles todo lo que pueden hacer con eventos)

const newEvent = (name, eventName) => createEmail(`
  <p>Hola ${name}</p>
  <p>Solo venimos a contarte que, ahora que creaste el nuevo evento llamado ${eventName} en Market Choice, te deseamos mucho éxito en tu evento, la mejor manera de vender es estando cerca de tus clientes. Para encontrar más consejos de eventos da clic aquí.</p>
  <p>Ahora puedes compartirlo con quien tu quieras en tus redes sociales, correo, mensajería de texto, entre más lo compartas mayores posibilidades en tu resultado obtendrás.</p>
  <p>Qué esperas para explorar más posibilidades para tu evento dando clic aquí.</p>
  <p>¡Te deseamos el mayor de los éxitos en tu evento!</p>
  <p>El equipo de Market Choice</p>
  `)

module.exports = newEvent
