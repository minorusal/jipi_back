'use strict'
const debug = require('debug')('old-api:notification-service')
const mysqlLib = require('../lib/db')
const limitQueryRange = require('../utils/limit')

class NotificationService {
  constructor () {
    if (NotificationService.instance == null) NotificationService.instance = this
    return NotificationService.instance
  }

  // How many quotes have been seen ?
  async quotesNoSeen (user, userType, company) {
    debug('NotificationService -> quoteSeen')
    const [vendedor, comprador, administrador] = [1, 2, 3]

    let userQuery = ''
    switch (userType) {
      case vendedor:
        userQuery = `AND usu_id_vendedor = ${user}`
        break
      case comprador:
        userQuery = `AND usu_id_comprador = ${user}`
        break
      case administrador:
        userQuery = `AND (emp_id_vendedor = ${company} OR emp_id_comprador = ${company})`
        break
      default:
        break
    }

    const queryString = `
      SELECT
        COUNT(*) AS "quoteNoSeen"
      FROM cotizacion 
      WHERE 
        visto = 4
      AND cot_status = 1
      ${userQuery}
    `
    debug(queryString)

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async alertsByUser (user) {
    debug('NotificationService -> alertsByUser')

    const queryString = `
      SELECT
        *
      FROM alerta
      WHERE usu_id = ${user}
      ORDER BY alerta_id ASC
    `
    debug(queryString)

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async createAlert ({ origen, destino, tipo, data }, uuid) {
    debug('NotificationService -> createAlert')

    const queryString = `
      INSERT INTO notificaciones
      (notificacion_uuid, origen_id, destino_id, tipo, data)
      VALUES
      ('${uuid}', ${origen}, ${destino}, ${tipo}, ${data})
    `
    debug(queryString)

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getLike (usuario) {
    debug('NotificationService -> getLike')

    const queryString = `
      SELECT
        pl.*,
        u.usu_id,
        u.usu_nombre,
        u.usu_app,
        u.usu_foto
      FROM
        publicaciones_likes AS pl
      LEFT JOIN
        usuario AS u
      ON u.usu_id = pf.usuario_id
      WHERE
        pl.usuario_id = ${usuario}
    `
    debug(queryString)

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async deleteAlert ({ origen, destino, tipo }, uuid) {
    debug('NotificationService -> deleteAlert')

    const queryString = `
      DELETE FROM notificaciones
      WHERE notificacion_uuid = '${uuid}'
      AND origen_id = ${origen}
      AND destino_id = ${destino}
      AND tipo = ${tipo}
      LIMIT 1
    `
    debug(queryString)

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async updateAlert (uuid, seen) {
    debug('NotificationService -> updateAlert')

    const queryString = `
      UPDATE notificaciones
      SET
      visto = ${seen}
      WHERE notificacion_uuid = '${uuid}'
    `
    debug(queryString)

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async consumeSPInsertar_consultar_notificacion (data) {
    const { IdDestino, TipoDestino, IdOrigen, TipoOrigen, IdTipoNotificacion } = data

    const queryString = `
      CALL insertar_consultar_notificacion(${IdDestino}, ${TipoDestino}, ${IdOrigen}, ${TipoOrigen}, ${IdTipoNotificacion});
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getAlertById (uuid) {
    debug('NotificationService -> getAlertById')

    const queryString = `
      SELECT *
      FROM notificaciones
      WHERE notificacion_uuid = '${uuid}'
    `
    debug(queryString)

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getAlertsByUser (user, page = 1, limit = 10) {
    debug('NotificationService -> getAlertsByUser')

    const queryString = `
      SELECT
        n.*,
        u.usu_nombre,
        u.usu_app,
        u.usu_foto,
        e.emp_nombre,
        e.emp_logo
      FROM notificaciones AS n
      JOIN usuario AS u
      ON u.usu_id = n.origen_id
      JOIN empresa_usuario AS eu
      ON eu.usu_id = u.usu_id
      JOIN empresa AS e
      ON e.emp_id = eu.emp_id
      WHERE destino_id = ${user}
      ORDER BY fecha_creacion DESC
      LIMIT ${limitQueryRange(page, limit).join()}
    `
    debug(queryString)

    const { result } = await mysqlLib.query(queryString)

    return result
  }
};

const inst = new NotificationService()
Object.freeze(inst)

module.exports = inst
