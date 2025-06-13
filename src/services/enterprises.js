'use strict'
const debug = require('debug')('old-api:enterprise-service')
const mysqlLib = require('../lib/db')

class EnterpriseService {
  constructor () {
    if (EnterpriseService.instance == null) {
      this.table = 'empresa'
      EnterpriseService.instance = this
    }
    return EnterpriseService.instance
  }

  async getAllDataById (empresa) {
    const queryString = `
      SELECT
      e.emp_id AS "empresa_id",
      e.emp_nombre AS "nombre"
      FROM ${this.table} AS e
      WHERE
        e.emp_id = ${empresa}
      LIMIT 1;
    `

    debug(queryString)

    const { result } = await mysqlLib.query(queryString)

    return result
  }
}

const inst = new EnterpriseService()
Object.freeze(inst)

module.exports = inst
