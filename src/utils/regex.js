'use strict'

// Algunas expresiones regulares, principalmente utilizadas para validar
// horarios

async function validRegex (regexpresion, obj) {
  const regex = new RegExp(regexpresion)
  return new Promise((resolve, reject) => {
    Object.keys(obj).forEach(key => {
      if (!regex.test(obj[key])) {
        reject(new Error(`${key} wrong format`))
      }
    })
    resolve()
  })
}

const regexHorario = async (cadena) => {
  const regex = new RegExp('^([0-1][0-9]|[2][0-3]):([0-5][0-9])$')
  return new Promise((resolve, reject) => {
    if (!regex.test(cadena)) {
      reject(new Error(`${cadena} no es horario de 24 hrs`))
    }
    resolve()
  })
}

module.exports = {
  validRegex,
  regexHorario
}
