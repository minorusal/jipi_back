'use strict'
const debug = require('debug')('old-api:countries-service')
const mysqlLib = require('../lib/db')

class CountriesClassService {
  constructor () {
    if (CountriesClassService.instance == null) {
      this.table = 'pais'
      CountriesClassService.instance = this
    }
    return CountriesClassService.instance
  }

  async getPaises (idioma) {
    debug('search->getPaises')

    const queryString = `
    SELECT
      p.pais_id AS "pais_id",
      p.iso AS "pais_iso",
      pt.nombre AS "pais_nombre",
      i.iso AS "idioma",
      i.idioma_id AS "idioma_id"
    FROM pais AS p
    JOIN pais_translate AS pt
      ON pt.pais_id = p.pais_id
    JOIN idioma AS i
      ON i.idioma_id = pt.idioma_id
    ${idioma ? `
    WHERE i.idioma_id = ${idioma}
    ` : ''}
    ORDER BY pt.nombre
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getEstados (pais_id, idioma) {
    debug('search->getEstados')

    const queryString = `
    SELECT
      e.estado_id,
      e.pais_id,
      et.idioma_id,
      et.nombre
    FROM estado AS e
    JOIN estado_translate AS et
    ON et.estado_id = e.estado_id
    JOIN pais_translate as pt
    ON e.pais_id = pt.pais_id
    WHERE e.pais_id = ${pais_id}
    ${idioma ? `
     AND et.idioma_id = ${idioma}
    AND pt.idioma_id = ${idioma}
    ` : ''}
    ORDER BY et.nombre
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }
}
const inst = new CountriesClassService()
Object.freeze(inst)

module.exports = inst
