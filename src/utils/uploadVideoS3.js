'use strict'

const path = require('path')
const uuid = require('uuid-base62')
const debug = require('debug')('old-api:uloadImageS3')
const { aws: { s3: { nameVideos: Bucket } } } = require('../config')
const { setupS3 } = require('../lib/aws')
const s3 = setupS3()
const crypto = require('crypto')
const utilitiesService = require('../services/utilities')

let globalConfig = {}

const loadGlobalConfig = async () => {
  try {
    globalConfig = await utilitiesService.getParametros()
  } catch (error) {
    console.error('Error al cargar la configuración global:', error)
    throw new Error('Error al cargar la configuración global')
  }
}

loadGlobalConfig()

const uploadVideo = file => {
  return new Promise((resolve, reject) => {
    const { originalname, buffer: Body } = file
    debug(originalname)
    const ext = path.extname(originalname)
    const Key = `${uuid.v4()}${uuid.v4()}${ext}`
    const s3Config = {
      Bucket,
      Key,
      Body
    }
    s3.upload(s3Config, (error, data) => {
      if (error) {
        reject(error)
      }
      const { Location } = data
      debug(Location)
      resolve(Location)
    })
  })
}

const calculateMD5 = buffer => {
  const hash = crypto.createHash('md5');
  hash.update(buffer);
  return hash.digest('base64');
};

const uploadVideo2 = async (file, pathBucket) => {
  let buffer
  let extension
  let originalname

  try {
    if (typeof file === 'string') {
      extension = file.split(';')[0].split('/')[1]

      if (extension != 'mp4') throw new Error('Formato invalido')
      
      buffer = Buffer.from(file.split(',')[1], 'base64')
    } else {
      originalname = file.originalname
      buffer = file.buffer
    }

    const MAX_SIZE = await globalConfig.find(item => item.nombre === 'max_size_video_publicacion').valor
    if (buffer.length > MAX_SIZE) {
      throw new Error('El tamaño del video excede el límite permitido')
    }
    const ext = path.extname(originalname);
    const Key = `${pathBucket}/${uuid.v4()}${uuid.v4()}.${ext}`

    const s3Config = {
      Bucket,
      Key,
      Body: buffer
    };

    const data = await new Promise((resolve, reject) => {
      s3.upload(s3Config, (error, data) => {
        if (error) {
          reject(error);
        } else {
          resolve(data);
        }
      });
    });
    const { Location } = data
    return Location
  } catch (error) {
    throw error
  }
}



module.exports = { uploadVideo, uploadVideo2}
