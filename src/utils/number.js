'use strict'

const parseNumber = (val) => {
  if (val === undefined || val === null) return NaN
  if (typeof val === 'number') return val
  let str = String(val).trim()
  if (!str) return NaN
  // remove currency symbols and spaces
  str = str.replace(/[$\s]/g, '')
  const lastComma = str.lastIndexOf(',')
  const lastDot = str.lastIndexOf('.')
  // Determine decimal separator by last occurrence
  if (lastComma > lastDot) {
    // comma is decimal separator, remove thousand dots
    str = str.replace(/\./g, '')
    str = str.replace(',', '.')
  } else {
    // dot is decimal separator (or no decimal part), remove thousand commas
    str = str.replace(/,/g, '')
  }
  return Number(str)
}

module.exports = parseNumber
