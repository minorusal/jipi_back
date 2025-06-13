'use strict'
const debug = require('debug')('old-api:sitemap-service')
const mysqlLib = require('../lib/db')

class SitemapServClass {
  constructor () {
    if (SitemapServClass.instance == null) SitemapServClass.instance = this
    return SitemapServClass.instance
  }

  async getAllProducts () {
    const queryStr = `
    select p.prod_id, p.updatedAt as prod_updated_at, pt.prod_nombre, pt.prod_desc,
    (select pf.foto_url from producto_foto pf where pf.prod_id = p.prod_id and pf.foto_num = 1) as prod_foto
    from producto p
    join producto_translate pt on p.prod_id = pt.prod_id
    where pt.idioma_id = 1 and p.prod_status = 1
    `

    const { result } = await mysqlLib.query(queryStr)
    return result
  }
}

const inst = new SitemapServClass()
Object.freeze(inst)

module.exports = inst
