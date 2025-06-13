'use strict'

const debug = require('debug')('old-api:trade-name-service')
const mysqlLib = require('../lib/db')

class TradeNameService {
  constructor () {
    if (TradeNameService.instance == null) {
      this.table = 'cat_nombre_comercial'
      TradeNameService.instance = this
    }
    return TradeNameService.instance
  }

  async getTradeNames (country) {
    debug('units->getTradeNames')
    const queryString = `
      SELECT nombre_comercial_id, nombre
      FROM ${this.table}
      WHERE pais = '${country}'
      ORDER BY nombre ASC
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async deleteTradeNames (tradeId) {
    debug('units->getTradeNames')
    const queryString = `
    DELETE FROM ${this.table} 
    WHERE nombre_comercial_id = ${tradeId}
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }
}

const inst = new TradeNameService()
Object.freeze(inst)

module.exports = inst
