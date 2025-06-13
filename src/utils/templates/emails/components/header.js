'use strict'

const { web: { url } } = require('../../../../config')

const header = () => `
<mjml>
  <mj-head>
      <mj-font name="Montserrat" href="https://fonts.googleapis.com/css?family=Montserrat" />
      <mj-attributes>
          <mj-all font-family="Montserrat" />
      </mj-attributes>
  </mj-head>
  <mj-body background-color="#f5f5f5">
  <mj-wrapper padding="40px 0">
      <mj-section full-width text-align="center" background-color="#fff">
          <mj-column>
              <mj-image align="center" src="${url}/assets/img/email/logo.png" />
          </mj-column>
      </mj-section>
      <mj-section background-color="#fff" full-width>
          <mj-column full-width>
              <mj-text align="left" font-size="14px" font-family="Montserrat">
              
  `

module.exports = header
