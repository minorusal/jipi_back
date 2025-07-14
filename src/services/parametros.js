'use strict'
const db = require('../lib/db')

class ParametrosService {
  constructor () {
    if (ParametrosService.instance) {
      return ParametrosService.instance
    }
    ParametrosService.instance = this
  }

  /**
   * Busca un parámetro por su nombre.
   * @param {string} nombre - El nombre del parámetro a buscar.
   * @returns {Promise<object|null>} - El objeto del parámetro o null si no se encuentra.
   */
  async getParametroPorNombre (nombre) {
    const parametro = await db.models.Parametro.findOne({
      where: { nombre }
    })
    return parametro
  }
}

const inst = new ParametrosService()
Object.freeze(inst)

module.exports = inst 