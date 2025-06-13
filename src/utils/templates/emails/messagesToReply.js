'use strict'

const createEmail = require('../../createEmail')

// Cuando le han mandado un chat y han transcurrido 1 hora y no ha contestado.

const messagesToReply = (name, total, from) => createEmail(`
  <p>Hola ${name}</p>
  <p>Tienes ${total} mensaje(s) pendiente de ${from}, que podría ser una gran oportunidad de negocio.</p>
  <p>No pierdas la oportunidad de mantenerte en comunicación con ${from} y crear relaciones duraderas con ellos.</p>
  <p>Para ver el mensaje da clic aquí.</p>
  <p>El equipo de Market Choice</p>
  `)

module.exports = messagesToReply
