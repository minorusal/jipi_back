'use strict'

// Un validator de archivos
// esto porque antes de usar AWS se guardaban los archivos en disco,
// Esto validaba el formato de archivo, el siguiente middleware del endpoint
// validaba el schema, si ambas validaciones pasaban ahora sí se guardaba el
// archivo. Algo raro pero en su momento fue lo mejor

const boom = require('boom')
const multer = require('multer')
const { maxSizes } = require('../../config')

const init = (limited) => {
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
    },
    limits: limited ? { fileSize: maxSizes.images * 1024 * 1024 } : null
  })
}

const validFiles = (limited = true, fields = ['images']) => {
  const newFields = {}
  for (let i = 0; i < fields.length; i++) {
    newFields.name = fields[i]
  }
  return init(limited).fields([newFields])
}

module.exports = validFiles
