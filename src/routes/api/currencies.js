'use strict'
const debug = require('debug')('old-api:currencies-router')
const express = require('express')
const currenciesService = require('../../services/currencies')

const router = express.Router()

router.get('/', async function (req, res, next) {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const results = await currenciesService.getCurrencies()

    return res.json({
      error: false,
      results
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router
