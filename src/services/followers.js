'use strict'
const debug = require('debug')('old-api:followers-service')
const mysqlLib = require('../lib/db')

class FollowersService {
  constructor () {
    if (FollowersService.instance == null) {
      this.table = 'seguidores'
      FollowersService.instance = this
    }
    return FollowersService.instance
  }

  async followsAlready (origen, destino) {
    debug('invitations->followsAlready')
    const queryString = `
      SELECT
        *
      FROM ${this.table}
      WHERE usuario_origen = ${origen}
      AND usuario_destino = ${destino}
      AND estatus = 'Follow'
    `
    const { result } = await mysqlLib.query(queryString)
    const [follows] = result
    return Boolean(follows)
  }

  async unfollowsAlready (origen, destino) {
    debug('invitations->unfollowsAlready')
    const queryString = `
      SELECT
        *
      FROM ${this.table}
      WHERE usuario_origen = ${origen}
      AND usuario_destino = ${destino}
      AND estatus = 'Unfollow'
    `
    const { result } = await mysqlLib.query(queryString)
    const [follows] = result
    return Boolean(follows)
  }

  async follow (origen, destino) {
    debug('invitations->follow')

    const queryString = `
      INSERT INTO ${this.table}
        (usuario_origen, usuario_destino)
      VALUES
      (${origen}, ${destino})
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getFollowers (usuario) {
    debug('invitations->getFollowers')

    const queryString = `
      SELECT
        s.usuario_origen AS "usuario",
        u.usu_nombre AS "nombre",
        u.usu_app AS "apellido",
        u.usu_puesto AS "puesto",
        u.usu_foto AS "avatar",
        u.usu_tipo AS "tipo",
        e.emp_id AS "empresa",
        e.emp_nombre AS "empresa_nombre",
        e.emp_razon_social AS "empresa_razon_social",
        (SELECT COUNT(*) FROM network WHERE 
(usu_id_origen = ${usuario} AND usu_id_amigo = u.usu_id) OR (usu_id_origen = u.usu_id AND usu_id_amigo = ${usuario})) AS "amistad",
        (SELECT COUNT(*) FROM seguidores WHERE usuario_origen = ${usuario} AND usuario_destino = u.usu_id AND estatus = 'Follow' ) AS "sigues",
        1 AS "te_sigue"
      FROM seguidores AS s
      JOIN usuario AS u ON u.usu_id = s.usuario_origen
      JOIN empresa_usuario AS eu ON eu.usu_id = u.usu_id
      JOIN empresa AS e ON e.emp_id = eu.emp_id
      WHERE s.usuario_destino = ${usuario}
      AND s.estatus = 'Follow'
      ORDER BY s.fecha_creacion DESC
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getFollowing (usuario) {
    debug('invitations->getFollowing')

    const queryString = `
      SELECT
        s.usuario_destino AS "usuario",
        u.usu_nombre AS "nombre",
        u.usu_app AS "apellido",
        u.usu_puesto AS "puesto",
        u.usu_foto AS "avatar",
        u.usu_tipo AS "tipo",
        e.emp_id AS "empresa",
        e.emp_nombre AS "empresa_nombre",
        e.emp_razon_social AS "empresa_razon_social",
        (SELECT COUNT(*) FROM network WHERE 
(usu_id_origen = ${usuario} AND usu_id_amigo = u.usu_id) OR (usu_id_origen = u.usu_id AND usu_id_amigo = ${usuario})) AS "amistad",
        1 AS "sigues",
        (SELECT COUNT(*) FROM seguidores WHERE usuario_origen = u.usu_id AND usuario_destino = ${usuario} ) AS "te_sigue"
      FROM seguidores AS s
      JOIN usuario AS u ON u.usu_id = s.usuario_destino
      JOIN empresa_usuario AS eu ON eu.usu_id = u.usu_id
      JOIN empresa AS e ON e.emp_id = eu.emp_id
      WHERE s.usuario_origen = ${usuario}
      ORDER BY s.fecha_creacion DESC
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async unfollow (origen, destino) {
    debug('invitations->unfollow')
    const queryString = `
      DELETE FROM ${this.table}
      WHERE usuario_origen = ${origen}
      AND usuario_destino = ${destino}
      LIMIT 1
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async changeFollowStatus (origin, destiny, status) {
    debug('invitations->changeFollowStatus')
    const queryString = `
      UPDATE ${this.table}
      SET estatus = '${status}'
      WHERE usuario_origen = ${origin}
      AND usuario_destino = ${destiny}
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async bothUsersExist (origin, destiny) {
    debug('invitations->bothUsersExist')
    const queryString = `
      SELECT usu_id
      FROM usuario
      WHERE usu_id IN (${origin}, ${destiny})
    `
    const { result } = await mysqlLib.query(queryString)
    return result.length === 2
  }

  async canUpdateFollowStatusRightNow (user, status) {
    debug('invitations->canUpdateFollowStatusRightNow')
    const queryString = `
      SELECT COUNT(*) AS 'total'
      FROM ${this.table}
      WHERE usuario_destino = ${user}
      AND estatus = '${status}'
      AND fecha_actualizacion > DATE_SUB(NOW(), INTERVAL 1 HOUR)
    `
    const { result: resultTotalRaw } = await mysqlLib.query(queryString)
    const [result] = resultTotalRaw
    const { total } = result

    return total
  }
}

const inst = new FollowersService()
Object.freeze(inst)

module.exports = inst
