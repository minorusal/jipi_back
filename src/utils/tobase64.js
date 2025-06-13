'use strict'

// Se utiliza para mandar una info a la web antes de que implementaramos
// el JWT, pero aún lo utilizamos, de preferencia se tiene que cambiar esto
// a JWT

// En si se mandaba una info en base64 a un correo electrónico para invitar
// comrpadores y vendedores a MC

const fs = require('fs')
const debug = require('debug')('old-api:toBase64-util')

const toBase64 = (file) => {
  debug(`Encoding ${file}`)
  try {
    return fs.readFileSync(file, { encoding: 'base64' })
  } catch (error) {
    debug(`Error while decoding ${file}`)
    debug(error)
    return null
  }
}

module.exports = toBase64
