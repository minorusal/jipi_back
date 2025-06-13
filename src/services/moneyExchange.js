const debug = require('debug')('old-api:money-exchange-service')
const qs = require('querystring')
const axios = require('axios')
const { moneyExchange: { endpoint } } = require('../config')

class MoneyExchangeApi {
  constructor (endpoint) {
    if (MoneyExchangeApi.instance == null) {
      this.endpoint = endpoint || 'https://api.exchangeratesapi.io'
      MoneyExchangeApi.instance = this
    }
    return MoneyExchangeApi.instance
  }

  async latest (queryString) {
    const { data } = await axios.get(`${this.endpoint}/latest?${qs.stringify(queryString)}`)
    debug(data)
    return data
  }
}

const inst = new MoneyExchangeApi(endpoint)
Object.freeze(inst)

module.exports = inst
