'use strict'
const debug = require('debug')('old-api:events-service')
const mysqlLib = require('../lib/db')
const limitQueryRange = require('../utils/limit')

class EventsService {
  constructor () {
    if (EventsService.instance == null) {
      this.table = 'eventos'
      EventsService.instance = this
    }
    return EventsService.instance
  }

  async createEvent ({ nombre, alias, descripcion, usuario, privacidad, capacidad, direccion, google_id, imagen }, empresa) {
    debug('events->createEvent')

    const queryString = `
      INSERT INTO ${this.table}
      (nombre, alias, descripcion, host_usuario, host_empresa, privacidad, capacidad, direccion, google_id, imagen)
      VALUES
      ('${nombre}', '${alias}' ,'${descripcion}', ${usuario}, ${empresa}, ${privacidad}, ${capacidad}, '${direccion}', '${google_id}', ${imagen ? `'${imagen}'` : null})
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async createSchedule (evento, horarios) {
    debug('events->createSchedule')

    const valores = []

    horarios.forEach(h => {
      valores.push(`('${h.uuid}', ${evento}, '${h.fecha}', '${h.apertura}', '${h.cierre}')`)
    })

    const queryString = `
    INSERT INTO eventos_horarios
      (horario_uuid, evento_id, fecha, apertura, cierre)
    VALUES
    ${valores.join(', ')}
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getEvents (page = 1, limit = 10) {
    debug('events->getEvents')
    const queryString = `
      SELECT * FROM ${this.table}
      WHERE privacidad = 1
      ORDER BY IF(fecha_actualizacion, fecha_actualizacion, fecha_creacion) DESC
      LIMIT ${limitQueryRange(page, limit)}
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getEvent (evento) {
    debug('events->getEvent')

    const queryString = `
      SELECT * FROM ${this.table}
      WHERE evento_id = ${evento}
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getSchedule (evento) {
    debug('events->getSchedule')

    const queryString = `
      SELECT * FROM eventos_horarios
      WHERE evento_id = ${evento}
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async editEvent ({ nombre, alias, descripcion, privacidad, direccion, google_id, imagen }, evento) {
    debug('events->editEvent')

    let imagenQuery = ''
    if (imagen) imagenQuery = `imagen = '${imagen}',`

    const queryString = `
      UPDATE ${this.table}
      SET
        nombre = '${nombre}',
        alias = '${alias}',
        descripcion = '${descripcion}',
        privacidad = ${privacidad},
        direccion = '${direccion}',
        google_id = '${google_id}',
        ${imagenQuery}
        fecha_actualizacion = NOW()
      WHERE evento_id = ${evento}
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async editSchedule ({ id, fecha, apertura, cierre }) {
    debug('events->editSchedule')

    const queryString = `
      UPDATE eventos_horarios
      SET
        fecha = '${fecha}',
        apertura = '${apertura}',
        cierre = '${cierre}'
      WHERE horario_uuid = '${id}'
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async deleteSchedule (id, evento) {
    debug('events->deleteSchedule')

    const queryString = `
      DELETE FROM eventos_horarios
      WHERE horario_uuid = '${id}'
      AND evento_id = ${evento}
      LIMIT 1
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async createInvitations (evento, usuarios) {
    debug('events->createInvitations')

    const valores = []
    usuarios.forEach(usuario => {
      valores.push(`(${evento}, ${usuario})`)
    })

    const queryString = `
      INSERT INTO eventos_invitados
      (evento_id, usuario_id)
      VALUES
      ${valores.join(',')}
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getUsersAlreadyInvited (evento, usuarios) {
    debug('events->getUsersAlreadyInvited')

    const queryString = `
      SELECT usuario_id AS "id"
      FROM eventos_invitados
      WHERE usuario_id IN
        (${usuarios.join(',')})
      AND evento_id = ${evento}
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getInvitations (evento) {
    debug('events->getInvitations')

    const queryString = `
      SELECT
        ei.tipo,
        u.usu_id,
        u.usu_nombre,
        u.usu_app,
        u.usu_puesto,
        u.usu_foto,
        e.emp_id,
        e.emp_nombre,
        e.emp_website,
        e.emp_logo,
        e.emp_banner
      FROM eventos_invitados AS ei
      JOIN usuario AS u
      ON u.usu_id = ei.usuario_id
      JOIN empresa_usuario AS eu
      ON eu.usu_id = u.usu_id
      JOIN empresa AS e
      ON e.emp_id = eu.emp_id
      WHERE evento_id = ${evento}
      ORDER BY u.usu_nombre ASC
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async editInvitation (tipo, evento, usuario) {
    debug('events->editInvitation')

    const queryString = `
      UPDATE eventos_invitados
      SET
        tipo = ${tipo}
      WHERE evento_id = ${evento}
      AND usuario_id = ${usuario}
      LIMIT 1
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async deleteInvitation (evento, usuario) {
    debug('events->deleteInvitation')

    const queryString = `
      DELETE FROM eventos_invitados
      WHERE evento_id = ${evento}
      AND usuario_id = ${usuario}
      LIMIT 1
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getPhotos (evento) {
    debug('events->getPhotos')

    const queryString = `
    SELECT 
      foto_uuid,
      usuario_id,
      url
    FROM eventos_fotos
    WHERE evento_id = ${evento}
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getEventsByCompanyId (empresa, page = 1, limit = 10) {
    debug('events->getEventsByCompanyId')

    const queryString = `
      SELECT *
      FROM ${this.table}
      WHERE host_empresa = ${empresa}
      ORDER BY IF(fecha_actualizacion, fecha_actualizacion, fecha_creacion) DESC
      LIMIT ${limitQueryRange(page, limit)}
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getGroupByName (company, name) {
    debug('events->getGroupByName')

    const queryString = `
      SELECT *
      FROM eventos_grupo
      WHERE empresa_id = ${company}
      AND nombre = '${name}'
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getGroupByID (id) {
    debug('events->getGroupByID')

    const queryString = `
      SELECT *
      FROM eventos_grupo
      WHERE grupo_uuid = '${id}'
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async createGroup (uuid, { empresa_id, nombre }) {
    debug('events->createGroup')

    const queryString = `
      INSERT INTO eventos_grupo
      (grupo_uuid, empresa_id, nombre)
      VALUES
      ('${uuid}', ${empresa_id}, '${nombre}')
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async deleteGroup (uuid) {
    debug('events->deleteGroup')

    const queryString = `
      DELETE FROM eventos_grupo
      WHERE grupo_uuid = '${uuid}'
      LIMIT 1
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async createGroupMembers (uuid, members) {
    debug('events->createGroupMembers')

    const value = []
    members.forEach(m => value.push(`('${uuid}', ${m})`))

    const queryString = `
      INSERT INTO eventos_grupo_usuario
      (grupo_uuid, usuario_id)
      VALUES
      ${value}
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async deleteGroupMembers (uuid) {
    debug('events->deleteGroupMembers')

    const queryString = `
      DELETE FROM eventos_grupo_usuario
      WHERE grupo_uuid = '${uuid}'
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async deleteGroupMembersByID (uuid, usuarios) {
    debug('events->deleteGroupMembersByID')

    const queryString = `
      DELETE FROM eventos_grupo_usuario
      WHERE grupo_uuid = '${uuid}'
      AND usuario_id IN (${usuarios.join(',')})
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async editGroup (uuid, { nombre }) {
    debug('events->editGroup')

    const queryString = `
      UPDATE eventos_grupo
      SET nombre = '${nombre}'
      WHERE grupo_uuid = '${uuid}'
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getGroupMembersAlready (uuid, usuarios) {
    debug('events->getGroupMembersAlready')

    const queryString = `
      SELECT usuario_id AS "id"
      FROM eventos_grupo_usuario
      WHERE grupo_uuid = '${uuid}'
      AND usuario_id IN (${usuarios.join(',')})
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getGroupsByCompany (company) {
    debug('events->getGroupsByCompany')

    const queryString = `
      SELECT *
      FROM eventos_grupo
      WHERE empresa_id = ${company}
      ORDER BY nombre ASC
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getGroupMembers (uuid, company) {
    debug('events->getGroupMembers')

    const queryString = `
      SELECT
        u.usu_id AS "usuario_id",
        u.usu_nombre AS "usuario_nombre",
        u.usu_app AS "usuario_apellido",
        u.usu_email AS "usuario_email",
        u.usu_foto AS "usuario_avatar",
        u.usu_tipo AS "usuario_tipo",
        e.emp_id AS "empresa_id",
        e.emp_nombre AS "empresa_nombre",
        e.emp_logo AS "empresa_logo",
        e.emp_website AS "empresa_website"
      FROM eventos_grupo AS eg
      JOIN eventos_grupo_usuario AS egu
      ON egu.grupo_uuid = eg.grupo_uuid
      JOIN usuario AS u
      ON u.usu_id = egu.usuario_id
      JOIN empresa_usuario AS eu
      ON eu.usu_id = egu.usuario_id
      JOIN empresa AS e
      ON e.emp_id = eu.emp_id
      WHERE eg.grupo_uuid = '${uuid}'
      AND eg.empresa_id = ${company}
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getPrivateEventsByUserId (user) {
    debug('events->getPrivateEventsByUserId')

    const queryString = `
      SELECT
        e.evento_id,
        e.nombre,
        e.alias,
        e.descripcion,
        e.host_usuario,
        e.host_empresa,
        e.privacidad,
        e.direccion,
        e.google_id,
        e.imagen,
        e.fecha_creacion AS "created_at",
        e.fecha_actualizacion AS "updated_at",
        em.emp_nombre,
        u.usu_id,
        u.usu_nombre,
        u.usu_app,
        u.usu_foto,
        "Evento" AS "tipo"
      FROM eventos AS e
      JOIN eventos_invitados as ei ON ei.evento_id = e.evento_id
      JOIN empresa AS em ON em.emp_id = e.host_empresa
      JOIN usuario AS u ON u.usu_id = e.host_usuario
      WHERE ei.usuario_id = ${user}
      AND e.privacidad = 2
      ORDER BY IF(e.fecha_actualizacion, e.fecha_actualizacion, e.fecha_creacion) DESC
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getEventsByUserNetwork (user) {
    debug('events->getEventsByUserNetwork')

    const queryString = `
      SELECT
        e.evento_id,
        e.nombre,
        e.alias,
        e.descripcion,
        e.host_usuario,
        e.host_empresa,
        e.privacidad,
        e.direccion,
        e.google_id,
        e.imagen,
        e.fecha_creacion AS "created_at",
        e.fecha_actualizacion AS "updated_at",
        em.emp_nombre,
        u.usu_id,
        u.usu_nombre,
        u.usu_app,
        u.usu_foto,
        "Evento" AS "tipo"
      FROM empresa_usuario as eu
      JOIN eventos AS e ON e.host_empresa = eu.emp_id
      JOIN empresa AS em ON em.emp_id = eu.emp_id
      JOIN usuario AS u ON u.usu_id = e.host_usuario
      WHERE (
        eu.usu_id in (
          SELECT usu_id_amigo
          FROM network
          WHERE usu_id_origen = ${user}
          AND net_status = 1
        )
        OR eu.usu_id in (
          SELECT usu_id_origen
          FROM network
          WHERE usu_id_amigo = ${user}
          AND net_status = 1
        )
      )
      AND e.privacidad = 1
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getIsUserInvitedToPrivateEvent (user, event) {
    debug('events->getIsUserInvitedToPrivateEvent')

    const queryString = `
      SELECT *
      FROM eventos_invitados
      WHERE evento_id = ${event}
      AND usuario_id = ${user}
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getFavoriteStatusByUser (user, event) {
    debug('events->getIsUserInvitedToPrivateEvent')

    const queryString = `
      SELECT *
      FROM eventos_favorito_usuario
      WHERE evento_id = ${event}
      AND usuario_id = ${user}
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async createFavoriteStatusByUser (user, event) {
    debug('events->createFavoriteStatusByUser')

    const queryString = `
      INSERT INTO eventos_favorito_usuario
      (evento_id, usuario_id)
      VALUES
      (${event}, ${user})
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async removeFavoriteStatusByUser (user, event) {
    debug('events->removeFavoriteStatusByUser')

    const queryString = `
      DELETE FROM eventos_favorito_usuario
      WHERE evento_id = ${event} AND usuario_id = ${user}
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async checkIfIsFavorite (event, user) {
    debug('events->checkIfIsFavorite')

    const queryString = `
      SELECT * FROM eventos_favorito_usuario
      WHERE evento_id = ${event} AND usuario_id = ${user}
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async assistPublicEvent (type, event, user) {
    debug('events->assistPublicEvent')
    const queryString = `
      INSERT INTO eventos_invitados
      (evento_id, usuario_id, tipo)
      VALUES
      (${event}, ${user}, ${type})
    `
    const { result: { affectedRows } } = await mysqlLib.query(queryString)
    return Boolean(affectedRows)
  }

  async checkPreviousInvitation (event, user) {
    debug('events->checkPreviousInvitation')
    const queryString = `
      SELECT * FROM eventos_invitados
      WHERE evento_id = ${event}
      AND usuario_id = ${user}
    `
    const { result } = await mysqlLib.query(queryString)
    const total = result.length
    return Boolean(total)
  }

  async editPreviousInvitation (type, event, user) {
    debug('events->editPreviousInvitation')
    const queryString = `
      UPDATE eventos_invitados
      SET tipo = ${type}
      WHERE evento_id = ${event}
      AND usuario_id = ${user}
    `
    const { result: { affectedRows } } = await mysqlLib.query(queryString)
    return Boolean(affectedRows)
  }

  async deleteEvent (eventID, userID, companyID) {
    debug('events->deleteEvent')
    // TODO: Es valido que solo este usuario lo elimine??
    const queryEventExists = `
      SELECT * FROM ${this.table}
      WHERE evento_id = ${eventID}
      AND host_usuario = ${userID}
      AND host_empresa = ${companyID}
    `
    const { result: eventExistsRaw } = await mysqlLib.query(queryEventExists)
    const [eventExists] = eventExistsRaw
    if (!eventExists) return false

    const queryGetEventPhotos = `SELECT foto_uuid, url FROM eventos_fotos WHERE evento_id = ${eventID}`
    const { result: eventPhotosRaw } = await mysqlLib.query(queryGetEventPhotos)

    // Evento existe por lo que elimna todo
    const queryDeleteEvent = `DELETE FROM ${this.table} WHERE evento_id = ${eventID}`
    const queryDeleteEventFavorite = `DELETE FROM eventos_favorito_usuario WHERE evento_id = ${eventID}`
    if (eventPhotosRaw.length !== 0) {
      const photosUUID = eventPhotosRaw.map(p => `'${p.foto_uuid}'`)
      const photosURL = eventPhotosRaw.map(p => p.url)
      const queryDeleteEventPhotos = `DELETE FROM eventos_fotos WHERE foto_uuid in (${photosUUID.join(',')})`
      await mysqlLib.query(queryDeleteEventPhotos)
    }
    const queryDeleteEventSchedules = `DELETE FROM eventos_horarios WHERE evento_id = ${eventID}`
    const queryDeleteEventGuests = `DELETE FROM eventos_invitados WHERE evento_id = ${eventID}`

    await mysqlLib.query(queryDeleteEvent)
    await mysqlLib.query(queryDeleteEventFavorite)
    await mysqlLib.query(queryDeleteEventSchedules)
    await mysqlLib.query(queryDeleteEventGuests)

    return true
  }

  async getFirstSchedule (eventID) {
    debug('events->getFirstSchedule')
    const queryEventExists = `
    SELECT DATE_FORMAT(fecha, '%Y-%m-%d') AS 'fecha', apertura FROM eventos_horarios
    WHERE evento_id = ${eventID}
    ORDER BY fecha ASC LIMIT 1
    `
    const { result: resultRaw } = await mysqlLib.query(queryEventExists)
    const [schedule] = resultRaw
    return schedule
  }
}

const inst = new EventsService()
Object.freeze(inst)

module.exports = inst
