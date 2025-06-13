'use strict'

// Este error personalizado es utilizado en todo lo relacionado a las rutas de
// Hades, ya que Hades es el encargado del puente entre Arcsa y MC

class CronosError extends Error {
  constructor (error, statusCode) {
    super('Error with Cronos service')
    this.name = 'CronosError'
    this.err = {
      error,
      statusCode
    }
  }
}

module.exports = CronosError
