'use strict'

const debug = require('debug')('old-api:tokens-controller')
const boom = require('boom')
const { externalJWTOptions: { secretKey: companySecretKey, companyExpiresTime } } = require('../../config')
const tokensService = require('../../services/tokens')
const createTokenJWT = require('../../utils/createTokenJWT')

const createCompaniesTokens = async (req, res, next) => {
  try {
    const companies = await tokensService.getCompaniesWithoutToken()

    const newCompaniesRes = []

    for (let i = 0; i < companies.length; i++) {
      const { token } = await createTokenJWT({
        idEmpresa: companies[i].emp_id,
        creationDate: new Date(),
        scopes: ['customer:create', 'customer:read', 'customer:update', 'customer:delete']
      }, companyExpiresTime, companySecretKey)

      newCompaniesRes[i] = await tokensService.insertCompanyToken(token, companies[i].emp_id)
    }

    return res.json({
      error: false,
      newCompaniesRes
    })
  } catch (error) {
    next(error)
  }
}

const createToken = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { body: { usuario, token, tipo } } = req

    // Revisar si este token ya existe para alguien mas
    const [usuariosToken] = await tokensService.getUserByToken(token)
    let tokenCreado = null

    // Si no existe crear token
    if (!usuariosToken) {
      const { affectedRows } = await tokensService.createToken(usuario, token, tipo)
      tokenCreado = affectedRows
    } else {
      const { affectedRows } = await tokensService.updateToken(usuario, token)
      tokenCreado = affectedRows
    }

    return res.json({
      error: false,
      results: {
        tokenCreado
      }
    })
  } catch (err) {
    next(err)
  }
}

const getUserTokens = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const { params } = req
    const { user } = params

    const tokens = await tokensService.getToken(user)

    return res.json({
      error: false,
      results: {
        tokens
      }
    })
  } catch (err) {
    next(err)
  }
}

const deleteToken = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const { params: { token, type } } = req

    const deleted = await tokensService.deleteToken(token, type)
    if (!deleted) return next(boom.badRequest('Wrong token'))

    return res.json({
      error: false,
      results: {
        deleted
      }
    })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  createToken,
  getUserTokens,
  deleteToken,
  createCompaniesTokens
}
