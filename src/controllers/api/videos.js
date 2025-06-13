'use strict'

const debug = require('debug')('old-api:videos-controller')
const boom = require('boom')
const videosService = require('../../services/videos')

const registerConvertedVideo = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { region, destBucket, videoConvertedFile } = req.body
    if (!region || !destBucket || !videoConvertedFile) return next(boom.badRequest('Bad request. Some parameters are missing. Check your request.'))
    const result = await videosService.insertConvertedVideo({ region, destBucket, videoConvertedFile })

    if (result.error) return next(boom.badRequest(result.msg))

    return res.json({
      error: false,
      results: result.msg
    })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  registerConvertedVideo
}
