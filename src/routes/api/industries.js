const debug = require('debug')('old-api:companies-router')
const express = require('express')
const industriesService = require('../../services/industries')

const router = express.Router()

router.get('/', async function (req, res, next) {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const idioma = req.query.idioma
    const results = await industriesService.getIndustrias(idioma)
    return res.json({
      error: false,
      results
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router
