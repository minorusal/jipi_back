'use strict'
const debug = require('debug')('old-api:handleErrorMidleware')
const cipher = require('../../utils/cipherService')

// En la siguiente función se definen los posibles errores de la REST API
// con sus manejos de eror, por ejemplo
// Si un error es un MulterError se tendrá que retornar un estatus 400
// con la información detallada dentro del error
// Asi como ese ejemplo se manejan diferentes tipos de errores, pero estos
// errores sólo aplican a las rutas nuevas desarrolladas en Arcsa,
// los errores del legacy code de la consultoría son, como mencioné en el
// README inexistentes

module.exports = () => {
  return async (err, req, res, next) => {
    // Se utiliza el paquete de boom para generar errores de http
    // Es por eso que en los controladores puedes ver cosas como
    // if (!usuario) return next(boom.notFound('User not found'))

    if (err.isBoom) {
      console.log(err)
      const {
        output: { statusCode, payload }
      } = err
      debug(statusCode, payload)
      res.status(statusCode)

      const encryptedResponse = await cipher.encryptData(JSON.stringify(payload));

      return res.send(encryptedResponse);
    }

    if (err.sql) {
      const { code } = err
      switch (code) {
        case 'ER_DUP_ENTRY':
        case 'ER_BAD_NULL_ERROR':
          const encryptedResponse = await cipher.encryptData(JSON.stringify({
            statusCode: 400,
            error: 'Bad Request',
            message: 'Database error'
          }));
          return res.status(400).send(encryptedResponse)
      }
    }

    if (err.name === 'MulterError') {
      const { code } = err
      switch (code) {
        case 'LIMIT_FILE_SIZE':
          const encryptedResponse = await cipher.encryptData(JSON.stringify({
            statusCode: 400,
            error: 'Bad Request',
            message: 'File size too large'
          }));
          return res.status(400).send(encryptedResponse)
      }
    }

    if (err.name === 'CronosError') {
      const { err: { error, statusCode }, message } = err
      debug(statusCode)
      const encryptedResponse = await cipher.encryptData(JSON.stringify({
        statusCode: 503,
        error,
        message
      }));
      return res.status(503).send(encryptedResponse)
    }

    const encryptedResponse = await cipher.encryptData(JSON.stringify({
      error: true,
      message: err.message,
      stack: err.stack
    }));
    return res.status(500).send(encryptedResponse)
  }
}
