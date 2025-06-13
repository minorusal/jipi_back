'use strict'

module.exports = (limit, page) => {
  const newlimit = limit ? parseInt(limit.trim(), 10) : 10
  const newpage = page ? parseInt(page.trim(), 10) : 1
  return [newlimit, newpage]
}
