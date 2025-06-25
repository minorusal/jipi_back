'use strict'

const blocService = require('../../services/bloc')
const logger = require('../../utils/logs/logger')

const callAllBlocServices = async (nombre, apellido = '') => {
  const fileMethod = `file: src/controllers/api/bloc.js - method: callAllBlocServices`
  try {
    const data = await blocService.callAll(nombre, apellido)
    return data
  } catch (error) {
    logger.error(`${fileMethod} | Error durante la consulta a BLOC: ${JSON.stringify(error)}`)
    throw error
  }
}

module.exports = {
  callAllBlocServices
}
