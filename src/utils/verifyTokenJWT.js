const jwt = require('jsonwebtoken')
const debug = require('debug')('app')

module.exports = (token, secret, ignoreExpiration = false) => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, secret, { ignoreExpiration }, (error, decodedData) => {
      if (error || !decodedData) {
        debug(`Token error: ${error}`)
        reject(error)
      }
      resolve(decodedData)
    })
  })
}
