'use strict'
const debug = require('debug')('old-api:industries-service')
const mysqlLib = require('../lib/db')

class IndustriesService {
  constructor () {
    if (IndustriesService.instance == null) {
      this.table = 'industria'
      IndustriesService.instance = this
    }
    return IndustriesService.instance
  }

  async getIndustrias (idioma) {
    debug('companies->getIndustrias')

    const queryString = `
      SELECT
        industria_id,
        nombre
      FROM industria_translate
      ${idioma ? `
      WHERE idioma_id = ${idioma}
      ` : ''}
      ORDER BY nombre
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }
}
const inst = new IndustriesService()
Object.freeze(inst)

module.exports = inst
