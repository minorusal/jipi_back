'use strict'
const { globalAuth: { userSecretKey, genericSecretKey } } = require('../../config')
const boom = require('boom')
const userService = require('../../services/users')
const authService = require('../../services/auth')
const bcrypt = require('bcrypt')
const verifyTokenJWT = require('../../utils/verifyTokenJWT')
const jwt = require('jsonwebtoken');

exports.generaTokenGenericoInicial = () => {
  return async (req, res, next) => {
    const userData = {
      empresa: '4RC542024',
      usuario: 'g3n3r1c0',
      gen: true,
      genToken: '$2b$10$T2e/QfpmHj0sn8HfCyFUI.uktOjuSn0hXF3qxdhOUJ466spPO52rO'
    };

    // Generar token JWT con una clave secreta única para el usuario
    const secretKey = '4RC542024L3v4n74m13n70';
    const token = jwt.sign(userData, secretKey);
    console.log('Este sera el token generico', token);
    // Obtener el hash del token

    const hashedToken = await bcrypt.hash(token, 10);

    const hashedSecretKey = await bcrypt.hash(secretKey, 10);
    console.log(hashedSecretKey);

    // Comparar el hash del token con la clave secreta única
    const result = await bcrypt.compare(token, hashedToken);

    console.log(result);



    return next();
  }
}

exports.globalAuthMiddleware = () => {
  return async (req, res, next) => {
    const token = req.headers['mc-token']
    if (!token) return next(boom.unauthorized('Not token provided.'))

    const [bearer, tokenBody] = token.split(' ')
    if (bearer !== 'Bearer' || !tokenBody) return next(boom.unauthorized('Invalid token. No Bearer.'))

    const keys = Object.keys(userSecretKey)
    const devicesDetectedByToken = {}

    for (let i = 0; i < keys.length; i++) {
      const verifyRes = { error: null, results: null }
      try {
        verifyRes.error = false
        verifyRes.results = await verifyTokenJWT(tokenBody, userSecretKey[keys[i]])

      } catch (error) {
        verifyRes.error = true
        verifyRes.results = error
      }
      devicesDetectedByToken[keys[i]] = verifyRes
    }

    const realDeviceArray = Object.keys(devicesDetectedByToken).filter(val => !devicesDetectedByToken[val].error)

    if (realDeviceArray.length !== 1) {
      const expiredError = Object.keys(devicesDetectedByToken).filter(val => devicesDetectedByToken[val].results.name === 'TokenExpiredError')

      if (expiredError.length === 1) {
        const { url, method } = req
        if (expiredError.length === 1 && url === '/logout' && method === 'DELETE') {
          const [expiredDevice] = expiredError
          const { mcId, jti: sessionTokId } = await verifyTokenJWT(tokenBody, userSecretKey[expiredDevice], true)

          const ifDeactivatedRaw = await authService.getDataBySessTokId(sessionTokId)
          if (ifDeactivatedRaw.length !== 1) return next(boom.badRequest('Verifying sessionToken on logout failed.'))

          const [{ urtActive }] = ifDeactivatedRaw
          if (!urtActive) return next(boom.badRequest('Token blacklisted.'))

          const results = await authService.deactivateBySessToken(mcId, sessionTokId)
          if (results.affectedRows !== 1) return next(boom.badRequest('Error blacklisting token.'))

          return res.json({
            error: false,
            results: {
              deleted: true
            }
          })
        } else return next(boom.unauthorized('TokenExpiredError'))
      }

      return next(boom.badRequest('JsonWebTokenError'))
    }

    const [device] = realDeviceArray

    const { mcId: usuId, gen, genToken, jti: sessionTokId } = devicesDetectedByToken[device].results

    req.payload = { usuId, device, sessionTokId }
    if (gen && !usuId) {
      bcrypt.compare(genericSecretKey[device], genToken, (err, result) => {
        if (err) return next(boom.unauthorized('Token error. Error compare.'))
        if (result) return next()
        return next(boom.unauthorized('Invalid token. Error compare.'))
      })
    } else if (!gen && usuId) {
      console.log('entra aqui');
      const [userDB] = await userService.getById(usuId)
      if (!userDB) return next(boom.notFound('User not found.'))

      const verifyActiveToken = await authService.getDataBySessTokId(sessionTokId)
      if (verifyActiveToken.length !== 1) return next(boom.unauthorized('Verify if active token failed.'))

      const [{ urtSessionToken, urtActive }] = verifyActiveToken
      if (!urtActive) return next(boom.unauthorized('Token blacklisted.'))

      if (urtSessionToken === tokenBody) return next()

      else return next(boom.unauthorized('Token mismatch.'))
    } else return next(boom.badRequest('Token error. General error.'))
  }
}

exports.notAllowGenericToken = () => {
  return async (req, res, next) => {
    const { usuId } = req.payload
    if (!usuId) return next(boom.unauthorized('User token needed. Not generic.'))
    return next()
  }
}

exports.notAllowUserToken = () => {
  return async (req, res, next) => {
    const { usuId } = req.payload
    if (usuId) return next(boom.unauthorized('Generic token needed. User token not allowed.'))
    return next()
  }
}
