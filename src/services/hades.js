'use strict'

const axios = require('axios')
const debug = require('debug')('old-api:hades-service')
const mysqlLib = require('../lib/db')
const CronosError = require('../utils/errors/cronos')
const { hadesToCronosSecretKey, cronosURL } = require('../config')
const cronosTypes = { certification: 'Certification', report: 'Report' }
Object.freeze(cronosTypes)

class HadesService {
  constructor () {
    if (HadesService.instance == null) {
      this.certificationTable = 'certificaciones'
      this.companyTable = 'empresa'
      this.creditReportTable = 'reporte_credito_solicitud'
      this.cronosHeaders = { headers: { APIKey: hadesToCronosSecretKey } }
      HadesService.instance = this
    }
    return HadesService.instance
  }

  async sendDataToCronos (type, dataToSend) {
    debug('certification->sendDataToCronos')
    try {
      let url = null
      if (type === cronosTypes.certification) {
        url = cronosURL.certification
      } else if (type === cronosTypes.report) {
        url = cronosURL.report
      }
      const { data } = await axios.post(url, dataToSend, this.cronosHeaders)
      return data
    } catch (err) {
      const { response: { data: { error: errors }, request: { res: { statusCode } } } } = err
      const [error] = errors
      throw new CronosError(error, statusCode)
    }
  }

  async sendDataToCronosTest (url, dataToSend) {
    debug('certification->sendDataToCronosTest')
    try {
      const { data } = await axios.post(url, dataToSend, this.cronosHeaders)
      return data
    } catch (err) {
      const { response: { data: { error: errors }, request: { res: { statusCode } } } } = err
      const [error] = errors
      throw new CronosError(error, statusCode)
    }
  }

  async doesCertificationExists (certificationID) {
    debug('certification->doesCertificationExists')
    const query = `
      SELECT certificacion_id, empresa_id AS "companyID" FROM ${this.certificationTable} WHERE certificacion_id = ${certificationID} LIMIT 1
    `
    const { result: resultRaw } = await mysqlLib.query(query)
    const [result] = resultRaw
    return result
  }

  async certificateCompany (companyID) {
    debug('certification->certificateCompany')
    const query = `
      UPDATE ${this.companyTable}
      SET emp_certificada = 1
      WHERE emp_id = ${companyID}
    `
    const { result: { affectedRows } } = await mysqlLib.query(query)
    return Boolean(affectedRows)
  }

  async getCreditReportByID (creditReportID) {
    debug('quoteService -> getCreditReportByID')
    const queryString = `
      SELECT * FROM ${this.creditReportTable}
      WHERE reporte_id = ${creditReportID}
    `
    const { result: resultRaw } = await mysqlLib.query(queryString)
    const [result] = resultRaw
    if (result) return result
    return null
  }

  async postCreditReport (creditReportID, url) {
    debug('quoteService -> postCreditReport')
    const queryString = `
      UPDATE ${this.creditReportTable}
      SET
      url = '${url}'
      WHERE reporte_id = ${creditReportID}
    `
    const { result: { affectedRows } } = await mysqlLib.query(queryString)
    return Boolean(affectedRows)
  }
}

const inst = new HadesService()
Object.freeze(inst)

module.exports = inst
