'use strict'

const debug = require('debug')('old-api:trade-name-controller')
const boom = require('boom')
const tradeNameService = require('../../services/tradeName')

const getTradeNames = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const { query: { country } } = req
    const validCountries = new Map()
    validCountries.set('MEX', true)
    validCountries.set('USA', true)

    if (!validCountries.has(country)) return next(boom.badRequest('Wrong country'))

    const names = await tradeNameService.getTradeNames(country)
    return res.json({
      error: false,
      results: {
        names
      }
    })
  } catch (err) {
    next(err)
  }
}

const deleteTradeNames = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const { params: { tradeId } } = req

    const id = Number(tradeId) || null
    if (!Number.isInteger(id)) return next(boom.badRequest('TradeID Invalid'))

    const foundId = [...(await tradeNameService.getTradeNames('MEX')), ...(await tradeNameService.getTradeNames('USA'))].find(({ nombre_comercial_id: ncId }) => ncId === id)
    if (!foundId) return next(boom.badRequest('TradeID not found'))

    const { affectedRows } = await tradeNameService.deleteTradeNames(foundId.nombre_comercial_id)
    if (affectedRows !== 1) return next(boom.badRequest('There is a problem deleting the specified TradeID'))

    return res.json({
      error: false,
      results: {
        deleted: true
      }
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  getTradeNames,
  deleteTradeNames
}
