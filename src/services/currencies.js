'use strict'
const debug = require('debug')('old-api:currencies-service')
const mysqlLib = require('../lib/db')

class CurrenciesService {
  constructor () {
    if (CurrenciesService.instance == null) {
      this.table = 'cat_moneda'
      CurrenciesService.instance = this
    }
    return CurrenciesService.instance
  }

  async getCurrencies () {
    debug('currencies->getCurrencies')
    const queryString = `
      SELECT
        cmon_id AS "currency_id",
        cmon_desc_esp AS "description_spa",
        cmon_desc_ing AS "description_eng"
      FROM ${this.table}
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getCurrencyByID (id) {
    debug('currencies->getCurrencyByID')
    const queryString = `
      SELECT
        cmon_id AS "currency_id",
        cmon_desc_esp AS "description_spa",
        cmon_desc_ing AS "description_eng"
      FROM ${this.table}
      WHERE cmon_id = ${id}
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }
}

const inst = new CurrenciesService()
Object.freeze(inst)

module.exports = inst
