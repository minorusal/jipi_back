'use strict'
const debug = require('debug')('old-api:units-router')
const express = require('express')

const unitsService = require('../../services/units')
const authMiddleware = require('../../utils/middlewares/authMiddleware')

const router = express.Router()

router.get('/', authMiddleware, async function (req, res, next) {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const results = await unitsService.getUnits()

    return res.json({
      error: false,
      results
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router
