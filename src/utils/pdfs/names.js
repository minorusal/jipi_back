'use strict'

const uuid = require('uuid-base62')

const newName = () => {
  const uuidFile = `${uuid.v4()}${uuid.v4()}`
  const date = new Date()
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  return `${uuidFile}-${year}-${month}-${day}.pdf`
}

module.exports = newName
