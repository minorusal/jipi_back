'use strict'

// Otro multer, ahora de publicaciones
// Este multer acepta imagen y video, checa el formato de cada archivo

const boom = require('boom')
const multer = require('multer')

const MAX_FILE = 100

const init = () => {
  const storage = multer.memoryStorage({
    destination: (_req, _file, cb) => {
      cb(null, '')
    }
  })

  return multer({
    storage,
    fileFilter: (_req, file, cb) => {
      const { mimetype, fieldname } = file
      const [type] = mimetype.split('/')
      if (fieldname === 'imagen' && type !== 'image') {
        return cb(boom.badRequest('Only images are allowed'))
      }
      if (fieldname === 'video' && type !== 'video') {
        return cb(boom.badRequest('Only videos are allowed'))
      } else {
        cb(null, true)
      }
    },
    limits: {
      fileSize: MAX_FILE * 1024 * 1024
    }
  })
}

const multerPublication = () => {
  return init().fields([
    { name: 'imagen', maxCount: 1 },
    { name: 'video', maxCount: 1 }
  ])
}

module.exports = multerPublication
