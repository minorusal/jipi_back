'use strict'

const parseNumber = (val) => {
  if (val === undefined || val === null) return NaN
  const cleaned = String(val).replace(/[$,\s]/g, '')
  return Number(cleaned)
}

module.exports = parseNumber
