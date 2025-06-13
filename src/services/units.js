'use strict'
const debug = require('debug')('old-api:units-service')
const mysqlLib = require('../lib/db')

class UnitsService {
  constructor () {
    if (UnitsService.instance == null) {
      this.table = 'cat_unidad'
      UnitsService.instance = this
    }
    return UnitsService.instance
  }

  async getUnits () {
    debug('units->getUnits')

    const queryString = `
      SELECT
        cuni_id AS "unit_id",
        cuni_desc_esp AS "description_spa",
        cuni_desc_ing AS "description_eng"
      FROM ${this.table}
      ORDER BY description_spa ASC
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getUnitByID (id) {
    debug('units->getUnitByID')

    const queryString = `
      SELECT
        cuni_id AS "unit_id",
        cuni_desc_esp AS "description_spa",
        cuni_desc_ing AS "description_eng"
      FROM ${this.table}
      WHERE cuni_id = ${id}
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }
}

const inst = new UnitsService()
Object.freeze(inst)

module.exports = inst
