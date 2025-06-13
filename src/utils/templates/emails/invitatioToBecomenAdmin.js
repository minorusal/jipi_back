'use strict'

const { web: { url } } = require('../../../config')
const createEmail = require('../../createEmail')

const button = require('./components/button')

const convertBase64 = str => Buffer.from(str).toString('base64')

const invitationToBecomeAdmin = ({ company, user }) => createEmail(`
  <p>Hola ${user.name}</p>
  <p>Esta es una invitación para ser administrador de cuenta en Market Choice de la compañía ${company.emp_nombre}.</p>
  <p>Como administrador podrás tener la oportunidad de configurar los datos de la compañía, invitar, editar y administrar a tu equipo de trabajo (vendedores o compradores), y en general serás capaz de ver todo lo que está pasando en cada rincón de la plataforma.</p>
  <p>Para aceptar la invitación de administrador, termina tu registro aquí.</p>
  ${button(`${url}/registro/${convertBase64(`${user.name}/${user.lastName}/${user.email}/${company.emp_id}/3`)}`, 'Aquí')}
  <p>Bienvenido</p>
  <p>El equipo de Market Choice</p>
  `)

module.exports = invitationToBecomeAdmin
