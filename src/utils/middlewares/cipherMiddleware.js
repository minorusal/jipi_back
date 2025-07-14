const cipher = require('../cipherService')
const { globalAuth: { keyCipher } } = require('../../config')
const formidable = require('formidable');

const decryptMiddleware = async (req, res, next) => {
  try {
    // If the request is not a POST, PUT, or PATCH, or has no content-length header, we can skip.
    if (!['POST', 'PUT', 'PATCH'].includes(req.method) || !req.headers['content-length'] || req.headers['content-length'] === '0') {
      return next();
    }

    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', async () => {
      // If after all events, body is still empty, just continue.
      if (!body) {
        return next();
      }
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

    // Handle potential errors on the stream
    req.on('error', (err) => {
      next(err);
    });
    
  } catch (error) {
    next(error);
  }
};

module.exports = decryptMiddleware;
