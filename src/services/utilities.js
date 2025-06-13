'use strict'

const mysqlLib = require('../lib/db')

class UtilitiesService {
  constructor() {
    if (UtilitiesService.instance == null) {
      this.table = 'parametros'
      UtilitiesService.instance = this
    }
    return UtilitiesService.instance
  }

  async getParametros() {
    const queryString = `
    SELECT *
    FROM parametros;
`
    const { result } = await mysqlLib.query(queryString);
    return result
  }
}

const inst = new UtilitiesService()
Object.freeze(inst)

module.exports = inst
