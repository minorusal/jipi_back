const debug = require('debug')('old-api:countries-router')
const express = require('express')
const countriesService = require('../../services/countries')

const router = express.Router()

router.get('/', async function (req, res, next) {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const idioma = req.query.idioma
    const results = await countriesService.getPaises(idioma)
    return res.json({
      error: false,
      results
    })
  } catch (err) {
    next(err)
  }
})

router.get('/:id/states', async function (req, res, next) {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { query } = req
    const { id } = req.params
    const results = await countriesService.getEstados(id, query.idioma)
    return res.json({
      error: false,
      results
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router
