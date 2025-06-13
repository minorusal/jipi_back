'use strict'
const mysqlInstance = require('../lib/db')

const setLimits = (limit, page) => {
  const n = page <= 1 ? 0 : limit * page - limit
  return ` limit ${[n, limit]}`
}

const paginatedQuery = async (query, limit, page) => {
  const [entries] = await mysqlInstance.query(`${query.trim()}${setLimits(limit, page)}`)

  const splittedQuery = query.toLowerCase().split('from')
  const totalQuery = `select count(*) as count from ${splittedQuery[splittedQuery.length - 1]}`
  const [[{ count: totalEntries }]] = await mysqlInstance.query(totalQuery)

  const totalPages = Math.ceil(totalEntries / limit)
  if (page > totalPages || page < 0) return { error: true, msg: 'Page not found.' }

  return { totalEntries, totalPages, entries }
}

module.exports = paginatedQuery
