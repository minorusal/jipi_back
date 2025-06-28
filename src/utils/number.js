'use strict'

const parseNumber = (val) => {
  if (val === undefined || val === null) return 0
  if (typeof val === 'number') return Number.isNaN(val) ? 0 : val
  let str = String(val).trim()
  if (!str || str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined') {
    return 0
  }
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
  const num = Number(str)
  return Number.isNaN(num) ? 0 : num
}

module.exports = parseNumber
