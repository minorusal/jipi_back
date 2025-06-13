'use strict'

// Las cotizaciones debían generar un PDF para la web, pero esto
// se quedó en pausa hace meses, pero ya cuentas con las bases para poder
// realizar estos archivos PDF con ejs, guardarlo temporalmente y subirlo
// a S3 o mandarlo por http para descarga directa.

const generatePDF = require('./generate')

module.exports = {
  generatePDF
}
