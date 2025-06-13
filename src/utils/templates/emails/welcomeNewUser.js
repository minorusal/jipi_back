'use strict'

const createEmail = require('../../createEmail')

const obtenerEquipo = tipo => {
  return tipo === 1 ? 'ventas' : 'compras'
}

// Cuando no se hayan conectado en 10 días, decirles que los hemos extrañado y recordarles todo lo que pueden hacer

const welcomeNewUser = (addressee, companyName, type) => createEmail(`
  <p>Hola ${addressee}</p>
  <p>¡Bienvenido a la comunidad Market Choice! </p>
  <p>Fuiste invitado por la compañía ${companyName} para que te sumes como parte de su equipo de ${obtenerEquipo(type)} en Market Choice.</p>
  <p>Ahora que estás a punto de ser miembro de la plataforma, podrás tener la oportunidad de colaborar en Market Choice con todo tu equipo de trabajo en un solo lugar y en tiempo real.</p>
  <p>Podrás usar las herramientas para tus objetivos de negocio, que te permitan tener claridad en las metas alcanzadas para la organización en la que colaboras.</p>
  <p>Esperamos que disfrutes tu experiencia en Market Choice, y saques lo mejor de ti en nuestra plataforma.</p>
  <p>El equipo de Market Choice</p>
  `)

module.exports = welcomeNewUser
