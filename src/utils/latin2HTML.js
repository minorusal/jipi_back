'use strict'

module.exports = orig => orig
  .replace(/á/g, '&aacute;')
  .replace(/é/g, '&eacute;')
  .replace(/í/g, '&iacute;')
  .replace(/ó/g, '&oacute;')
  .replace(/ú/g, '&uacute;')
  .replace(/Á/g, '&Aacute;')
  .replace(/É/g, '&Eacute;')
  .replace(/Í/g, '&Iacute;')
  .replace(/Ó/g, '&Oacute;')
  .replace(/Ú/g, '&Uacute;')
  .replace(/ñ/g, '&ntilde;')
  .replace(/Ñ/g, '&Ntilde;')
  .replace(/ü/g, '&uuml;')
  .replace(/Ü/g, '&Uuml;')
