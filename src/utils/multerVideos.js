'use strict'

const boom = require('boom')
const multer = require('multer')
const { maxSizes: { videos } } = require('../config')

const MAX_FILE = videos * 1024 * 1024

const init = () => {
  const storage = multer.memoryStorage({
    destination: (_req, _file, cb) => {
      cb(null, '')
    }
  })

  return multer({
    storage,
    fileFilter: (_req, file, cb) => {
      const { mimetype } = file
      const [type] = mimetype.split('/')
      if (type !== 'video') {
        return cb(boom.badRequest('Only images are allowed'))
      } else {
        cb(null, true)
      }
    },
    limits: {
      fileSize: MAX_FILE
    }
  })
}

const multerVideos = (source) => {
  return init().single(source)
}

module.exports = multerVideos
