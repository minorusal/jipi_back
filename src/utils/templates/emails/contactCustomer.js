'use strict'

const createEmail = require('../../createEmail')

const contactCustomer = (nombre, email) => createEmail(`
    <p>¡Hola ${nombre}!</p>
    <p>Antes que nada, muchas gracias por tu interés en Market Choice!</p>
    <p>Nos encantaría conocerte y saber más de ti, por lo que uno de nuestros ejecutivos se pondrá en contacto contigo en el siguiente correo que nos proporcionaste:</p>
    <p><strong>${email}<strong></p>
    <p>¡Saludos!</p>
    <p>El equipo de Market Choice</p>
`)

module.exports = contactCustomer
