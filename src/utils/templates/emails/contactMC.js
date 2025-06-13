'use strict'

const createEmail = require('../../createEmail')

const contactMC = (nombre, email, desc, titulo) => createEmail(`
    <p>¡Hola!</p>
    <p>Recibimos una solicitud de contacto de una persona interesada en Market Choice.</p>
    <p>Los datos de contacto son los siguientes:</p>
    <br>
    <p><strong>Nombre: </strong>${nombre}</p>
    <p><strong>Correo: </strong>${email}</p>
    <p><strong>Título: </strong>${titulo}</p>
    <p><strong>Mensaje: </strong>${desc}</p>
    <br>
    <p>Por favor no olvides darle seguimiento a este requerimiento, ya que tu colaboración es muy importante.</p>
    <p>¡Saludos!</p>
    `)

module.exports = contactMC
