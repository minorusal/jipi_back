'use strict'
const debug = require('debug')('old-api:directory-service')
const mysqlLib = require('../lib/db')

class DirectoryClass {
  constructor () {
    if (DirectoryClass.instance == null) DirectoryClass.instance = this
    return DirectoryClass.instance
  }

  async searchDirectory (text, registered, query) {
    debug('directory->searchDirectory')

    let limitCondition = query && query.limit ? `LIMIT ${query.limit}` : ''
    limitCondition = (query && query.limit && query.page) ? `${limitCondition} OFFSET ${(parseInt(query.page) - 1) * parseInt(query.limit)}` : limitCondition

    let queryString = `
    SELECT
    CASE
         WHEN NombreSimple IS NULL OR NombreSimple=''
         THEN empresa
         ELSE NombreSimple
    END AS emp_nombre,
    tipoSociedad AS emp_sociedad,
    rfc AS emp_taxid,
    CASE
         WHEN web = ''
         THEN NULL
         ELSE web
    END AS emp_website,
    CASE
         WHEN telefono = ''
         THEN NULL
         ELSE  replace(replace(replace(telefono,'Tel. ',''),'(',''),')','')
    END AS emp_telefono,
    domicilio as emp_domicilio
    FROM cronos_directorio WHERE  (rfc IS NOT NULL OR rfc!='') AND (
          empresa LIKE '%${text}%'
          OR NombreSimple LIKE '%${text}%'
          OR rfc LIKE '%${text}%'
         )
         AND rfc NOT IN ('${registered.join('\', \'')}')
     ${limitCondition}
    `
    console.log(queryString)
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)

    queryString = `
    SELECT
          count(*) as count
    FROM cronos_directorio WHERE  (rfc IS NOT NULL OR rfc!='') AND (
          empresa LIKE '%${text}%'
          OR NombreSimple LIKE '%${text}%'
          OR rfc LIKE '%${text}%'
         )
         AND rfc NOT IN ('${registered.join('\', \'')}')
    `

    const { result: totalRaw } = await mysqlLib.query(queryString)
    const [{ count }] = totalRaw
    return { directory: result, totalDirectory: count }
  }
}

const inst = new DirectoryClass()
Object.freeze(inst)

module.exports = inst
