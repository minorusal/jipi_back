'use strict'
const debug = require('debug')('old-api:tokens-service')
const mysqlLib = require('../lib/db')

class TokensService {
  constructor () {
    if (TokensService.instance == null) {
      this.table = 'tokens'
      TokensService.instance = this
    }
    return TokensService.instance
  }

  async getCompaniesWithoutToken () {
    const queryString = `
    select e.emp_id, e.emp_nombre, concat(u.usu_nombre,' ',u.usu_app) as usu_nombre, u.usu_psw,u.usu_email from empresa e
    join empresa_usuario eu on e.emp_id = eu.emp_id join usuario u on eu.usu_id = u.usu_id
    where  u.usu_tipo = 3 and eu.tipo = 1
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async insertCompanyToken (token, empId) {
    const queryString = `insert into empresa_token (emp_id, emp_token) values (${Number(empId)},'${token}')`
    const { result: { affectedRows } } = await mysqlLib.query(queryString)

    return { empId, affectedRows }
  }

  async createToken (usuario, token, tipo) {
    debug('tokens->createToken')

    const queryString = `
      INSERT INTO ${this.table}
      (usuario_id, token, tipo)
      VALUES
      (${usuario}, '${token}', '${tipo}')
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getToken (user) {
    debug('tokens->getToken')

    const queryString = `
      SELECT token, tipo
      FROM tokens
      WHERE usuario_id = ${user}
      ORDER BY tipo, token ASC
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getUserByToken (token) {
    debug('tokens->getUserByToken')
    const queryString = `
      SELECT usuario_id FROM ${this.table}
      WHERE token = '${token}'
    `

    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async updateToken (usuario, token) {
    debug('tokens->updateToken')

    const queryString = `
      UPDATE ${this.table}
      SET usuario_id = ${usuario}
      WHERE token = '${token}'
    `

    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async deleteToken (token, type) {
    debug('tokens->deleteToken')
    const queryString = `
      DELETE FROM ${this.table}
      WHERE token = '${token}'
      AND tipo = '${type}'
    `
    const { result: { affectedRows } } = await mysqlLib.query(queryString)
    return Boolean(affectedRows)
  }
}

const inst = new TokensService()
Object.freeze(inst)

module.exports = inst
