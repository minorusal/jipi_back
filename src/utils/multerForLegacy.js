'use strict'

const multer = require('multer')
const boom = require('boom')

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
      if (type !== 'image') {
        return cb(boom.badRequest('Only images are allowed'))
      } else {
        cb(null, true)
      }
    }
  })
}

const multerSupport = (source) => {
  return init().single(source)
}

module.exports = multerSupport
