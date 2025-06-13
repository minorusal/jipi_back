'use strict'
const debug = require('debug')('old-api:support-service')
const mysqlLib = require('../lib/db')

class SupportService {
  constructor () {
    if (SupportService.instance == null) {
      this.suggestionTable = 'sugerencias'
      this.problemTable = 'problemas'
      SupportService.instance = this
    }
    return SupportService.instance
  }

  async createSuggestion (user, suggestion, image) {
    debug('createSuggestion')
    const queryString = `
      INSERT INTO ${this.suggestionTable}
      (usu_id, sugerencia, imagen)
      VALUES
      (${user}, '${suggestion}', ${image ? `'${image}'` : `${null}`})
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async createProblem (user, problem, image) {
    debug('createProblem')
    const queryString = `
      INSERT INTO ${this.problemTable}
      (usu_id, problema, imagen)
      VALUES
      (${user}, '${problem}', ${image ? `'${image}'` : `${null}`})
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }
}

const inst = new SupportService()
Object.freeze(inst)

module.exports = inst
