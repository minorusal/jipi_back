'use strict'

const { web: { url } } = require('../../../../config')

const socialMediaUrls = {
  facebook: 'https://www.facebook.com/marketchoiceB2B',
  instagram: 'https://www.instagram.com/marketchoiceb2b',
  linkedin: 'https://www.linkedin.com/company/market-choice-b2b'
}

const appsDownloadUrls = {
  android: 'https://play.google.com/store/apps/details?id=com.mobtk.marketchoice',
  ios: 'https://apps.apple.com/us/app/market-choice/id1530115939'
}

const externalLinks = {
  termsAndConditions: `${url}/legal/terminos-y-condiciones`
}

const footer = () => `
          
  </mj-text>
  </mj-column>
</mj-section>
<mj-section full-width background-color="#103269" >
  <mj-column vertical-align="middle">
      <mj-text color="#fff">
          <ul style="list-style-type: none;">
              <li style="padding-bottom: 5px;"><a href=${url} target="_blank" rel="noopener noreferrer">Centro de ayuda</a></li>
              <li style="padding-bottom: 5px;"><a href=${externalLinks.termsAndConditions} target="_blank" rel="noopener noreferrer">T&eacute;rminos y Condiciones</a></li>
              <li style="padding-bottom: 5px;">Market Choice</li>
              <li style="padding-bottom: 5px;">M&eacute;xico, Ciudad de M&eacute;xico</li>
              <li><a href=${url} target="_blank" rel="noopener noreferrer">www.marketchoiceb2b.com</a></li>
          </ul>
      </mj-text>
  </mj-column>
  <mj-column vertical-align="middle">
      <mj-text color="#fff" font-size="15px" align="center">
        <p>Decarga la App</p>
        <p style="display: flex; justify-content: center; ">
          <a href=${appsDownloadUrls.ios} style="margin: 0 5px;"><img style="max-width: 100%;" src="${url}/assets/img/email/appstore.png" alt="Descarga la aplicación de iOS"></a>
          <a href=${appsDownloadUrls.android} style="margin: 0 5px;"><img style="max-width: 100%;" src="${url}/assets/img/email/playstore.png" alt="Descarga la aplicación de Android"></a>
        </p>
        <p>
          <a href=${socialMediaUrls.facebook}><img src="${url}/assets/img/email/fb.png" alt="Facebook"></a>
          <a href=${socialMediaUrls.instagram}><img src="${url}/assets/img/email/ins.png" alt="Instagram"></a>
          <a href=${socialMediaUrls.linkedin}><img src="${url}/assets/img/email/in.png" alt="LinkedIn"></a>
        </p>
      </mj-text>
</mj-column>
</mj-section>
</mj-wrapper>
</mj-body>
</mjml>
`

module.exports = footer
