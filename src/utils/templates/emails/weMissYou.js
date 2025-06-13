'use strict'

const createEmail = require('../../createEmail')

// Cuando no se hayan conectado en 10 días, decirles que los hemos extrañado y recordarles todo lo que pueden hacer

const weMissYou = name => createEmail(`
  <p>Hola ${name}</p>
  <p>Hemos notado que has estado ausente en los últimos días en Market Choice y te extrañamos :(</p>
  <p>Recuerda que puedes mantenerte en comunicación activa con tus clientes y proveedores, así como explorar nuevas oportunidades de negocio 24/7. Usa gratis el ecosistema de Market Choice en cualquier momento, los resultados de tu negocio pueden cambiar.</p>
  <p>Regresa a Market Choice dando clic aquí.</p>
  <p>¡Nos vemos muy pronto!</p>
  <p>El equipo de Market Choice</p>
  `)

module.exports = weMissYou
