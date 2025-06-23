'use strict'
const debug = require('debug')('old-api:companies-service')
const mysqlLib = require('../lib/db')

class KoneshService {
  constructor() {
    if (KoneshService.instance == null) {
      this.table = 'empresa'
      KoneshService.instance = this
    }
    return KoneshService.instance
  }

  async getEmpresas() {
    debug('companies->getEmpresas')

    const queryString = `
    SELECT
      e.emp_rfc
    FROM empresa AS e;
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getEstatusKonesh(tax_id) {
    const queryString = `
    SELECT
      e.emp_id,
      e.konesh_valid,
      e.contador_konesh,
      rv.tax_id,
      rv.name,
      rv.postal_code,
      rv.transaction_id,
      rv.transaction_date,
      rv.node,
      CONCAT(e.emp_razon_social, ' ', COALESCE(d.denominacion, '')) AS empresa_nombre
    FROM empresa AS e
    LEFT JOIN rfc_validations AS rv ON rv.tax_id = e.emp_rfc
    LEFT JOIN cat_denominacion AS d ON d.id = e.denominacion
    WHERE rv.tax_id = '${tax_id}'
    GROUP BY tax_id;
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async updateFlagKonesh(flag, tax_id) {
    const queryString = `update empresa set konesh_valid = '${flag}' where emp_rfc = '${tax_id}'`
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async saveKonesh({
    transactionResponse01,
    transactionResponse02,
    transactionResponse03,
    transactionResponse04
  }) {
    try {
      // Desestructuración directa de los datos desde transactionResponse01
      const {
        data01,
        data02,
        data03,
        data04,
        data05
      } = transactionResponse01?.[0] || {}; // Asegurarse que transactionResponse01 exista

      // Query de inserción usando los valores de las propiedades
      const queryString = `INSERT INTO rfc_validations (       
        tax_id,
        status,
        error_message,
        name,
        postal_code,
        transaction_id,
        transaction_date,
        node
      ) 
      VALUES (
        '${data01}',
        '${data02}',
        '${data03}',
        '${data04}',
        '${data05}',
        '${transactionResponse02}',
        '${transactionResponse03}',
        '${transactionResponse04}'
      )`;

      // Ejecución de la consulta
      const { result } = await mysqlLib.query(queryString);

      return result; // Devolvemos el resultado de la consulta
    } catch (error) {
      return { error: error.message }; // Devuelve el error con un mensaje
    }
  }

  async saveKoneshResponse({
    emp_id = null,
    rfc,
    razon_social_req = null,
    request_ts,
    response_time_ms,
    http_status,
    konesh_status = null,
    error_message = null,
    name_sat = null,
    postal_code = null,
    transaction_id = null,
    transaction_date = null,
    node = null,
    raw_response = null
  }) {
    const queryString = `INSERT INTO konesh_responses (
        emp_id,
        rfc,
        razon_social_req,
        request_ts,
        response_time_ms,
        http_status,
        konesh_status,
        error_message,
        name_sat,
        postal_code,
        transaction_id,
        transaction_date,
        node,
        raw_response
      ) VALUES (
        ${emp_id || 'NULL'},
        ${mysqlLib.escape(rfc)},
        ${razon_social_req ? mysqlLib.escape(razon_social_req) : 'NULL'},
        '${request_ts}',
        ${response_time_ms},
        ${http_status},
        ${konesh_status ? mysqlLib.escape(konesh_status) : 'NULL'},
        ${error_message ? mysqlLib.escape(error_message) : 'NULL'},
        ${name_sat ? mysqlLib.escape(name_sat) : 'NULL'},
        ${postal_code ? mysqlLib.escape(postal_code) : 'NULL'},
        ${transaction_id ? mysqlLib.escape(transaction_id) : 'NULL'},
        ${transaction_date ? mysqlLib.escape(transaction_date) : 'NULL'},
        ${node ? mysqlLib.escape(node) : 'NULL'},
        ${raw_response ? mysqlLib.escape(JSON.stringify(raw_response)) : 'NULL'}
      )`;
    const { result } = await mysqlLib.query(queryString);
    return result;
  }

  async obtenerBanderaIntentos(id_empresa) {
    const queryString = `
    SELECT
      contador_konesh
    FROM empresa
    WHERE emp_id = ${id_empresa};
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async obtenerBanderaIntentosRazonSocial(id_empresa) {
    const queryString = `
    SELECT
      contador_konesh_razon_social_no_igual 
    FROM empresa
    WHERE emp_id = ${id_empresa};
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async updateContadorKoneshEstructuraRfc(times, id_empresa) {
    const queryString = `UPDATE
      empresa
    SET contador_konesh = ${times}
    WHERE emp_id = ${id_empresa}`
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async updateContadorKoneshRazonSocialNoIgual(times, id_empresa) {
    const queryString = `UPDATE
      empresa
    SET contador_konesh_razon_social_no_igual = ${times}
    WHERE emp_id = ${id_empresa}`
    const { result } = await mysqlLib.query(queryString)
    return result
  }

}

module.exports = Object.freeze(new KoneshService())
