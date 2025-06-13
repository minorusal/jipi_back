'use strict'

const { S3, SNS } = require('aws-sdk')
const { aws: { id, secret, sns: { id: snsID, secret: snsSecret, region: snsRegion } } } = require('../config')

let s3 = null
let sns = null

const setupS3 = () => {
  if (!s3) {
    s3 = new S3({
      accessKeyId: id,
      secretAccessKey: secret
    })
  }
  return s3
}

const setupSNS = () => {
  if (!sns) {
    sns = new SNS({
      accessKeyId: snsID,
      secretAccessKey: snsSecret,
      region: snsRegion,
      apiVersion: '2010-03-31'
    })
  }
  return sns
}

module.exports = {
  setupS3,
  setupSNS
}
