'use strict'
const debug = require('debug')('old-api:information-service')
const mysqlLib = require('../lib/db')

class InformationService {
  constructor () {
    if (InformationService.instance == null) InformationService.instance = this
    return InformationService.instance
  }

  async searchProducts (text) {
    debug('certification->searchProducts')
    const queryString = `
    SELECT
      p.prod_id,
      pt.prod_nombre,
      e.emp_nombre,
      e.emp_id,
      u.usu_nombre,
      u.usu_app,
      u.usu_email
    FROM producto AS p
    LEFT JOIN producto_translate AS pt ON p.prod_id = pt.prod_id
    LEFT JOIN cat_unidad AS cu ON p.cuni_id = cu.cuni_id
    LEFT JOIN cat_moneda AS cm ON p.cmon_id = cm.cmon_id
    LEFT JOIN empresa AS e ON p.emp_id = e.emp_id
    JOIN empresa_usuario AS eu ON eu.emp_id = e.emp_id
    JOIN usuario AS u ON u.usu_id = eu.usu_id
    WHERE
      p.prod_status = 1 
      AND (
        (replace(replace(pt.prod_nombre,'z','s'),'h','') LIKE replace(replace('%${text}%','z','s'),'h',''))
      )
      AND pt.idioma_id = 1
      AND eu.tipo = 1
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }
}

const inst = new InformationService()
Object.freeze(inst)

module.exports = inst
