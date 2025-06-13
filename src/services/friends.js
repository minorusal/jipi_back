'use strict'

const debug = require('debug')('old-api:friends-service')
const mysqlLib = require('../lib/db')

class FriendService {
  constructor () {
    if (FriendService.instance == null) {
      this.table = 'network'
      FriendService.instance = this
    }
    return FriendService.instance
  }

  async get (query) {
    debug('FriendService -> get')
    const queryString = `
      SELECT
        uo.usu_id AS "usuario_origen_id",
        uo.usu_nombre AS "usuario_origen_nombre",
        uo.usu_app AS "usuario_origen_apellido",
        uo.usu_puesto AS "usuario_origen_puesto",
        uo.usu_email AS "usuario_origen_email",
        uo.usu_verificado AS "usuario_origen_verificado",
        uo.usu_foto AS "usuario_origen_avatar",
        uo.usu_tipo AS "usuario_origen_tipo",
        f.net_tipo AS "amistad_tipo",
        f.net_fecha AS "amistad_fecha",
        f.net_status AS "amistad_estatus",
        ua.usu_id AS "usuario_amigo_id",
        ua.usu_nombre AS "usuario_amigo_nombre",
        ua.usu_app AS "usuario_amigo_apellido",
        ua.usu_puesto AS "usuario_amigo_puesto",
        ua.usu_email AS "usuario_amigo_email",
        ua.usu_verificado AS "usuario_amigo_verificado",
        ua.usu_foto AS "usuario_amigo_avatar",
        ua.usu_tipo AS "usuario_amigo_tipo",
        e.emp_id AS "empresa_amigo_id",
        e.emp_nombre AS "empresa_amigo_nombre",
        e.emp_razon_social AS "empresa_amigo_razon_social",
        e.emp_website AS "empresa_amigo_web",
        e.emp_logo AS "empresa_amigo_logo",
        e.emp_banner AS "empresa_amigo_banner",
        e.emp_certificada AS "empresa_amigo_certificada",
        eo.emp_id AS "empresa_origen_id",
        eo.emp_nombre AS "empresa_origen_nombre",
        eo.emp_razon_social AS "empresa_origen_razon_social",
        eo.emp_website AS "empresa_origen_web",
        eo.emp_logo AS "empresa_origen_logo",
        eo.emp_banner AS "empresa_origen_banner",
        eo.emp_certificada AS "empresa_origen_certificada"
      FROM ${this.table} AS f
      JOIN usuario AS uo ON uo.usu_id = f.usu_id_origen
      JOIN usuario AS ua ON ua.usu_id = f.usu_id_amigo
      JOIN empresa_usuario AS eua ON eua.usu_id = f.usu_id_amigo
      JOIN empresa AS e ON e.emp_id = eua.emp_id
      JOIN empresa_usuario AS euo ON euo.usu_id = f.usu_id_origen
      JOIN empresa AS eo ON eo.emp_id = euo.emp_id
      WHERE 
        f.net_status != 0 
      AND 
        (f.usu_id_origen = ${query.usuario_id} OR f.usu_id_amigo = ${query.usuario_id})
      ${query && query.estatus ? `AND f.net_status = ${query.estatus}` : ''}
      ORDER BY f.net_fecha DESC
    `

    debug(queryString)
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async findOne (query) {
    debug('FriendService -> findOne')

    const queryString = `
      SELECT
        *
      FROM ${this.table} AS f
      WHERE 
        f.net_status != 0 
      AND 
        (
          (f.usu_id_origen = ${query.usu_id_origen} AND f.usu_id_amigo = ${query.usu_id_amigo})
          OR
          (f.usu_id_origen = ${query.usu_id_amigo} AND f.usu_id_amigo = ${query.usu_id_origen})
        )
    `
    debug(queryString)

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async refuseOrDelete (query) {
    debug('FriendService -> findOne')
    debug(query)

    const queryString = `
      DELETE
      FROM ${this.table}
      WHERE 
        net_status != 0 
      AND 
      (
        (usu_id_origen = ${query.usu_id_origen} AND usu_id_amigo = ${query.usu_id_amigo})
        OR
        (usu_id_origen = ${query.usu_id_amigo} AND usu_id_amigo = ${query.usu_id_origen})
      )
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async areFriends (params) {
    debug('FriendService -> areFriends')

    const queryString = `
      SELECT
        *
      FROM ${this.table} AS f
      WHERE
        (usu_id_origen = ${params.myId} and usu_id_amigo = ${params.userId})
      OR
        (usu_id_origen = ${params.userId} and usu_id_amigo = ${params.myId})
    `
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async findByEmail (email) {
    debug('FriendService -> findByEmail')

    const queryString = `
      SELECT * FROM usuario WHERE usu_email = ${email}
    `
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getFriends (usuario) {
    debug('FriendService -> getFriends')

    const queryString = `
      SELECT
        n.net_tipo,
        n.net_fecha,
        n.net_status,
        u.usu_id,
        u.usu_nombre,
        u.usu_app,
        u.usu_puesto,
        u.usu_email,
        u.usu_foto,
        (SELECT COUNT(*) FROM seguidores WHERE usuario_origen = ${usuario} AND usuario_destino = u.usu_id AND estatus = 'Follow' ) AS "sigues",
        (SELECT COUNT(*) FROM seguidores WHERE usuario_origen = u.usu_id AND usuario_destino = ${usuario} AND estatus = 'Follow' ) AS "te_sigue"
      FROM network AS n
      JOIN usuario AS u
      ON u.usu_id = IF (n.usu_id_amigo = ${usuario}, n.usu_id_origen, n.usu_id_amigo)
      WHERE usu_id_origen = ${usuario}
      OR usu_id_amigo = ${usuario}
      ORDER BY n.net_fecha DESC
    `
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async createFriendshipFromDeal (buyer, seller) {
    debug('FriendService -> createFriendshipFromDeal')

    const queryString = `
      INSERT INTO network
        (usu_id_origen, usu_id_amigo, net_tipo, net_fecha, net_status)
      VALUES(${buyer}, ${seller}, 2, NOW(), 1)
    `
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getFriendsByCompanyAndType (user, company, type) {
    debug('FriendService -> getFriendsByCompanyAndType')
    const queryString = `
      SELECT
        n.net_tipo,
        eu.emp_id,
        u.usu_id,
        u.usu_tipo
      FROM network AS n
      JOIN empresa_usuario AS eu on eu.usu_id = n.usu_id_amigo
      JOIN usuario AS u on u.usu_id = n.usu_id_amigo
      WHERE n.usu_id_origen = ${user}
      AND eu.emp_id = ${company}
      AND u.usu_tipo = ${type}
    `
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async canDeleteFriendship (userA, userB) {
    debug('FriendService -> canDeleteFriendship')
    // Reportadas
    // Si existen cotizaciones que tengan algún reporte con estatus de vigente
    const queryReported = `
      SELECT
        cot_id, cot_status
      FROM cotizacion AS c
      JOIN reporte_cotizacion AS rc USING(cot_id)
      WHERE
      (
        (usu_id_comprador = ${userA} AND usu_id_vendedor = ${userB})
        OR
        (usu_id_comprador = ${userB} AND usu_id_vendedor = ${userA})
      )
      AND cot_status = 2
      AND rc.vigente <> 1
    `
    const { result: reported } = await mysqlLib.query(queryReported)
    const totalReported = reported.length
    if (totalReported !== 0) return false

    // Vencidas
    // Si el vendedor no le ha indicado a mc que el comprador le pago
    // Pendientes
    // Las que ya pasaron la fecha de pago y que el vendedor no ha indicado a mc que ya le pagaron
    return true
  }
}

const inst = new FriendService()
Object.freeze(inst)

module.exports = inst
