'use strict'

const { web: { url } } = require('../../../config')
const createEmail = require('../../createEmail')

// Cuando un comprador ha dejado en el carrito productos y no los ha comprado, (la idea es que lo empujemos a comprarlo.)

const productsToBuy = (addressee, product) => createEmail(`
  <p>Hola ${addressee}</p>
  <p>Hemos notado que tu carrito de compras tiene un(a) ${product} que no has cotizado todavía.</p>
  <p>Este es un producto de alta demanda, el proveedor podría quedarse sin inventario para atender la necesidad de tu negocio.</p>
  <p>Recuerda que puedes comprar a crédito o de contado para adquirir cualquier producto en Market Choice. </p>
  <p>Negocia las cotizaciones de cualquier producto con los proveedores siempre que quieras y obtén las mejores condiciones de compra.</p>
  <p>¡Que tengas una increíble experiencia de compra!</p>
  <p>El equipo de Market Choice</p>
  `)

module.exports = productsToBuy
