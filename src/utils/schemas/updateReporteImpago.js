'use strict'
const Joi = require('joi')

const id_cat_boletinaje_estatus = Joi.number().integer().positive().required()
const notificaciones_canceladas = Joi.boolean().required()

const updateReporteImpagoSchema = Joi.object({
  id_cat_boletinaje_estatus,
  notificaciones_canceladas
}).or('id_cat_boletinaje_estatus', 'notificaciones_canceladas') // Al menos uno de los dos campos debe estar presente

module.exports = updateReporteImpagoSchema 