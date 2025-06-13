const xml = require('xml')
const { web: { url, apiURL }, server: { nodeEnv } } = require('../../config')
const sitemapServ = require('../../services/sitemap')
const moment = require('moment')

exports.generateSubXML = async (req, res, next) => {
  try {
    let xmlObj = xml({ foo: [{ bar: 'desarrollo' }] })

    if (nodeEnv === 'production') {
      const result = await sitemapServ.getAllProducts()

      const xmlProducts = result.reduce((acc, curr, i) => {
        acc.push({
          url: [
            { loc: url + '/busqueda/producto/' + curr.prod_id },
            { lastmod: moment(curr.prod_updated_at).toISOString() },
            { changefreq: 'daily' },
            {
              'image:image': [
                { 'image:loc': curr.prod_foto },
                { 'image:title': { _cdata: curr.prod_nombre } },
                { 'image:caption': { _cdata: curr.prod_desc } }
              ]
            }
          ]
        })
        return acc
      }, [])

      xmlObj = xml({
        urlset: [{ _attr: { xmlns: 'http://www.sitemaps.org/schemas/sitemap/0.9', 'xmlns:image': 'http://www.google.com/schemas/sitemap-image/1.1' } },
          {
            url: [
              { loc: url + '/' }, { changefreq: 'daily' }
            ]
          },
          ...xmlProducts
        ]
      })
    }

    res.set('Content-Type', 'text/xml')

    return res.send(xmlObj)
  } catch (error) {
    next(error)
  }
}

exports.generateXML = async (req, res, next) => {
  try {
    const xmlObj = xml({
      sitemapindex: [{ _attr: { xmlns: 'http://www.sitemaps.org/schemas/sitemap/0.9' } },
        {
          sitemap: [
            { loc: apiURL + '/sitemap/sub' }
          ]
        }

      ]
    })

    res.set('Content-Type', 'text/xml')

    return res.send(xmlObj)
  } catch (error) {
    next(error)
  }
}
