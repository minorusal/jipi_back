'use strict'

const boom = require('boom')
const multer = require('multer')
const { maxSizes: { images: maxSize } } = require('../config')

const MAX_FILE = maxSize * 1024 * 1024

const init = (schema) => {
  const storage = multer.memoryStorage({
    destination: (_req, _file, cb) => {
      cb(null, '')
    }
  })

  return multer({
    storage,
    fileFilter: (req, file, cb) => {
      // Validate schema
      let { body: { data } } = req
      data = JSON.parse(data)

      const { error } = schema.validate(data)
      if (error) {
        return cb(boom.badRequest(error))
      }

      req.body = data

      const { mimetype } = file
      const [type] = mimetype.split('/')
      if (type !== 'image') {
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

const multerSupport = (source, schema) => {
  return init(schema).single(source)
}

module.exports = multerSupport
