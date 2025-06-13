'use strict'

const debug = require('debug')('old-api:turns-service')
const mysqlLib = require('../lib/db')

class TurnsService {
  constructor () {
    if (TurnsService.instance == null) {
      this.table = 'turnos'
      this.companyChatTable = 'chat_empresa_turnos'
      TurnsService.instance = this
    }
    return TurnsService.instance
  }

  async getTurns (company) {
    debug('turns->getTurns')
    const queryString = `
      SELECT *
      FROM ${this.table}
      WHERE empresa_id = ${company}
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async createTurns (company) {
    debug('turns->createTurns')
    const queryString = `
      INSERT INTO ${this.table}
      (empresa_id)
      VALUES
      (${company})
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async editTurns (company, turn) {
    debug('turns->editTurns')
    const queryString = `
      UPDATE ${this.table}
      SET turno = ${turn}
      WHERE empresa_id = ${company}
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getCompanyChatTurns (company) {
    debug('turns->getCompanyChatTurns')
    const queryString = `
      SELECT *
      FROM ${this.companyChatTable}
      WHERE empresa_id = ${company}
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async createCompanyChatTurns (company) {
    debug('turns->createCompanyChatTurns')
    const queryString = `
      INSERT INTO ${this.companyChatTable}
      (empresa_id)
      VALUES
      (${company})
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async editCompanyChatTurns (company, turn) {
    debug('turns->editCompanyChatTurns')
    const queryString = `
      UPDATE ${this.companyChatTable}
      SET turno = ${turn}
      WHERE empresa_id = ${company}
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }
}

const inst = new TurnsService()
Object.freeze(inst)

module.exports = inst
