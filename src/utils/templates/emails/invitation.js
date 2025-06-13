'use strict'

const { web: { url } } = require('../../../config')
const createEmail = require('../../createEmail')

// Correo para dar de alta a compradores y vendedores

const obtenerPuesto = (tipo) => {
  if (tipo == 1) return 'vendedor'
  else if (tipo == 2) return 'comprador'
  else if (tipo == 3) return 'Administrador'
}

const convertBase64 = str => Buffer.from(str).toString('base64')

const invitation = (nombre, apellido, email, tipo, empresaId, empresaAdmin) => createEmail(`
  <p>Hola ${nombre}</p>
  <p>El administrador ${empresaAdmin}, te acaba de invitar a que te unas a Market Choice como ${obtenerPuesto(tipo)} en la plataforma para que encuentres nuevas oportunidades de negocio.</p>
  <p>Desde Market Choice podrás colaborar fácil y rápidamente con miembros de tu equipo de trabajo.</p>
  <p>Con Market Choice ten una operación de trabajo eficiente y con metas claras y definidas.</p>
  <p>¡Qué esperas para unirte a Market Choice ahora mismo! Para aceptar la invitación termina tu registro aquí.</p>
  <p>${url}/registro/${convertBase64(`${nombre}/${apellido}/${email}/${empresaId}/${tipo}`)}</p>
  <p>Bienvenido</p>
  <p>El equipo de Market Choice</p>
  `)

module.exports = invitation
