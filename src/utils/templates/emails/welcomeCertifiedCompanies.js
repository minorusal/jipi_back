'use strict'

const createEmail = require('../../createEmail')

// Mail de bienvenida para compañías certificadas

const welcomeCertifiedCompanies = adminName => createEmail(`
  <p>¡Hola ${adminName}, muchas felicidades!</p>
  <p>Hemos revisado tu expediente y hemos aprobado tu certificación para que le muestres al mundo lo confiable que eres para hacer negocios en Market Choice.</p>
  <p>Ahora que ya eres uno de los miles de miembros certificados de la plataforma, estás validado como una empresa existente y con buen comportamiento, sin antecedentes legales y una reputación ejemplar. </p>
  <p>Manda tu certificación a todos tus clientes y proveedores, y aumenta las oportunidades de negocio a las que ahora tienes acceso gracias a tu certificación en Market Choice.</p>
  <p>Esperamos que disfrutes tu experiencia en Market Choice, y que lleves tu negocio al siguiente nivel.</p>
  <p>El equipo de Market Choice</p>
`)

module.exports = welcomeCertifiedCompanies
