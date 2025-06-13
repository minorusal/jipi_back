'use strict'
const debug = require('debug')('old-api:companies-service')
const mysqlLib = require('../lib/db')

class InvitationsService {
  constructor () {
    if (InvitationsService.instance == null) {
      this.table = 'empresa'
      InvitationsService.instance = this
    }
    return InvitationsService.instance
  }

  async searchInvitation (email) {
    debug('invitations->searchInvitation')

    const queryString = `
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }
}

const inst = new InvitationsService()
Object.freeze(inst)

module.exports = inst
