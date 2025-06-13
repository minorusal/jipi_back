'use strict'

// Para poder subir las imágenes al bucket S3, esto implementa
// la compresión de imágenes antes de subirlas
// que es la principal diferencia entre este y el subir videos, además del
// bucket al que van a subir, que viene de config

const path = require('path')
const uuid = require('uuid-base62')
const debug = require('debug')('old-api:uloadImageS3')
const { aws: { s3: { name: Bucket } } } = require('../config')
const { setupS3 } = require('../lib/aws')
const s3 = setupS3()
const compress = require('./compressImage')
const logger = require('../../src/utils/logs/logger')
const crypto = require('crypto');

const calculateMD5 = (data) => {
  return crypto.createHash('md5').update(data).digest('base64');
};

// const uploadImage = (file, pathBucket) => {
//   return new Promise((resolve, reject) => {
//     const { originalname, buffer } = file
//     debug(originalname)
//     logger.info(`Se obtiene el nombre original: ${originalname}`);
//     const ext = path.extname(originalname)
//     logger.info(`Se obtiene la extension: ${ext}`);
//     const Key = `${pathBucket}/${uuid.v4()}${uuid.v4()}${ext}`
//     logger.info(`Se setea el nombre para AWS: ${ext}`);
//     // compress(buffer).then(Body => {
//     //   const s3Config = {
//     //     Bucket,
//     //     Key,
//     //     Body
//     //   }

//     //   logger.info(`Se obtiene la configuracion de bukcet: ${JSON.stringify(s3Config)}`);
//     //   s3.upload(s3Config, (error, data) => {
//     //     if (error) {
//     //       logger.error(`Se obtuvo el siguiente error al intentar realizar el pload: ${JSON.stringify(error)}`);
//     //       reject(error)
//     //     }
//     //     const { Location } = data
//     //     logger.info(`El archivo se subio con exito en: ${JSON.stringify(Location)}`);
//     //     debug(Location)
//     //     resolve(Location)
//     //   })
//     // })


//     const ContentMD5 = calculateMD5(buffer);

//     const s3Config = {
//       Bucket,
//       Key,
//       Body: buffer,
//       ContentMD5  // Proporcionar el Content-MD5 en la configuración
//     };
//     logger.info(`Se obtiene la configuracion de bukcet: ${JSON.stringify(s3Config)}`);
//       s3.upload(s3Config, (error, data) => {
//         if (error) {
//           logger.error(`Se obtuvo el siguiente error al intentar realizar el pload: ${JSON.stringify(error)}`);
//           reject(error)
//         }
//         const { Location } = data
//         logger.info(`El archivo se subio con exito en: ${JSON.stringify(Location)}`);
//         debug(Location)
//         resolve(Location)
//       }).catch(error => {
//       logger.error(`Se obtuvo el siguiente error al intentar general al realizar el pload: ${JSON.stringify(error)}`);
//       reject(error)
//     })
//   })
// }

const uploadImage = (file, pathBucket) => {
  return new Promise((resolve, reject) => {
    // const { originalname, buffer } = file;
    let buffer;
    let originalname;

    if (typeof file === 'string') {
      // Decodificar la cadena base64 a un buffer
      buffer = Buffer.from(file, 'base64');
      // La extensión del archivo no se conoce, puedes definirla manualmente o dejarla vacía
      originalname = 'archivo.pdf'; // Cambia 'archivo.pdf' por el nombre que desees
    } else {
      // Si `file` no es una cadena, se espera que sea un objeto con `originalname` y `buffer`
      originalname = file.originalname;
      buffer = file.buffer;
    }

    const ext = path.extname(originalname);
    const Key = `${pathBucket}/${uuid.v4()}${uuid.v4()}${ext}`;

    const ContentMD5 = calculateMD5(buffer);

    const s3Config = {
      Bucket,
      Key,
      Body: buffer,
      ContentMD5
    };

    logger.info(`Se obtiene la configuracion de bucket: ${JSON.stringify(s3Config)}`);

    try {
      s3.upload(s3Config, (error, data) => {
        if (error) {
          logger.error(`Se obtuvo el siguiente error al intentar realizar el upload: ${JSON.stringify(error)}`);
          reject(error);
        } else {
          const { Location } = data;
          logger.info(`El archivo se subió con éxito en: ${JSON.stringify(Location)}`);
          debug(Location);
          resolve(Location);
        }
      });
    } catch (error) {
      logger.error(`Se obtuvo el siguiente error al intentar realizar el upload: ${JSON.stringify(error)}`);
      reject(error);
    }
  });
};

