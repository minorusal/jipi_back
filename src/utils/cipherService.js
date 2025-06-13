const CryptoJS = require('crypto-js')
const { globalAuth: { keyCipher } } = require('../config')

const encryptData = async (data, key = keyCipher) => {
  return CryptoJS.AES.encrypt(JSON.stringify(data), key).toString();
}

const decryptData = async (encryptedData, key = keyCipher) => {
  const bytes = CryptoJS.AES.decrypt(encryptedData, key);
  return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
}

module.exports = {
  encryptData,
  decryptData
};
