'use strict'

// Como puedes ver hay varios archivos sobre multer, este es el más general
// pero no varian mucho, puedes revisar cada uno para ver sus diferencias

const path = require('path')
const multer = require('multer')
const { maxSizes } = require('../config')

const MaxSize = maxSizes.images * 1024 * 1024

const init = () => {
  const storage = multer.memoryStorage({
    destination: (_req, _file, cb) => {
      cb(null, '')
    }
  })

  return multer({
    storage,
    fileFilter: (_req, file, callback) => {
      const ext = path.extname(file.originalname)
      if (ext !== '.jpeg' && ext !== '.png' && ext !== '.jpg') {
        return callback(new Error('Only images are allowed'))
      }
      callback(null, true)
    },
    limits: {
      fileSize: MaxSize
    }
  })
}

const multerGuardar = (filename) => {
  return init().single(filename)
}

module.exports = multerGuardar
