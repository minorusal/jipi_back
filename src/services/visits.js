'use strict'
const debug = require('debug')('old-api:visits-service')
const mysqlLib = require('../lib/db')
const limitQueryRange = require('../utils/limit')

class VisitsService {
  constructor () {
    if (VisitsService.instance == null) {
      this.table = 'usuario_visita'
      VisitsService.instance = this
    }
    return VisitsService.instance
  }

  async getPreviousVisit (origen, destino) {
    debug('events->getVisit')
    const queryString = `SELECT * FROM usuario_visita WHERE origen = ${origen} AND destino = ${destino}`
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async createVisit (origen, destino) {
    debug('events->createVisit')
    const queryString = `INSERT INTO usuario_visita (origen, destino) VALUES (${origen}, ${destino})`
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async updateVisit (origen, destino) {
    debug('events->updateVisit')
    const queryString = `UPDATE usuario_visita SET visitas = visitas + 1 WHERE origen = ${origen} AND destino = ${destino}`
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getLatestsVisits (user, number, page) {
    debug('events->getLatestsVisits')
    const queryString = `
    SELECT
      uv.origen,
      uv.fecha,
      u.usu_nombre,
      u.usu_app,
      u.usu_foto,
      u.usu_puesto,
      u.usu_tipo,
      e.emp_id,
      e.emp_nombre,
      e.emp_razon_social,
      e.emp_logo,
      e.emp_certificada,
      it.nombre AS "industria",
      (SELECT COUNT(*) FROM seguidores WHERE usuario_origen = uv.origen AND usuario_destino = uv.destino AND estatus = 'Follow') AS "seguidor",
      (SELECT COUNT(*) FROM seguidores WHERE usuario_origen = ${user} AND usuario_destino = u.usu_id AND estatus = 'Follow') AS "sigues",
      (SELECT COUNT(*) FROM network WHERE (usu_id_origen = ${user} AND usu_id_amigo = u.usu_id) OR (usu_id_origen = u.usu_id AND usu_id_amigo = ${user})) AS "amistad"
    FROM usuario_visita AS uv
    JOIN usuario AS u ON u.usu_id = uv.origen
    JOIN empresa_usuario AS eu ON eu.usu_id = uv.origen
    JOIN empresa AS e ON e.emp_id = eu.emp_id
    JOIN industria AS i ON i.industria_id = e.cin_id
    JOIN industria_translate AS it ON it.industria_id = i.industria_id
    WHERE uv.destino = ${user}
    AND it.idioma_id = 1
    ORDER BY uv.fecha DESC
    LIMIT ${limitQueryRange(page, number)}`
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getCountries (companies) {
    debug('events->getCountries')
    if (companies.length === 0) return { estates: [], countries: [] }
    const queryString = `
      SELECT
        et.nombre AS "estado", pt.nombre AS "pais"
      FROM domicilio
      JOIN estado AS e USING(estado_id)
      JOIN estado_translate AS et USING(estado_id)
      JOIN pais AS p USING(pais_id)
      JOIN pais_translate AS pt USING(pais_id)
      WHERE emp_id IN (${companies.join(',')})
      AND domicilio_tipo = 1
      AND et.idioma_id = 1
      AND pt.idioma_id = 1
    `
    const { result } = await mysqlLib.query(queryString)

    const estates = result.map(r => r.estado).filter((v, i, s) => s.indexOf(v) === i)
    const countries = result.map(r => r.pais).filter((v, i, s) => s.indexOf(v) === i)

    const data = {
      estates,
      countries
    }

    return data
  }
}

const inst = new VisitsService()
Object.freeze(inst)

module.exports = inst
