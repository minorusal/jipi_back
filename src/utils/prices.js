'use strict'

// Esto lo utiliza la implementación de stripe para poder convertir a centavos
// una cantidad, por ejemplo 1 son 100 centavos

const convert = amount => amount * 100

module.exports = convert
