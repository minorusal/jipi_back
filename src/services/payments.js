'use strict'

const debug = require('debug')('old-api:payments-service')
const mysqlLib = require('../lib/db')

class PaymentsService {
  constructor () {
    if (PaymentsService.instance == null) {
      this.table = 'usuario_tokens_pago'
      PaymentsService.instance = this
    }
    return PaymentsService.instance
  }

  async getUserPaymentTokens (user) {
    debug('payments->getUserPaymentTokens')
    const queryString = `
      SELECT token, fecha_creacion FROM ${this.table}
      WHERE usuario = ${user}
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async insertUserPaymentTokens (user, token) {
    debug('payments->insertUserPaymentTokens')
    const queryString = `
      INSERT INTO ${this.table}
      (usuario, token)
      VALUES
      (${user}, '${token}')
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getPayments (companyID) {
    debug('payments->getPayments')
    const queryString = `
      select
        p.pago_id,
        p.cargo,
        p.concepto,
        p.created_at,
        p.moneda,
        u.usu_id,
        u.usu_nombre,
        u.usu_app,
        u.usu_foto
      from pagos as p
      join usuario as u using(usu_id)
      join empresa_usuario as eu using(usu_id)
      join empresa as e using(emp_id)
      where e.emp_id = ${companyID}
      order by p.created_at desc
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async savePayment (userID, amount, concept, moneda) {
    debug('payments->savePayment')
    const queryString = `
      INSERT INTO pagos
      (usu_id, cargo, concepto, moneda)
      VALUES
      (${userID}, ${amount}, '${concept}', '${moneda}')
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getCustomerStripeID (userId) {
    debug('payments->getCustomerStripeID')
    const queryString = `
      SELECT token as customerID FROM usuario_tokens_pago WHERE usuario = ${userId} 
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }
}

const inst = new PaymentsService()
Object.freeze(inst)

module.exports = inst
