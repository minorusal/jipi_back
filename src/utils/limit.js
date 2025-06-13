'use strict'

// Para utilizarlo en los queries y añadir paginación

const limitQueryRange = (page, limit) => {
  const n = page <= 1 ? 0 : limit * page - limit
  return [n, limit]
}

module.exports = limitQueryRange
