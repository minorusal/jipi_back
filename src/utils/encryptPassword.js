'use strict'

// Envuelve en promesas las funciones de bcrypt para poder cifrar y comprar
// contraseñas

const bcrypt = require('bcrypt')

function encryptPassword (pwd) {
  return new Promise((resolve, reject) => {
    const saltRounds = 10

    bcrypt.genSalt(saltRounds, function (errSalt, salt) {
      if (errSalt) reject(errSalt)
      bcrypt.hash(pwd, salt, function (errHash, hash) {
        if (errHash) reject(errHash)
        resolve(hash)
      })
    })
  })
}

function compare (pwd1, pwd2) {
  return new Promise((resolve, reject) => {
    bcrypt.compare(pwd1, pwd2, (err, response) => {
      if (err) {
        reject(err)
      }

      resolve(response)
    })
  })
}

module.exports = {
  compare,
  encryptPassword
}
