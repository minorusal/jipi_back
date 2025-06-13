const debug = require('debug')('old-api:money-exchange-router')
const express = require('express')
const boom = require('boom')
const moneyExchange = require('../../services/moneyExchange')
const authMiddleware = require('../../utils/middlewares/authMiddleware')
const router = express.Router()

router.get('/', authMiddleware, async function (req, res, next) {
  debug(`[${req.method}] ${req.originalUrl}`)

  try {
    const { query } = req

    if (query && !query.base) {
      query.base = 'USD'
    }

    if (query && query.fromCurrency && query.toCurrency && query.amount && !query.symbol) {
      query.base = query.fromCurrency
      const exchanges = await moneyExchange.latest(query)
      if (exchanges.rates[query.fromCurrency] && exchanges.rates[query.toCurrency]) {
        const total = parseInt(query.amount) * exchanges.rates[query.toCurrency]
        return res.status(200).json({
          error: false,
          results: {
            fromCurrency: query.fromCurrency,
            toCurrency: query.toCurrency,
            amount: query.amount,
            total
          }
        })
      } else {
        const boomError = boom.badImplementation('Bad querystrings or does not exist money exchange')
        const {
          output: {
            payload,
            statusCode
          }
        } = boomError
        return res.status(statusCode).json(payload)
      }
    }

    const result = await moneyExchange.latest(query)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
})

module.exports = router
