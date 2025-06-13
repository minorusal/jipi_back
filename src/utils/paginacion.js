'use strict'
module.exports = (arr, page, limit) => arr.slice((page - 1) * limit, page * limit)
