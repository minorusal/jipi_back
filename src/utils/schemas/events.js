const JoiBase = require('joi')
const JoiDate = require('@hapi/joi-date')
const Joi =JoiBase.extend(JoiDate)

const createEvent = Joi.object({
  nombre: Joi.string().required(),
  alias: Joi.string().required(),
  descripcion: Joi.string().required(),
  usuario: Joi.number().required(),
  privacidad: Joi.number().min(1).max(2).required(),
  capacidad: Joi.number().min(1).required(),
  direccion: Joi.string().required(),
  google_id: Joi.string().required(),
  horarios: Joi.array().items({
    fecha: Joi.date().format('YYYY-MM-DD').required(),
    apertura: Joi.string().required(),
    cierre: Joi.string().required()
  }).required(),
  imagen: Joi.string()
})

const editEvent = Joi.object({
  nombre: Joi.string().required(),
  alias: Joi.string().required(),
  descripcion: Joi.string().required(),
  usuario: Joi.number().required(),
  privacidad: Joi.number().min(1).max(2).required(),
  direccion: Joi.string().required(),
  google_id: Joi.string().required(),
  horarios: Joi.array().items({
    id: Joi.string(),
    fecha: Joi.date().format('YYYY-MM-DD').required(),
    apertura: Joi.string().required(),
    cierre: Joi.string().required()
  }).required(),
  imagen: Joi.string()
})

const createInvitation = Joi.object({
  usuario: Joi.number().required(),
  empresa: Joi.number().required(),
  invitaciones: Joi.array().required()
})

const editInvitation = Joi.object({
  tipo: Joi.number().min(1).max(3).required()
})

const deleteInvitation = Joi.object({
  empresa: Joi.number().required(),
  usuario: Joi.number().required()
})

const createGroup = Joi.object({
  empresa_id: Joi.number().required(),
  nombre: Joi.string().required(),
  miembros: Joi.array().required()
})

const editGroup = Joi.object({
  nombre: Joi.string().required()
})

const editGroupMembers = Joi.object({
  agregados: Joi.array().items(Joi.number().min(1)).required(),
  eliminados: Joi.array().items(Joi.number().min(1)).required()
})

const adOrRemoveFavorite = Joi.object({
  usuario: Joi.number().min(1).required()
})

module.exports = {
  createEvent,
  editEvent,
  createInvitation,
  editInvitation,
  deleteInvitation,
  createGroup,
  editGroup,
  editGroupMembers,
  adOrRemoveFavorite
}
