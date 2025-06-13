const cipher = require('../cipherService')
const { globalAuth: { keyCipher } } = require('../../config')
const formidable = require('formidable');

const decryptMiddleware = async (req, res, next) => {
  try {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', async () => {
      try {
        const decryptedBody = await cipher.decryptData(body, keyCipher);
        req.decryptedBody = decryptedBody;
        next();
      } catch (error) {
        const errorMessage = error.toString();
        const encryptedErrorMessage = await cipher.encryptData(errorMessage, keyCipher);
        res.status(400).send(encryptedErrorMessage);
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = decryptMiddleware;
