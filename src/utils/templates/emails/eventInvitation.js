'use strict'

const createEmail = require('../../createEmail')

// Cuando al usuario lo ha invitado otra empresa a un próximo evento

const eventInvitation = (addressee, day, time) => createEmail(`
  <p>Hola ${addressee}</p>
  <p>Esta es una invitación exclusiva de XXX para que asistas a su evento de XXX el próximo ${day} a las ${time}.</p>
  <p>En este evento podrás conocer más sobre esta empresa y su(s) producto(s), así que no pierdas la oportunidad de asistir a su evento y conectar aún más con ellos.</p>
  <p>Confirma tu asistencia al evento dando clic aquí.</p>
  <p>¡Disfruta tu experiencia en este evento!</p>
  <p>El equipo de Market Choice</p>
  `)

module.exports = eventInvitation
