'use strict'

const debug = require('debug')('old-api:payments-router')
const boom = require('boom')
const stripe = require('../../lib/stripe')
const companiesService = require('../../services/companies')
const userService = require('../../services/users')
const paymentsService = require('../../services/payments')

const creteCustomerID = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    let { params: { user } } = req
    user = Math.abs(user) || null
    let customerID = null

    if (!user) return next(boom.badRequest('User needed.'))

    const [userCompany] = await userService.getEmpresaByUserId(user)
    if (!userCompany) return next(boom.notFound('User or company not found'))

    const { emp_id: companyID } = userCompany

    const [companyAdmin] = await companiesService.getCompanyAdmin(companyID)
    if (user !== companyAdmin.id) return next(boom.badRequest('Must be admin'))

    const [{ usu_email: userEmail }] = await userService.getAllDataById(user)

    const [userHasCustomerIdAlready] = await paymentsService.getUserPaymentTokens(user)
    if (!userHasCustomerIdAlready) {
      customerID = await stripe.createCustomer(userEmail).catch(err => next(boom.badRequest(`Error creating user: ${err}`)))
      await paymentsService.insertUserPaymentTokens(user, customerID)
    }

    return res.json({
      error: false,
      results: {
        created: true,
        message: 'Customer ID created succesfully'
      }
    })
  } catch (error) {
    next(error)
  }
}

const getPaymentsCards = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    let { params: { user } } = req
    user = Math.abs(user) || null

    const [tokenRaw] = await paymentsService.getUserPaymentTokens(user)
    if (!tokenRaw) return next(boom.notFound('Not customerID found'))
    const { token: customerID } = tokenRaw

    // const cardsData = await stripe.getCards(customerID).catch(err => next(boom.badRequest(err)))
    const cardsData = await stripe.getPaymentMethods(customerID).catch(err => next(boom.badRequest(`Error retreiving cards: ${err}`)))

    if (cardsData.data.length <= 0) return next(boom.badRequest('User does not have payment methods.'))
    const { data: cards, has_more: hasMore } = cardsData

    return res.json({
      error: false,
      results: {
        total: cards.length,
        cards,
        has_more: hasMore
      }
    })
  } catch (error) {
    next(error)
  }
}

const createUserCard = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const { body: { token } } = req
    let { params: { user } } = req
    user = Math.abs(user) || null

    const [tokenRaw] = await paymentsService.getUserPaymentTokens(user)
    if (!tokenRaw) return next(boom.notFound('Not customerID found'))
    const { token: customerID } = tokenRaw
    const card = await stripe.createCard(customerID, token).catch(err => next(boom.badRequest(`Error creating card: ${err}`)))

    return res.json({
      error: false,
      results: {
        card
      }
    })
  } catch (error) {
    next(error)
  }
}

const deleteUserCard = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    let { params: { user, card } } = req
    user = Math.abs(user) || null

    const [tokenRaw] = await paymentsService.getUserPaymentTokens(user)
    if (!tokenRaw) return next(boom.notFound('Not customerID found'))
    const { token: customerID } = tokenRaw

    // Crear la tarjeta con el customerID
    await stripe.deleteCard(customerID, card).catch(err => next(boom.notFound(`Error deleting card: ${err}`)))

    return res.json({
      error: false,
      results: {
        card,
        deleted: true
      }
    })
  } catch (error) {
    next(error)
  }
}

const getSetupIntent = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    let { params: { user } } = req
    user = Math.abs(user) || null

    const [tokenRaw] = await paymentsService.getUserPaymentTokens(user)
    if (!tokenRaw) return next(boom.notFound('No user details'))
    const { token: customerID } = tokenRaw

    const clientSecret = await stripe.createSetupIntent(customerID).catch(err => next(boom.badRequest(`Error setting up intent: ${err}`)))

    return res.json({
      error: false,
      results: {
        client_secret: clientSecret
      }
    })
  } catch (error) {
    next(error)
  }
}

const getPayments = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    let { params: { companyID } } = req
    companyID = Math.abs(companyID) || null

    const payments = await paymentsService.getPayments(companyID)

    return res.json({
      error: false,
      results: {
        total: payments.length || 0,
        payments
      }
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  creteCustomerID,
  getPaymentsCards,
  createUserCard,
  deleteUserCard,
  getSetupIntent,
  getPayments
}
