'use strict'
const debug = require('debug')('old-api:quotes-service')
const mysqlLib = require('../lib/db')
const limitQueryRange = require('../utils/limit')

class SearchService {
  constructor () {
    if (SearchService.instance == null) {
      this.table = 'usuario'
      this.historyTable = 'historial_busqueda'
      SearchService.instance = this
    }
    return SearchService.instance
  }

  async getEmpresas (texto, user, query) {
    debug('search->getEmpresas')

    let limitCondition = query && query.limit ? `LIMIT ${query.limit}` : ''
    limitCondition = (query && query.limit && query.page) ? `${limitCondition} OFFSET ${(parseInt(query.page) - 1) * parseInt(query.limit)}` : limitCondition

    let queryString = `
    SELECT
      e.emp_id AS "empresa_id",
      e.cin_id,
      -- e.emp_nombre AS "nombre",
      -- e.emp_razon_social AS "nombre",
      CONCAT(COALESCE(e.emp_razon_social, ''), ' ', COALESCE(cd.denominacion, '')) AS "nombre",
      e.emp_rfc AS "rfc",
      e.emp_logo AS "logo",
      e.emp_banner AS "banner",
      e.emp_certificada AS "certificada",
      et.emp_desc AS "descripcion",
      ${user ? `(SELECT IF(COUNT(*) > 0, true, false) FROM empresa_usuario_favorito WHERE usu_id = ${user} AND emp_id = e.emp_id)` : `${null}`} AS "favorita"
    FROM empresa as e
    LEFT JOIN empresa_translate AS et ON et.emp_id = e.emp_id
    LEFT JOIN cat_denominacion cd ON cd.id = e.denominacion
    WHERE
      REPLACE(REPLACE(e.emp_razon_social,'z','s'),'h','') LIKE REPLACE(REPLACE('%${texto}%','z','s'),'h','')
      AND (
        et.idioma_id = 1
        OR et.idioma_id IS NULL
      )
    ${limitCondition}
    `
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)

    queryString = `
    SELECT
      count(*) as count
    FROM empresa as e
    LEFT JOIN empresa_translate AS et ON et.emp_id = e.emp_id
    WHERE
      REPLACE(REPLACE(e.emp_razon_social,'z','s'),'h','') LIKE REPLACE(REPLACE('%${texto}%','z','s'),'h','')
      AND (
        et.idioma_id = 1
        OR et.idioma_id IS NULL
      )
    `

