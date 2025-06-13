const { emailjet: { key, secretKey, sender: { from } } } = require('../../config');
const mailjet = require('node-mailjet').apiConnect(key, secretKey);

const sendCompaniEmail = async ({ email, nombre, templateID, empresa, empresa_envia }) => {
  try {
    if (!email || !templateID || !empresa || !empresa_envia) {
      throw new Error('Faltan datos obligatorios: email, templateID, empresa o empresa_envia');
    }

    const response = await mailjet
      .post('send', { version: 'v3.1' })
      .request({
        Messages: [
          {
            From: {
              Email: 'mkt@credibusiness.site',  
              Name: 'credibusiness'
            },
            To: [
              {
                Email: email,
                Name: nombre || ''
              }
            ],
            TemplateID: templateID,  
            TemplateLanguage: true,
            Variables: {
              empresa,
              empresa_envia
            }
          }
        ]
      });

    console.log('Correo enviado con éxito:', response.body);
    console.log(response.body);
    
    return { success: true, result: response.body };
  } catch (error) {
    console.error('Error al enviar el correo:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = { 
  sendCompaniEmail
};
