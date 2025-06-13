const debug = require('debug')('old-api:metadata-controller')
const boom = require('boom')
const metascraper = require('metascraper')([
  require('metascraper-author')(),
  require('metascraper-date')(),
  require('metascraper-description')(),
  require('metascraper-image')(),
  // require('metascraper-logo')()
  require('metascraper-clearbit')(),
  require('metascraper-publisher')(),
  require('metascraper-title')(),
  require('metascraper-url')()
  // require('metascraper-youtube')()
  // require('metascraper-video')()
  // require('metascraper-spotify')(),
  // require('metascraper-telegram')(),
  // require('metascraper-soundcloud')(),
  // require('metascraper-readability')(),
  // require('metascraper-media-provider')()
  // require('metascraper-logo-favicon')()
])
const got = require('got')
const getImageSize = require('probe-image-size')

const decodeSafeUrl = (value) => {
  const valueBase64 = decodeURI(value)
  return Buffer.from(valueBase64, 'base64').toString('utf8')
}

const getMetaData = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { url: urlBase64 } = req.query

    if (!urlBase64) return next(boom.badRequest('No url provided.'))

    const urlDecoded = decodeSafeUrl(urlBase64)

    const { body: html, url } = await got(urlDecoded)

    debug(`Decoded url: ${urlDecoded}`)

    const metadata = await metascraper({ html, url })
    const { width: imageWidth } = await getImageSize(metadata.image)
    if (imageWidth < 128) metadata.image = metadata.logo

    return res.json({
      error: false,
      results: metadata
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  getMetaData
}
