'use strict'

const debug = require('debug')('old-api:multerStorage')
const path = require('path')
const multer = require('multer')
const { maxSizes: { images: maxSize } } = require('../config')

function initMulter () {
  const storage = multer.memoryStorage({
    destination: function (_req, _file, cb) {
      cb(null, '')
    }
  })

  return multer({
    storage,
    fileFilter: function (req, file, callback) {
      const ext = path.extname(file.originalname)
      debug(ext)
      if (ext !== '.jpeg' && ext !== '.png' && ext !== '.jpg') {
        return callback(new Error('Only images are allowed'))
      }
      callback(null, true)
    },
    limits: {
      fileSize: maxSize * 1024 * 1024
    }
  })
}

function multerStorage (filename) {
  return initMulter().single(filename)
}

module.exports = multerStorage
