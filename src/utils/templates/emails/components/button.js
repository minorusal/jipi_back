'use strict'

const button = (url, text, ancho = '200px') => `
  </mj-text>
    <mj-button background-color="#FC871F" color="white" font-size="20px" href="${url}" width="${ancho}">${text}</mj-button>
  <mj-text align="left" font-size="14px" font-family="Montserrat">
`

module.exports = button