const uploadImage2 = async (file, pathBucket) => {
  let buffer;
  let originalname;
  let extension;

  try {
    if (typeof file === 'string') {
      const extensionesPermitidas = ['jpg', 'jpeg', 'png'];
      extension = file.split(';')[0].split('/')[1];

      if (!extensionesPermitidas.includes(extension)) {
        throw new Error('Formato invalido');
      }

      buffer = Buffer.from(file.split(',')[1], 'base64');

      originalname = `file.${extension}`;
    } else {
      // Si `file` no es una cadena, se espera que sea un objeto con `originalname` y `buffer`
      originalname = file.originalname ;
      buffer = file.buffer;
    }

    const ext = path.extname(originalname);
    const Key = `${pathBucket}/${uuid.v4()}${uuid.v4()}${ext}`;

    const s3Config = {
      Bucket,
      Key,
      Body: buffer
    };

    logger.info(`Se obtiene la configuracion de bucket: ${JSON.stringify(s3Config)}`);

    const data = await new Promise((resolve, reject) => {
      s3.upload(s3Config, (error, data) => {
        if (error) {
          logger.error(`Se obtuvo el siguiente error al intentar realizar el upload: ${JSON.stringify(error)}`);
          reject(error);
        } else {
          resolve(data);
        }
      });
    });

    const { Location } = data;
    logger.info(`El archivo se subió con éxito en: ${JSON.stringify(Location)}`);
    debug(Location);
    return Location;
  } catch (error) {
    throw error;
  }
};

const uploadPdf = async (file, pathBucket) => {
  let buffer;
  let originalname;
  let extension;

  try {
    if (typeof file === 'string') {
      const extensionesPermitidas = ['pdf', 'PDF', 'doc', 'DOC', 'docx', 'DOCX', 'xlsx', 'XLSX', 'ppt', 'PPT', 'pptx', 'PPTX']
      extension = file.split(';')[0].split('/')[1]

      if (!extensionesPermitidas.includes(extension)) {
        throw new Error('Formato invalido');
      }

      buffer = Buffer.from(file.split(',')[1], 'base64')

      originalname = `file.${extension}`;
    } else {
      // Si `file` no es una cadena, se espera que sea un objeto con `originalname` y `buffer`
      originalname = file.extension;
      buffer = file.buffer;
    }

    const ext = path.extname(originalname);
    const Key = `${pathBucket}/${uuid.v4()}${uuid.v4()}${ext}`

    const s3Config = {
      Bucket,
      Key,
      Body: buffer,
      ContentType: extension == 'pdf' ? 'application/pdf' : 'application/octet-stream'
    };

    logger.info(`Se obtiene la configuracion de bucket: ${JSON.stringify(s3Config)}`);

    const data = await new Promise((resolve, reject) => {
      s3.upload(s3Config, (error, data) => {
        if (error) {
          logger.error(`Se obtuvo el siguiente error al intentar realizar el upload: ${JSON.stringify(error)}`);
          reject(error);
        } else {
          resolve(data);
        }
      });
    });

    const { Location } = data;
    logger.info(`El archivo se subió con éxito en: ${JSON.stringify(Location)}`);
    debug(Location);
    return Location;
  } catch (error) {
    throw error;
  }
};

const deleteFileFromS3 = (key) => {
  return new Promise((resolve, reject) => {
    const params = {
      Bucket,
      Key: key
    };

    s3.deleteObject(params, (error, data) => {
      if (error) {
        logger.error(`Error al eliminar el archivo del bucket: ${JSON.stringify(error)}`);
        reject(error);
      } else {
        logger.info(`Archivo eliminado exitosamente del bucket: ${key}`);
        resolve(data);
      }
    });
  });
};


module.exports = { uploadImage, deleteFileFromS3, uploadImage2, uploadPdf }
