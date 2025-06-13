'use strict'
const debug = require('debug')('old-api:credit-report-service')
const mysqlLib = require('../lib/db')

class CreditReportService {
  constructor () {
    if (CreditReportService.instance == null) {
      this.creditReportTable = 'reporte_credito_solicitud'
      this.pricesTable = 'precios_plataforma'
      CreditReportService.instance = this
    }
    return CreditReportService.instance
  }

  async getCompaniesByQuoteId (quoteID, buyer, seller) {
    debug('CreditReportService -> getCompaniesByQuoteId')
    const queryString = `
      SELECT
        emp_id_vendedor AS "seller",
        emp_id_comprador AS "buyer"
      FROM cotizacion
      WHERE cot_id = ${quoteID}
      AND (
        (emp_id_vendedor = ${buyer}
        AND
        emp_id_comprador = ${seller})
        OR
        (emp_id_vendedor = ${seller}
        AND
        emp_id_comprador = ${buyer})
      )
    `
    const { result: resultRaw } = await mysqlLib.query(queryString)
    if (resultRaw) {
      const [result] = resultRaw
      return result
    }
    return null
  }

  async createReport (quoteID, origin, destiny) {
    debug('quoteService -> createReport')
    const queryString = `
      INSERT INTO reporte_credito_solicitud
      (cot_id, empresa_solicitante, empresa_destino)
      VALUES
      (${quoteID}, ${origin}, ${destiny})

    `
    const { result: { insertId } } = await mysqlLib.query(queryString)
    return insertId
  }

  async getReportSolicitude (quoteID, origin, destiny) {
    debug('quoteService -> getReportSolicitude')
    const queryString = `
      SELECT
        reporte_id,
        estatus,
        url,
        fecha_creacion,
        fecha_actualizacion
      FROM reporte_credito_solicitud
      WHERE cot_id = ${quoteID}
      AND empresa_solicitante = ${origin}
      AND empresa_destino = ${destiny}
    `
    const { result: resultRaw } = await mysqlLib.query(queryString)
    const [result] = resultRaw
    if (result) return result
    return null
  }

  async editReportSolicitude (reportID, estatus, destiny) {
    debug('quoteService -> editReporSolicitude')
    const queryString = `
      UPDATE reporte_credito_solicitud
      SET
        estatus = '${estatus}'
      WHERE reporte_id = ${reportID}
      AND empresa_destino = ${destiny}
    `
    const { result } = await mysqlLib.query(queryString)
    const { affectedRows } = result
    return Boolean(affectedRows)
  }

  async getReportSolicitudeByIdAndDestiny (reportID, destiny) {
    debug('quoteService -> getReportSolicitudeByIdAndDestiny')
    const queryString = `
      SELECT * FROM reporte_credito_solicitud
      WHERE reporte_id = ${reportID} AND empresa_destino = ${destiny}
    `
    const { result: resultRaw } = await mysqlLib.query(queryString)
    const [result] = resultRaw
    if (result) return result
    return null
  }

  async getCreditReport (reportID, petitioner, destiny) {
    debug('quoteService -> getCreditReport')
    const queryString = `
      SELECT * FROM reporte_credito_solicitud
      WHERE reporte_id = ${reportID}
      AND empresa_solicitante = ${petitioner}
      AND empresa_destino = ${destiny}
      AND estatus = 'Aceptado'
    `
    const { result: resultRaw } = await mysqlLib.query(queryString)
    const [result] = resultRaw
    if (result) return result
    return null
  }

  async payForCreditReport (quote, petitioner, destiny, payment) {
    debug('credit report ->payForCreditReport')
    const queryString = `
      INSERT INTO ${this.creditReportTable}
      (cot_id, empresa_solicitante, empresa_destino, estatus, pago_id)
      VALUES
      (${quote}, ${petitioner}, ${destiny}, 'Investigando', '${payment}')
    `
    const { result: { insertId } } = await mysqlLib.query(queryString)
    return insertId
  }

  async getCreditReportPrice () {
    debug('certification->getCertificationPrice')
    const queryString = `
      SELECT * FROM ${this.pricesTable}
      WHERE concepto = 'CreditReport'
    `
    const { result: raw } = await mysqlLib.query(queryString)
    const [result] = raw
    return result
  }

  async getUserDetails (companyID) {
    debug('certification->getUserDetails')
    const queryCompanyAndUserDetails = `
      select
      CONCAT(u.usu_nombre, u.usu_app) AS "contactName",
      u.usu_email AS "mail",
      e.emp_nombre AS "name", e.emp_rfc AS "rfc"
      from empresa_usuario as eu
      join empresa as e using(emp_id)
      join usuario as u using(usu_id)
      where emp_id = ${companyID}
      and eu.tipo = 1
    `
    const { result: companyAndUserDetailsRaw } = await mysqlLib.query(queryCompanyAndUserDetails)
    const [companyAndUserDetails] = companyAndUserDetailsRaw

    const queryAddress = `
      select
      d.direccion, d.domicilio_id,
      p.nombre as 'pais'
      from domicilio as d
      join estado as e using(estado_id)
      join pais_translate as p using(pais_id)
      WHERE p.idioma_id = 1 AND d.emp_id = ${companyID} AND d.domicilio_tipo = 1
    `
    const { result: resultAddressRaw } = await mysqlLib.query(queryAddress)
    const [resultAddress] = resultAddressRaw
    if (!resultAddress) return null
    const { domicilio_id: domicilioID } = resultAddress

    const queryPhone = `
      select numero from telefono
      where domicilio_id = ${domicilioID} limit 1
    `
    const { result: resultPhoneRaw } = await mysqlLib.query(queryPhone)
    const [resultPhone] = resultPhoneRaw
    let numero = null
    if (resultPhone) {
      numero = resultPhone.numero
    }

    const basica = {
      ...companyAndUserDetails,
      address: resultAddress.direccion,
      country: resultAddress.pais,
      phone: numero
    }
    return basica
  }

  async getPaymentType() {
    const queryString = `
      SELECT
      cmetodo_id as id,
      cmetodo_desc_esp as descripcion
      FROM cat_metodo_pago
      WHERE cmetodo_status = 1
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }
}

const inst = new CreditReportService()
Object.freeze(inst)

module.exports = inst
