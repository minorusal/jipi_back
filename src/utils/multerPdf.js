'use strict';

const path = require('path');
const multer = require('multer');
const { maxSizes } = require('../config');

const MaxSize = maxSizes.pdf * 1024 * 1024; // Tamaño máximo del archivo PDF en MB

const init = () => {
  const storage = multer.memoryStorage({
    destination: (_req, _file, cb) => {
      cb(null, ''); // No se guarda en disco, se mantiene en memoria
    }
  });

  return multer({
    storage,
    fileFilter: (_req, file, callback) => {
      const ext = path.extname(file.originalname);
      if (ext !== '.pdf') {
        return callback(new Error('Only PDF files are allowed'));
      }
      callback(null, true);
    },
    limits: {
      fileSize: MaxSize // Límite de tamaño del archivo PDF
    }
  });
};

const multerGuardarPDF = (filename) => {
  return (req, res, next) => {
    try {
      console.log(filename)
      init().single(filename)(req, res, next);
    } catch (error) {
      // Si ocurre un error en el middleware de Multer, pasa al siguiente middleware de manejo de errores
      next(error);
    }
  };
};

const multerGuardarPDFNotRequired = (filename) => {
  return (req, res, next) => {
    try {
      if (filename && req.file) {
        // Si se proporciona un nombre de archivo y un archivo está adjunto, usar upload.single() para procesar un solo archivo
        upload.single(filename)(req, res, next);
      } else {
        // Si no se proporciona un nombre de archivo o no hay archivo adjunto, usar upload.none() para no permitir ningún archivo
        upload.none()(req, res, next);
      }
    } catch (error) {
      // Si ocurre un error en el middleware de Multer, pasa al siguiente middleware de manejo de errores
      next(error);
    }
  };
};

module.exports = {multerGuardarPDF, multerGuardarPDFNotRequired};
