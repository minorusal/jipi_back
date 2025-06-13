'use strict'

const debug = require('debug')('old-api:information-router')
const informationService = require('../../services/information')
const boom = require('boom')
const generateEmailBody = require('../../utils/information')
const sendgrid = require('../../lib/sendgrid')

const askForInformation = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { body } = req

    if (!body.comentarios) body.comentario = 'Sin comentarios'

    // Obtener productos y empresas que vendan lo que interesa
    const productos = await informationService.searchProducts(body.producto)
    if (productos.length === 0) return next(boom.badRequest(`No hay productos que coincidan con: ${body.producto}`))

    // Generar cuerpos de correos electrónicos
    const emailBodies = await generateEmailBody(productos, body)
    const total = emailBodies.length

    for (let i = 0; i < total; i++) {
      debug('Enviando correo de información')
      await sendgrid(emailBodies[i])
    }

    return res.json({
      error: false,
      results: {
        sent: true,
        total
      }
    })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  askForInformation
}
