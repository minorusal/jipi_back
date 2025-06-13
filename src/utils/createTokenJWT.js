const jwt = require('jsonwebtoken')
const debug = require('debug')('app')
const { uuid } = require('uuid-base62')

module.exports = (payload, expiresIn, secretKey) => {
  const tokenId = uuid.v4()
  return new Promise((resolve, reject) => {
    if (!expiresIn || !secretKey || (payload && Object.keys(payload).length === 0 && payload.constructor === Object)) reject(Error('Invalid arguments.'))
    jwt.sign(payload, secretKey, {
      expiresIn,
      issuer: 'www.marketchoiceb2b.com',
      jwtid: tokenId

    }, (err, token) => {
      if (err) {
        debug(err)
        reject(err)
      }

      resolve({ tokenId, token })
    })
  })
}
