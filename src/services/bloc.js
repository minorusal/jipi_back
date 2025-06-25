'use strict'

const axios = require('axios')
const mysqlLib = require('../lib/db')
const utilitiesService = require('./utilities')
const logger = require('../utils/logs/logger')

class BlocService {
  constructor () {
    if (BlocService.instance == null) {
      this.table = 'bloc_responses'
      this.params = null
      BlocService.instance = this
    }
    return BlocService.instance
  }

  async loadConfig () {
    try {
      this.params = await utilitiesService.getParametros()
    } catch (err) {
      logger.error(`BlocService loadConfig error: ${err.message}`)
      this.params = null
    }
  }

  getParamValue (name) {
    if (!this.params) return null
    const conf = this.params.find(item => item.nombre === name)
    return conf ? conf.valor : null
  }

  async saveBlocResponse ({ request_json = null, endpoint_name, request_url = null, http_status = null, response_time_ms = null, response_json = null, error_message = null }) {
    const queryString = `INSERT INTO ${this.table} (
        request_json,
        endpoint_name,
        request_url,
        http_status,
        response_time_ms,
        response_json,
        error_message
      ) VALUES (
        ${request_json ? mysqlLib.escape(request_json) : 'NULL'},
        ${mysqlLib.escape(endpoint_name)},
        ${request_url ? mysqlLib.escape(request_url) : 'NULL'},
        ${http_status ?? 'NULL'},
        ${response_time_ms ?? 'NULL'},
        ${response_json ? mysqlLib.escape(response_json) : 'NULL'},
        ${error_message ? mysqlLib.escape(error_message) : 'NULL'}
      )`
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async callEndpoint ({ paramName, endpointName, replacements = [], requestData = null }) {
    if (!this.params) {
      await this.loadConfig()
      if (!this.params) {
        try {
          await this.saveBlocResponse({
            request_json: requestData ? JSON.stringify(requestData) : null,
            endpoint_name: endpointName,
            error_message: 'Parameters not loaded'
          })
        } catch (err) {
          logger.error(`Error saving bloc response: ${err.message}`)
        }
        return { data: null }
      }
    }

    const template = this.getParamValue(paramName)
    if (!template) {
      try {
        await this.saveBlocResponse({
          request_json: requestData ? JSON.stringify(requestData) : null,
          endpoint_name: endpointName,
          error_message: 'Endpoint not configured'
        })
      } catch (err) {
        logger.error(`Error saving bloc response: ${err.message}`)
      }
      return { data: null }
    }

    let url = template
    for (const rep of replacements) {
      url = url.replace('||', encodeURIComponent(rep))
    }

    const startTs = Date.now()
    let response
    let status
    let errorMsg = null
    try {
      response = await axios.get(url)
      status = response.status
    } catch (err) {
      status = err.response ? err.response.status : null
      errorMsg = err.message
      response = err.response || { data: null }
    }
    const responseTime = Date.now() - startTs

    try {
      await this.saveBlocResponse({
        request_json: requestData ? JSON.stringify(requestData) : null,
        endpoint_name: endpointName,
        request_url: url,
        http_status: status,
        response_time_ms: responseTime,
        response_json: response ? JSON.stringify(response.data) : null,
        error_message: errorMsg
      })
    } catch (err) {
      logger.error(`Error saving bloc response: ${err.message}`)
    }

    return response
  }

  async callAll (nombre, apellido = '') {
    const endpoints = [
      { param: 'block_lista_sat_69B_presuntos_inexistentes', name: 'sat69b', reps: [nombre, apellido] },
      { param: 'bloc_ofac', name: 'ofac', reps: [nombre, apellido] },
      { param: 'bloc_concursos_mercantiles', name: 'concursos_mercantiles', reps: [nombre] },
      { param: 'bloc_proveedores_contratistas', name: 'proveedores_contratistas', reps: [nombre, apellido] }
    ]
    const reqs = endpoints.map(e => this.callEndpoint({ paramName: e.param, endpointName: e.name, replacements: e.reps }))
    const results = await Promise.allSettled(reqs)

    const [sat69b, ofac, concursos, proveedores] = results.map(r =>
      r.status === 'fulfilled' ? r.value : { data: null }
    )

    return {
      bloc_sat69b: sat69b.data,
      bloc_ofac: ofac.data,
      bloc_concursos_mercantiles: concursos.data,
      bloc_proveedores_contratistas: proveedores.data
    }
  }
}

module.exports = Object.freeze(new BlocService())
