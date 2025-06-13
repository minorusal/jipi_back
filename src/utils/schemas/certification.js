'use strict'
const JoiBase = require('joi')
const JoiDate = require('@hapi/joi-date')
const Joi =JoiBase.extend(JoiDate)

const createCertification = Joi.object({
  empresa: Joi.number().min(1).required(),
  nrp: Joi.string().required(),
  herramienta_proteccion: Joi.number().min(1).required(),
  referencias_comerciales: Joi.array().items({
    empresa: Joi.string().required(),
    nombre: Joi.string().required(),
    correo: Joi.string().email().required(),
    telefono: Joi.string().required(),
    pais: Joi.number().min(1).required()
  }).required(),
  inmuebles: Joi.array().items({
    direccion: Joi.string().required(),
    propio: Joi.string().valid('0', '1').required(),
    comodato: Joi.string().valid('0', '1').required(),
    renta: Joi.string().valid('0', '1').required(),
    precio: Joi.number().min(0),
    oficinas_administrativas: Joi.string().valid('0', '1').required(),
    almacen: Joi.string().valid('0', '1').required(),
    area_produccion: Joi.string().valid('0', '1').required()
  }).required(),
  capital_social: Joi.number().required(),
  representante_legal: Joi.string().required(),
  representantes: Joi.array().items({
    nombre: Joi.string().required(),
    directivo: Joi.string().valid('0', '1').required(),
    consejo: Joi.string().valid('0', '1').required(),
    inversionista: Joi.string().valid('0', '1').required(),
    porcentaje: Joi.number().min(0).max(100)
  }),
  empleados: Joi.number().required(),
  empresas_relacionadas: Joi.array().items({
    nombre: Joi.string().required(),
    razon_social: Joi.string().required(),
    pais: Joi.number().required()
  }).required(),
  periodo_activo: Joi.number().min(0).required(),
  periodo_pasivo: Joi.number().min(0).required(),
  ventas: Joi.number().min(0).required(),
  capital: Joi.number().min(0).required(),
  unidad_neta: Joi.number().min(0).required(),
  fecha: Joi.date().format('YYYY-MM-DD').required()
})

const payCertification = Joi.object({
  user: Joi.number().required(),
  payment_method: Joi.string().required()
})

const certificateMyCompanyForTest = Joi.object({
  company: Joi.number().min(0).required()
})

module.exports = {
  createCertification,
  payCertification,
  certificateMyCompanyForTest
}
