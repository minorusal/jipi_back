'use strict'
const debug = require('debug')('old-api:addresses-service')
const mysqlLib = require('../lib/db')

class AddressesService {
  constructor () {
    if (AddressesService.instance == null) {
      this.table = 'domicilio'
      AddressesService.instance = this
    }
    return AddressesService.instance
  }

  async getAdressById (address) {
    debug('addresses->getAdressById')

    const queryString = `
      SELECT
        *
      FROM ${this.table}
      WHERE domicilio_id = ${address}
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }
}

const inst = new AddressesService()
Object.freeze(inst)

module.exports = inst
