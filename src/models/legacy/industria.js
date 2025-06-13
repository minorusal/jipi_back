'use strict'
const mysqlLib = require('../../lib/db')

async function getIndustrias (d) {
  if (d.idioma == 1) {
    return await mysqlLib.mysqlQuery('GET',
      'select * from cat_industria where cind_status = 1'
      , d)
  } else {
    return await mysqlLib.mysqlQuery('GET',
      'select * from cat_industria where cind_status = 1'
      , d)
  }
}

module.exports = {
  getIndustrias
}
