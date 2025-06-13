'use strict'

const { web: { url } } = require('../../../config')
const createEmail = require('../../createEmail')
const button = require('./components/button')
const { createToken } = require('../../jwt')

const requestProductReview = (user, product, name, details) => createEmail(`
    <p>Hola ${name}</p>
    <p>Tu opinión es muy importante para Market Choice así como para la comunidad de proveedores y clientes, por lo que nos encantaría saber tu experiencia de compra con el producto:</p>
    <p>${details.product_name}</p>
    ${button(`${url}/calificar/${createToken({ user, product, rate: 10 })}`, '5 estrellas')}
    ${button(`${url}/calificar/${createToken({ user, product, rate: 8 })}`, '4 estrellas')}
    ${button(`${url}/calificar/${createToken({ user, product, rate: 6 })}`, '3 estrellas')}
    ${button(`${url}/calificar/${createToken({ user, product, rate: 4 })}`, '2 estrellas')}
    ${button(`${url}/calificar/${createToken({ user, product, rate: 2 })}`, '1 estrella')}
    ${button(`${url}/calificar/${createToken({ user, product })}`, 'Personalizado')}
    <p>Recuerda que otros miembros de Market Choice verán tu opinión sobre este y cualquier producto, así que tu los puedes ayudar a tomar una buena decisión de compra.</p>
    <p>Califica tu experiencia aquí abajo:</p>
    <p>Gracias por ayudarnos a mantener la calidad de los productos.</p>
    <p>El equipo de Market Choice</p>
`)

module.exports = requestProductReview
