'use strict'

const debug = require('debug')('old-api:sns-util')
const { setupSNS } = require('../lib/aws')
const sns = setupSNS()

const send = ({ text, phone }) => {
  debug(`${phone}: ${text}`)
  const params = {
    Message: text,
    PhoneNumber: `+${phone.trim().replace(/\D/g, '')}`
  }
  const publish = sns.publish(params).promise()

  return new Promise((resolve, reject) => {
    publish.then(data => {
      resolve(data.MessageId)
    }).catch(error => {
      reject(error)
    })
  })
}

module.exports = send
