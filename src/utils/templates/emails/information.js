'use strict'

const createEmail = require('../../createEmail')

const askForInformationTemplate = ({ usu_nombre: addressee }, body, productos) => createEmail(`
    <p>Hola ${addressee}</p>
    <p>Recientemente un potencial cliente tuyo se interesó en el siguiente producto de tu tienda en Market Choice:</p>
    <strong><p>${productos}</p></strong>
    <br>
    <p>Email solicitante: ${body.email}</p>
    <p>Entrega: ${body.detalles.entrega}</p>
    <p>Método de pago: ${body.detalles.metodo}</p>
    <p>Presupuesto: $${body.detalles.presupuesto}</p>
    <p>Comentarios: ${body.comentario}</p>
    <br>
    <p>Atiende este pedido lo antes posible y toma ventaja de otros proveedores que también haya cotizado. La pronta respuesta y buena atención son esenciales para cerrar más negocios.</p>
    <p>¡Éxito!</p>
    <p>El equipo de Market Choice</p>
`)

module.exports = askForInformationTemplate
