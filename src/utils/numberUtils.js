'use strict'

function toNumber(val) {
  if (val === undefined || val === null) return NaN
  const str = String(val).trim().toLowerCase()
  if (str === 'inf') return Infinity
  if (str === '-inf') return -Infinity
  const clean = str.replace(/[^0-9.-]/g, '')
  return parseFloat(clean)
}

function getLimits(entry) {
  if (entry.limite_inferior !== undefined && entry.limite_inferior !== null) {
    const inf = toNumber(entry.limite_inferior)
    const sup = entry.limite_superior == null ? Infinity : toNumber(entry.limite_superior)
    return [inf, sup]
  }
  if (entry.rango) {
    const [a, b] = entry.rango.replace(/[()\[\]]/g, '').split(',')
    const start = toNumber(a)
    const end = toNumber(b)
    return [Math.min(start, end), Math.max(start, end)]
  }
  return [NaN, NaN]
}

module.exports = { toNumber, getLimits }
