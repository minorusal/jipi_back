'use strict'

const imagemin = require('imagemin')
const imageminJpegtran = require('imagemin-jpegtran')
const imageminPngquant = require('imagemin-pngquant')

const compress = async image => {
  const files = await imagemin.buffer(image, {
    destination: 'media',
    plugins: [
      imageminJpegtran({ progressive: true }),
      imageminPngquant({
        quality: [0.6, 0.8]
      })
    ]
  })
  const { buffer } = files
  return Buffer.from(buffer)
}

module.exports = compress
