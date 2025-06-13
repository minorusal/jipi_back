'use strict'

const debug = require('debug')('old-api:followers-controller')
const boom = require('boom')
const followersService = require('../../services/followers')
const followStatus = { follow: 'Follow', unfollow: 'Unfollow' }
Object.freeze(followStatus)

const createFollow = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { body: { origen, destino } } = req

    if (origen === destino) return next(boom.badRequest('Un usuario no se puede seguir a si mismo'))

    const usersExist = await followersService.bothUsersExist(origen, destino)
    if (!usersExist) return next(boom.notFound('Usuarios no encontrados'))

    // ¿Origen ya sigue a destino?
    const yaSigue = await followersService.followsAlready(origen, destino)
    if (yaSigue) {
      // Max 50 unfollows por hora
      const totalUnfollows = await followersService.canUpdateFollowStatusRightNow(origen, followStatus.unfollow)
      if (totalUnfollows >= 50) return next(boom.tooManyRequests('Max 50 unfollows per hour'))
      // Ya lo sigue, por lo tanto se le va a dar unfollow
      await followersService.changeFollowStatus(origen, destino, followStatus.unfollow)
      return res.json({
        error: false,
        results: {
          follow: false,
          unfollow: true
        }
      })
    } else {
      // No lo sigue, por lo que se dará follow
      const unfollowsAlready = await followersService.unfollowsAlready(origen, destino)
      if (unfollowsAlready) {
        // ¿Editar el existente?
        await followersService.changeFollowStatus(origen, destino, followStatus.follow)
      } else {
        // ¿Crear nuevo registro?
        await followersService.follow(origen, destino)
      }
      return res.status(201).json({
        error: false,
        results: {
          follow: true,
          unfollow: false
        }
      })
    }
  } catch (err) {
    next(err)
  }
}

module.exports = {
  createFollow
}
