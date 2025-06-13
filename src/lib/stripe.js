'use strict'

// En este módulo se "empaquetan" las funciones de stripe dentro de proesas,
// para poder evitar un callback hell en sus implementaciones.
// Me parece que el nombre de las funciones es bastante descriptivo
// puedes consultar los docs de stripe en su sitio para mayor documentación

const { stripe: { key } } = require('../config')
const debug = require('debug')('old-api:stripe-lib')
const stripe = require('stripe')(key)

const prices = require('../utils/prices')

const createCustomer = async (email) => {
  const customer = await stripe.customers.create({ email })
  const { id: customerID } = customer
  return customerID
}

const createSetupIntent = async customer => {
  const intent = await stripe.setupIntents.create({
    customer
  })
  const { client_secret: clientSecret } = intent
  return clientSecret
}

const getCards = async customer => {
  return new Promise((resolve, reject) => {
    stripe.customers.listSources(
      customer,
      { object: 'card', limit: 10 },
      function (err, cards) {
        if (err) {
          debug('There was an error retrieving the cards')
          reject(new Error('There was an error retrieving the cards'))
        }
        debug(cards)
        resolve(cards)
      }
    )
  })
}

const createCard = (customer, source) => {
  debug(`Creating a Card with the following token: ${source}`)
  return new Promise((resolve, reject) => {
    stripe.customers.createSource(
      customer,
      { source },
      (err, card) => {
        if (err) {
          debug('There was an error while creating a new card')
          reject(err)
        }
        debug(card)
        resolve(card)
      }
    )
  })
}

const updateCard = (customer, card, data) => {
  return new Promise((resolve, reject) => {
    stripe.customers.updateSource(
      customer,
      card,
      ...data,
      (err, card) => {
        if (err) {
          debug('There was an error while updating the card')
          reject(err)
        }
        debug(card)
        resolve(card)
      }
    )
  })
}

const deleteCard = (customer, card) => {
  return new Promise((resolve, reject) => {
    stripe.customers.deleteSource(
      customer,
      card,
      (err, confirmation) => {
        if (err) {
          debug('There was an error while deleting the card')
          reject(err)
        }
        debug(confirmation)
        resolve(confirmation)
      }
    )
  })
}

const getPaymentMethods = async customer => {
  const paymentMethods = await stripe.paymentMethods.list({
    customer,
    type: 'card'
  })
  return paymentMethods
}

const createPayment = async (price, currency, customer, paymentMethod) => {
  try {
    const amount = prices(price)
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      customer,
      payment_method: paymentMethod,
      off_session: true,
      confirm: true
    })
    return paymentIntent
  } catch (error) {
    debug('There was an error while creating a payment Intent')
    debug(`Error code is: ${error.code}`)
    return error
  }
}

module.exports = {
  createCustomer,
  createSetupIntent,
  getCards,
  createCard,
  updateCard,
  deleteCard,
  getPaymentMethods,
  createPayment
}
