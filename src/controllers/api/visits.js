'use strict'

const debug = require('debug')('old-api:visits-controller')
const boom = require('boom')
const visitsService = require('../../services/visits')
const userService = require('../../services/users')

const getVisits = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    let { query: { user, number, page } } = req

    user = Math.abs(user) || 0
    number = Math.abs(number) || 10
    page = Math.abs(page) || 1

    // ¿Existe usuario?
    const [existeUsuario] = await userService.getUsersIds([user])
    if (!existeUsuario) return next(boom.badRequest('No existe el usuario'))

    const visitas = await visitsService.getLatestsVisits(user, number, page)
    const total = visitas.length || 0
    const certificadas = visitas.filter(v => v.emp_certificada === 1).length
    const seguidores = visitas.filter(v => v.seguidor === 1).length
    const compradores = visitas.filter(v => v.usu_tipo === 2).length
    const vendedores = visitas.filter(v => v.usu_tipo === 1).length
    const admins = visitas.filter(v => v.usu_tipo === 3).length
    const companiesIDs = visitas.map(v => v.emp_id)

    const countriesAndEstates = await visitsService.getCountries(companiesIDs)

    return res.json({
      error: false,
      results: {
        page,
        total,
        visitas,
        details: {
          certificadas,
          seguidores,
          compradores,
          vendedores,
          admins,
          ...countriesAndEstates
        }
      }
    })
  } catch (err) {
    next(err)
  }
}

const createVisit = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { body: { origen, destino } } = req

    // ¿El origen y destino es el mismo?
    if (origen === destino) return next(boom.badRequest('Origen y destino igual'))

    // ¿Existen los usuarios?
    const existenUsuarios = await userService.getUsersIds([origen, destino])
    if (!existenUsuarios || existenUsuarios.length < 2) return next(boom.badRequest('Usuario no existe'))

    // ¿Son de la misma empresa?
    const [empresaOrigen] = await userService.getEmpresaByUserId(origen)
    const [empresaDestino] = await userService.getEmpresaByUserId(destino)
    const { emp_id: empresaOrigenID } = empresaOrigen
    const { emp_id: empresaDestinoID } = empresaDestino
    if (empresaOrigenID === empresaDestinoID) return next(boom.badRequest('Misma empresa'))

    // ¿Existe visita previa?
    const [visitaPrevia] = await visitsService.getPreviousVisit(origen, destino)
    if (!visitaPrevia) {
      // Si no existe crearla
      await visitsService.createVisit(origen, destino)
    } else {
      // Si existe actualizarla
      await visitsService.updateVisit(origen, destino)
    }

    return res.json({
      error: false,
      results: {
        visited: true
      }
    })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  getVisits,
  createVisit
}
