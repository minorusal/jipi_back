'use strict'

// Esto calcula un promedio de cotizaciones cerradas
// En realidad sólo se utiliza una vez, dentro de unos datos de cotizaciones.
// En caso de que necesites modificarlo puedes hacer una búsqueda global para
// revisar en que archivo se manda a llamar esta función

const moment = require('moment')
const debug = require('debug')('old-api:calcular-promedio-deals-util')

const generaTotal = fechas => fechas.reduce((iv, cv) => iv + cv.total, 0)

const getPrimeraUltimaFecha = fechas => {
  return { primera: fechas[0].fecha, ultima: fechas[fechas.length - 1].fecha }
}

const getNumeroDias = (primera, segunda) => {
  const a = moment(primera)
  const b = moment(segunda)
  return b.diff(a, 'days') + 1
}

const calcularPromedio = fechas => {
  if (fechas === undefined || fechas === null || fechas.length === 0) {
    return 0
  }
  const { primera, ultima } = getPrimeraUltimaFecha(fechas)
  const dias = getNumeroDias(primera, ultima)
  const total = generaTotal(fechas)
  debug(`${total} DEALS / ${dias} dias`)
  return total / dias
}

module.exports = calcularPromedio
