'use strict'
const Joi = require('joi')

// --- Esquemas para /cuestionario ---
const id_empresa_cliente = Joi.number().integer().min(1).required()
const id_proveedor = Joi.number().integer().min(1).required()

const respuestaCuestionarioSchema = Joi.object({
  id_pregunta: Joi.number().integer().min(1).required(),
  respuesta: Joi.boolean().required()
})

const guardarCuestionarioSchema = Joi.object({
  id_empresa_cliente,
  id_proveedor,
  respuestas: Joi.array().items(respuestaCuestionarioSchema).min(1).required()
})

// --- Esquemas para /impago ---
// El esquema para crear un reporte de impago se ha movido a su propio archivo:
// src/utils/schemas/createReporteImpago.js

const notificacionSinImpago = Joi.object({
  id_proveedor: Joi.number().integer().required(),
  id_empresa_cliente: Joi.number().integer().required(),
  acepta_responsabilidad: Joi.boolean().valid(true).required(),
  incidentes: Joi.array().items(
    Joi.object({
      codigo_tipo_incidente: Joi.string().valid('FUSION', 'CESE_OPERACIONES', 'CAMBIO_CONTROLANTE', 'OTROS').required(),
      razon_social_relacionada: Joi.string().max(255).when('codigo_tipo_incidente', {
        is: Joi.valid('FUSION', 'CAMBIO_CONTROLANTE'),
        then: Joi.required(),
        otherwise: Joi.optional().allow(null, ''),
      }),
      rfc_relacionado: Joi.string().max(13).when('codigo_tipo_incidente', {
        is: Joi.valid('FUSION', 'CAMBIO_CONTROLANTE'),
        then: Joi.required(),
        otherwise: Joi.optional().allow(null, ''),
      }),
      detalles: Joi.string().when('codigo_tipo_incidente', {
        is: Joi.valid('CESE_OPERACIONES', 'OTROS'),
        then: Joi.required(),
        otherwise: Joi.optional().allow(null, ''),
      }),
    }),
  ).min(1).required(),
})

const schemas = {
  guardarCuestionarioSchema,
  notificacionSinImpago
}

module.exports = schemas; 