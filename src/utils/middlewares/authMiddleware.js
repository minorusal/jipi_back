const jwt = require('jsonwebtoken');
const boom = require('boom')
const util = require('util');

const verifyAsync = util.promisify(jwt.verify);

async function authMiddleware(req, res, next) {
    const authHeader = req.headers['mc-token'];
  
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(boom.unauthorized('Token not provided'));
    }
  
    const token = authHeader.split(' ')[1];
  
    const secretKey = '4RC542024L3v4n74m13n70';
    try {
        const decoded = await verifyAsync(token, secretKey);
        req.user = decoded;
        next();
      } catch (error) {
        next(boom.unauthorized('Invalid token'));
      }
  }
  

module.exports = authMiddleware;