    const { result: totalRaw } = await mysqlLib.query(queryString)
    const [{ count }] = totalRaw
    return { empresas: result, totalEmpresas: count }
  }

  async getUsuarios (texto, user) {
    debug('search->getUsuarios')
    let queryString = `
      SELECT
        u.usu_id,
        u.usu_nombre,
        u.usu_app,
        u.usu_puesto,
        u.usu_email,
        u.usu_verificado,
        u.usu_idioma,
        u.usu_foto,
        u.usu_card,
        u.usu_tipo,
        u.usu_status,
        e.emp_id,
        e.emp_nombre,
        e.emp_razon_social,
        e.emp_certificada,
        ${user ? `(SELECT net_status FROM network WHERE (usu_id_origen = ${user} AND usu_id_amigo = u.usu_id) OR (usu_id_origen = u.usu_id AND usu_id_amigo = ${user}) )` : `${null}`}
        AS 'amistad',
        ${user ? `(SELECT usuario_destino FROM seguidores WHERE usuario_origen = ${user} AND usuario_destino = u.usu_id AND estatus = 'Follow')` : `${null}`} AS 'following'
      FROM usuario as u
      JOIN empresa_usuario as eu
        ON eu.usu_id = u.usu_id
      JOIN empresa as e
        ON e.emp_id = eu.emp_id
      WHERE`
    if (user) {
      queryString = `
        ${queryString}
        (
          CONCAT(u.usu_nombre, ' ', u.usu_app) LIKE '%${texto}%'
          OR u.usu_email LIKE '${texto}%'
        )
        AND u.usu_status = 1
        AND u.usu_id NOT IN (
          SELECT
          case when usu_id_amigo = ${user} then usu_id_origen else usu_id_amigo end  AS id_user
          FROM network
          WHERE (usu_id_origen = ${user} or usu_id_amigo = ${user})
          AND net_status = 1
        )
        AND u.usu_id <> ${user}
        `
    } else {
      queryString = `
        ${queryString}
        (
          CONCAT(u.usu_nombre, ' ', u.usu_app) LIKE '%${texto}%'
          OR u.usu_email LIKE '${texto}%'
        )
        AND u.usu_status = 1
      `
    }
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getSugerenciasEmpresas (texto) {
    debug('search->getSugerenciasEmpresas')

    const queryString = `
    SELECT
      emp_nombre AS "nombre",
      emp_rfc AS "rfc"
    FROM empresa
    WHERE
      replace(replace(emp_nombre,'z','s'),'h','') LIKE replace(replace('%${texto}%','z','s'),'h','')
    LIMIT 5
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getSugerenciasDirectorio (text, registered) {
    debug('search->getSugerenciasDirectorio')

    const queryString = `
    SELECT
    CASE
         WHEN NombreSimple IS NULL OR NombreSimple=''
         THEN empresa
         ELSE NombreSimple
    END AS nombre
    FROM cronos_directorio WHERE  (rfc IS NOT NULL OR rfc!='') AND (
          empresa LIKE '%${text}%'
          OR NombreSimple LIKE '%${text}%'
          OR rfc LIKE '%${text}%'
         )
         AND rfc NOT IN ('${registered.join('\', \'')}')
         LIMIT 5
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getSugerenciasUsuarios (texto, usuario) {
    debug('search->getSugerenciasUsuarios')

    let andQuery = ''
    if (usuario) {
      andQuery = `AND usu_id <> ${usuario}
                  AND usu_id NOT IN
                  (
                    SELECT usu_id_origen
                    FROM network
                    WHERE usu_id_amigo = ${usuario}
                  )
                  AND usu_id NOT IN
                  (
                    SELECT usu_id_amigo
                    FROM network
                    WHERE usu_id_origen = ${usuario}
                  )`
    }

    const queryString = `
      SELECT
        CONCAT(usu_nombre, ' ', usu_app) AS 'nombre'
      FROM
        usuario
      WHERE
        CONCAT(usu_nombre, ' ', usu_app) LIKE '%${texto}%'
      ${andQuery}
      LIMIT 5
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getEventos (text, user) {
    debug('events->getEventos')

    const queryString = `
      SELECT
        ev.evento_id,
        ev.nombre,
        ev.descripcion,
        ev.direccion,
        ev.imagen,
        em.emp_id,
        em.emp_nombre,
        em.emp_website,
        em.emp_logo,
        em.emp_certificada,
        "publico" AS "tipo",
        ${user ? `(SELECT COUNT(*) FROM eventos_favorito_usuario where evento_id = ev.evento_id and usuario_id = ${user})` : `${null}`} AS "favorito"
      FROM eventos AS ev
      JOIN empresa AS em ON em.emp_id = ev.host_empresa
      WHERE ev.privacidad = 1
      AND (
        ev.nombre LIKE '%${text}%'
        OR ev.descripcion LIKE '%${text}%'
        OR ev.direccion LIKE '%${text}%'
        OR em.emp_nombre LIKE '%${text}%'
      )
      ORDER BY ev.nombre ASC
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getEventosPrivados (text, user) {
    debug('events->getEventosPrivados')

    if (!user) return []

    const queryString = `
      SELECT
        ev.evento_id,
        ev.nombre,
        ev.descripcion,
        ev.direccion,
        ev.imagen,
        em.emp_id,
        em.emp_nombre,
        em.emp_website,
        em.emp_logo,
        em.emp_certificada,
        "privado" AS "tipo",
        ${user ? `(SELECT COUNT(*) FROM eventos_favorito_usuario where evento_id = ev.evento_id and usuario_id = ${user})` : `${null}`} AS "favorito"
      FROM eventos AS ev
      JOIN empresa AS em ON em.emp_id = ev.host_empresa
      JOIN eventos_invitados AS ei ON ei.evento_id = ev.evento_id
      WHERE ev.privacidad = 2
      AND (
      ev.nombre LIKE '%${text}%'
      OR ev.descripcion LIKE '%${text}%'
      OR ev.direccion LIKE '%${text}%'
      OR em.emp_nombre LIKE '%${text}%'
      )
      AND ei.usuario_id = ${user}
      ORDER BY ev.nombre ASC
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getSugerenciasEventos (text) {
    debug('events->getSugerenciasEventos')

    const queryString = `
      SELECT
        nombre
      FROM eventos
      WHERE privacidad = 1
      AND nombre LIKE '%${text}%'
      ORDER BY nombre ASC
      LIMIT 5
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getSugerenciasEventosPrivados (text, user) {
    debug('events->getSugerenciasEventos')
    if (!user) return []
    const queryString = `
      SELECT
        e.nombre
      FROM eventos as e
      JOIN eventos_invitados AS ei ON ei.evento_id = e.evento_id
      WHERE e.privacidad = 2
      AND e.nombre LIKE '%${text}%'
      AND ei.usuario_id = ${user}
      ORDER BY nombre ASC
      LIMIT 5
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async insertSearchHistory (text, user) {
    debug('events->insertSearchHistory')
    const queryString = `
      INSERT INTO ${this.historyTable}
      (usu_id, termino)
      VALUES
      (${user}, '${text}')
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getEmpresasBusqueda (texto) {
    debug('search->getSugerenciasEmpresas')

    const queryString = `
    SELECT
      emp_nombre AS "nombre",
      emp_rfc AS "rfc"
    FROM empresa
    WHERE
      replace(replace(emp_nombre,'z','s'),'h','') LIKE replace(replace('%${texto}%','z','s'),'h','')
      OR replace(replace(emp_rfc,'z','s'),'h','') LIKE replace(replace('%${texto}%','z','s'),'h','')
    LIMIT 5
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }
}

const inst = new SearchService()
Object.freeze(inst)

module.exports = inst
