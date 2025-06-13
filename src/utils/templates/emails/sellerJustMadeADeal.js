'use strict'

const createEmail = require('../../createEmail')

// PROVEEDOR Cuando hayan cerrado una transacción ósea hayan hecho un trato

const sellerJustMadeADeal = (addressee, buyerCompanyName) => createEmail(`
  <p>Hola ${addressee}</p>
  <p>¡Muchas felicidades!</p>
  <p>Acabas de cerrar un trato con ${buyerCompanyName}.</p>
  <p>Ahora ${buyerCompanyName} será parte de tu lista de clientes, así que puedes pedirle que se certifique o echarle un ojo a sus publicaciones en su red social.</p>
  <p>No olvides calificar tu experiencia de venta con tu cliente, tu opinión será de mucha ayuda para otras compañías.</p>
  <p>Recuerda que también puedes conocer a tu cliente a detalle revisando su expediente comercial y legal aquí.</p>
  <p>Esta solo es una pequeña demostración de lo que puedes hacer en Market Choice, te deseamos el mejor de los éxitos en tus próximas ventas.</p>
  <p>Recibe un cordial saludo</p>
  <p>El equipo de Market Choice</p>
`)

module.exports = sellerJustMadeADeal
