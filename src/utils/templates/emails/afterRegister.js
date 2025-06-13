'use strict'
const createEmail = require('../../createEmail')

const [video1, video2, video3, waLink] = [
  'https://www.youtube.com/watch?v=cRsAa3EHbxg',
  'https://www.youtube.com/watch?v=MmiK4YkDVe4',
  'https://www.youtube.com/watch?v=csTYZA9xnc0',
  'https://api.whatsapp.com/send?phone=5215579177540'
]

const afterRegister = (name) => createEmail(`
  <p>¡Hola ${name}!</p>
  <p>Te damos la más cordial bienvenida a Market Choice, la plataforma de comercio electrónico a crédito y de contado más grande de Latinoamérica, USA y Canadá.</p>
  <p>Como un miembro de Market Choice, ahora podrás conectar con otros negocios de todo el mundo con las siguientes funcionalidades:</p>
  <ul>
    <li>Encontrar a clientes y proveedores en tiempo real, así como invitar a tu red de negocios a que se unan a <a href=${video1} target="_blank" rel="noopener noreferrer"><u style="color: blue;">Market Choice B2B</u></a></li>
    <li>Cotizar y cerrar nuevas ventas desde un solo lugar</li>
    <li>Mostrarle al mundo tus <a href=${video2} target="_blank" rel="noopener noreferrer"><u style="color: blue;">productos</u></a></li>
    <li>Encontrar <a href=${video3} target="_blank" rel="noopener noreferrer"><u style="color: blue;">a tu cliente ideal</u></a></li>
    <li>Revisar estadísticas de tu cuenta de perfil y mucho más.</li>
  </ul>
  <p>Todas estas herramientas son completamente gratis.</p>
  <p>Y porque queremos que tengas la mejor experiencia con nosotros, te invitamos a que agendes <a href=${waLink} target="_blank" rel="noopener noreferrer"><u style="color: blue;">aquí</u></a> una llamada con uno de nuestros asesores. quienes podrán ayudarte con cualquier duda que aún tengas sobre tu cuenta, así como asistirte para completar tu perfil en la plataforma o en general alguna pregunta que tengas.</p>
  <p>Te deseamos felices ventas, y que lleves tu negocio a donde siempre has querido.</p>
  <p>El equipo de Market Choice</p>
  `)

module.exports = afterRegister
