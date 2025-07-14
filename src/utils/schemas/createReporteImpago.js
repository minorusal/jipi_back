'use strict'
const Joi = require('joi')

const id_boletinaje_grupo = Joi.number().integer().positive().required()
const nombre_empresa_deudora = Joi.string().max(255).required()
const rfc_deudor = Joi.string().alphanum().max(13).required()
const nombre_representante_legal = Joi.string().max(255).optional()
const numero_facturas_vencidas = Joi.number().integer().min(1).required()
const monto_adeudo = Joi.number().precision(2).positive().required()
const id_cat_boletinaje_tipo_moneda = Joi.number().integer().positive().required()
const fecha_factura = Joi.date().iso().required()
const folio_factura = Joi.string().max(100).optional()
const id_cat_boletinaje_motivo_impago = Joi.number().integer().positive().required()
const comentarios_adicionales = Joi.string().optional()
const acepta_terminos = Joi.boolean().valid(true).required()
const dar_seguimiento = Joi.boolean().optional()
const divulgar_nombre_proveedor = Joi.boolean().optional()
const frecuencia_seguimiento = Joi.number().integer().positive().optional()

const contactoSchema = Joi.object({
  nombre_contacto: Joi.string().max(255).required(),
  cargo: Joi.string().max(100).optional(),
  telefono: Joi.string().max(20).optional(),
  correo_electronico: Joi.string().email().optional()
})

const contactos_deudor = Joi.array().items(contactoSchema).min(1).optional()

const createReporteImpagoSchema = Joi.object({
  id_boletinaje_grupo,
  nombre_empresa_deudora,
  rfc_deudor,
  nombre_representante_legal,
  numero_facturas_vencidas,
  monto_adeudo,
  id_cat_boletinaje_tipo_moneda,
  fecha_factura,
  folio_factura,
  id_cat_boletinaje_motivo_impago,
  comentarios_adicionales,
  contactos_deudor,
  acepta_terminos,
  dar_seguimiento,
  divulgar_nombre_proveedor,
  frecuencia_seguimiento
})

module.exports = createReporteImpagoSchema 