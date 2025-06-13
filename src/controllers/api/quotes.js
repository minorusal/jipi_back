'use strict'
// quotes new

const debug = require('debug')('old-api:quotesNew-controller')
const boom = require('boom')
const quoteNewService = require('../../services/quotesNew')
const userTypes = { seller: 1, buyer: 2, admin: 3 }
const queryTypes = { open: 'open', closed: 'closed', deleted: 'deleted', reported: 'reported', canReport: 'can-report' }
const queryNonComplianceTypes = { deal: 'deal', reported: 'reported', canReport: 'can-report' }
Object.freeze(userTypes)
Object.freeze(queryTypes)
Object.freeze(queryNonComplianceTypes)

const getQuotesWithFilters = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { query: { type } } = req
    let { params: { user } } = req
    user = Math.abs(user) || 0

    const userDetails = await quoteNewService.getUserDetails(user)
    if (!userDetails) return next(boom.badRequest('Wrong user'))

    const { userType, companyID } = userDetails

    let quotes = null

    switch (userType) {
      case userTypes.seller:
        quotes = await getSellerQuotes(user, companyID, type)
        break
      case userTypes.buyer:
        quotes = await getBuyerQuotes(user, companyID, type)
        break
      case userTypes.admin:
        quotes = await getAdminQuotes(user, companyID, type)
        break
      default:
        quotes = []
        break
    }

    return res.json({
      error: false,
      results: {
        total: quotes.length,
        quotes
      }
    })
  } catch (err) {
    next(err)
  }
}

const getSellerQuotes = async (user, company, type) => {
  let quotes = []
  switch (type) {
    case queryTypes.open:
      quotes = await quoteNewService.getSellerOpen(user, company)
      break
    case queryTypes.closed:
      quotes = await quoteNewService.getSellerClosed(user, company)
      break
    case queryTypes.deleted:
      quotes = await quoteNewService.getSellerDeleted(user, company)
      break
    case queryTypes.reported:
      quotes = await quoteNewService.getSellerReported(user, company)
      break
    case queryTypes.canReport:
      quotes = await quoteNewService.getSellerCanReport(user, company)
      break
  }
  return quotes
}

const getBuyerQuotes = async (user, company, type) => {
  let quotes = []
  switch (type) {
    case queryTypes.open:
      quotes = await quoteNewService.getBuyerOpen(user, company)
      break
    case queryTypes.closed:
      quotes = await quoteNewService.getBuyerClosed(user, company)
      break
    case queryTypes.deleted:
      quotes = await quoteNewService.getBuyerDeleted(user, company)
      break
    case queryTypes.reported:
      quotes = await quoteNewService.getBuyerReported(user, company)
      break
    case queryTypes.canReport:
      quotes = await quoteNewService.getBuyerCanReport(user, company)
      break
  }
  return quotes
}

const getAdminQuotes = async (user, company, type) => {
  let quotes = []
  switch (type) {
    case queryTypes.open:
      quotes = await quoteNewService.getAdminOpen(user, company)
      break
    case queryTypes.closed:
      quotes = await quoteNewService.getAdminClosed(user, company)
      break
    case queryTypes.deleted:
      quotes = await quoteNewService.getAdminDeleted(user, company)
      break
    case queryTypes.reported:
      quotes = await quoteNewService.getAdminReported(user, company)
      break
    case queryTypes.canReport:
      quotes = await quoteNewService.getAdminCanReport(user, company)
      break
  }
  const quotesReduce = quoteNewService.reduceAdminQuotes(company, quotes)
  return quotesReduce
}

const nonComplianceQuotes = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { query: { type, company } } = req
    let { params: { user } } = req
    user = Math.abs(user) || 0

    const userDetails = await quoteNewService.getUserDetails(user)
    if (!userDetails) return next(boom.badRequest('Wrong user'))
    const { userType, companyID } = userDetails

    let quotes = []

    switch (userType) {
      case userTypes.seller:
        quotes = await getSellerNonComplianceQuotes(user, companyID, company, type)
        break
      case userTypes.buyer:
        quotes = await getBuyerNonComplianceQuotes(user, companyID, company, type)
        break
      case userTypes.admin:
        quotes = await getAdminNonComplianceQuotes(user, companyID, company, type)
        break
      default:
        quotes = []
        break
    }

    return res.json({
      error: false,
      results: {
        total: quotes.length,
        quotes
      }
    })
  } catch (err) {
    next(err)
  }
}

const getAdminNonComplianceQuotes = async (user, userCompany, destinyCompany, type) => {
  let quotes = []
  switch (type) {
    case queryNonComplianceTypes.deal:
      quotes = await quoteNewService.getAdminNonComplianceQuotesDeals(user, userCompany, destinyCompany)
      break
    case queryNonComplianceTypes.reported:
      quotes = await quoteNewService.getAdminNonComplianceQuotes(user, userCompany, destinyCompany)
      break
    case queryNonComplianceTypes.canReport:
      quotes = await quoteNewService.getAdminNonComplianceQuotesCanReport(user, userCompany, destinyCompany)
      break
  }
  const quotesReduce = quoteNewService.reduceAdminQuotes(userCompany, quotes)
  return quotesReduce
}

const getBuyerNonComplianceQuotes = async (user, userCompany, destinyCompany, type) => {
  let quotes = []
  switch (type) {
    case queryNonComplianceTypes.deal:
      quotes = await quoteNewService.getBuyerNonComplianceQuotesDeals(user, userCompany, destinyCompany)
      break
    case queryNonComplianceTypes.reported:
      quotes = await quoteNewService.getBuyerNonComplianceQuotes(user, userCompany, destinyCompany)
      break
    case queryNonComplianceTypes.canReport:
      quotes = await quoteNewService.getBuyerNonComplianceQuotesCanReport(user, userCompany, destinyCompany)
      break
  }
  return quotes
}

const getSellerNonComplianceQuotes = async (user, userCompany, destinyCompany, type) => {
  let quotes = []
  switch (type) {
    case queryNonComplianceTypes.deal:
      quotes = await quoteNewService.getSellerNonComplianceQuotesDeals(user, userCompany, destinyCompany)
      break
    case queryNonComplianceTypes.reported:
      quotes = await quoteNewService.getSellerNonComplianceQuotes(user, userCompany, destinyCompany)
      break
    case queryNonComplianceTypes.canReport:
      quotes = await quoteNewService.getSellerNonComplianceQuotesCanReport(user, userCompany, destinyCompany)
      break
  }
  return quotes
}

module.exports = {
  getQuotesWithFilters,
  nonComplianceQuotes
}
