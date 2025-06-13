'use strict'

const debug = require('debug')('old-api:friends-router')
const boom = require('boom')
const friendService = require('../../services/friends')
const followersService = require('../../services/followers')

const getFriends = async function (req, res, next) {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const { query } = req

    const friends = await friendService.get(query)

    const { web } = query

    let friendGrouped = null

    if (web === 'true') {
      friendGrouped = friends.reduce((bv, cv, i) => {
        // SI EL USUARIO ORIGEN ES EL USUARIO EN SESION Y HA ENVIADO UNA SOLICITUD DE AMISTAD
        if (cv.usuario_origen_id == query.usuario_id) {
          const status = cv.amistad_estatus
          if (status === 1) {
            // Agregar a amistades
            bv.amistades.push(cv)
          } else if (status === 2) {
            bv.invitaciones.push(cv)
          }
        } else if (cv.usuario_amigo_id == query.usuario_id) {
          // SI EL USUARIO AMIGO ES EL USUARIO EN SESION Y HA RECIBIDO UNA SOLICITUD DE AMISTAD
          const status = cv.amistad_estatus
          if (status === 1) {
            bv.amistades.push(cv)
          } else if (status === 2) {
            bv.invitaciones.push(cv)
          }
        }
        return bv
      }, { invitaciones: [], amistades: [] })
    } else {
      friendGrouped = friends.reduce((bv, cv) => {
        // SI EL USUARIO ORIGEN ES EL USUARIO EN SESION Y HA ENVIADO UNA SOLICITUD DE AMISTAD
        if (cv.usuario_origen_id == query.usuario_id) {
          const status = cv.amistad_estatus
          if (status === 1) {
            // Agregar a amistades
            bv.amistades.push({
              usuario_origen_id: cv.usuario_amigo_id,
              usuario_origen_nombre: cv.usuario_amigo_nombre,
              usuario_origen_apellido: cv.usuario_amigo_apellido,
              usuario_origen_puesto: cv.usuario_amigo_puesto,
              usuario_origen_email: cv.usuario_amigo_email,
              usuario_origen_verificado: cv.usuario_amigo_verificado,
              usuario_origen_avatar: cv.usuario_amigo_avatar,
              usuario_origen_tipo: cv.usuario_amigo_tipo,
              amistad_tipo: cv.amistad_tipo,
              amistad_fecha: cv.amistad_fecha,
              amistad_estatus: cv.amistad_estatus,
              empresa_amigo_id: cv.empresa_amigo_id,
              empresa_amigo_nombre: cv.empresa_amigo_nombre,
              empresa_amigo_razon_social: cv.empresa_amigo_razon_social,
              empresa_amigo_web: cv.empresa_amigo_web,
              empresa_amigo_logo: cv.empresa_amigo_logo,
              empresa_amigo_banner: cv.empresa_amigo_banner,
              empresa_amigo_certificada: cv.empresa_amigo_certificada
            })
          }
        } else if (cv.usuario_amigo_id == query.usuario_id) {
          // SI EL USUARIO AMIGO ES EL USUARIO EN SESION Y HA RECIBIDO UNA SOLICITUD DE AMISTAD
          const status = cv.amistad_estatus
          if (status === 1) {
            bv.amistades.push({
              usuario_origen_id: cv.usuario_origen_id,
              usuario_origen_nombre: cv.usuario_origen_nombre,
              usuario_origen_apellido: cv.usuario_origen_apellido,
              usuario_origen_puesto: cv.usuario_origen_puesto,
              usuario_origen_email: cv.usuario_origen_email,
              usuario_origen_verificado: cv.usuario_origen_verificado,
              usuario_origen_avatar: cv.usuario_origen_avatar,
              usuario_origen_tipo: cv.usuario_origen_tipo,
              amistad_tipo: cv.amistad_tipo,
              amistad_fecha: cv.amistad_fecha,
              amistad_estatus: cv.amistad_estatus,
              empresa_amigo_id: cv.empresa_origen_id,
              empresa_amigo_nombre: cv.empresa_origen_nombre,
              empresa_amigo_razon_social: cv.empresa_origen_razon_social,
              empresa_amigo_web: cv.empresa_origen_web,
              empresa_amigo_logo: cv.empresa_origen_logo,
              empresa_amigo_banner: cv.empresa_origen_banner,
              empresa_amigo_certificada: cv.empresa_origen_certificada
            })
          } else if (status === 2) {
            bv.invitaciones.push({
              usuario_origen_id: cv.usuario_origen_id,
              usuario_origen_nombre: cv.usuario_origen_nombre,
              usuario_origen_apellido: cv.usuario_origen_apellido,
              usuario_origen_puesto: cv.usuario_origen_puesto,
              usuario_origen_email: cv.usuario_origen_email,
              usuario_origen_verificado: cv.usuario_origen_verificado,
              usuario_origen_avatar: cv.usuario_origen_avatar,
              usuario_origen_tipo: cv.usuario_origen_tipo,
              amistad_tipo: cv.amistad_tipo,
              amistad_fecha: cv.amistad_fecha,
              amistad_estatus: cv.amistad_estatus,
              empresa_amigo_id: cv.empresa_origen_id,
              empresa_amigo_nombre: cv.empresa_origen_nombre,
              empresa_amigo_razon_social: cv.empresa_origen_razon_social,
              empresa_amigo_web: cv.empresa_origen_web,
              empresa_amigo_logo: cv.empresa_origen_logo,
              empresa_amigo_banner: cv.empresa_origen_banner,
              empresa_amigo_certificada: cv.empresa_origen_certificada
            })
          }
        }
        return bv
      }, { invitaciones: [], amistades: [] })
    }

    friendGrouped.amistades = friendGrouped.amistades.reduce((bv, cv) => {
      if (cv.amistad_tipo === 1 && cv.amistad_estatus === 1) {
        bv.proveedor.push(cv)
      } else if (cv.amistad_tipo === 2 && cv.amistad_estatus === 1) {
        bv.cliente.push(cv)
      }
      return bv
    }, { cliente: [], proveedor: [] })

    res.status(200).json({
      error: false,
      results: friendGrouped
    })
  } catch (err) {
    next(err)
  }
}

const refuseFriendship = async function (req, res, next) {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const { body } = req
    debug(body)

    const [existFriendship] = await friendService.findOne(body)
    if (!existFriendship) return next(boom.badRequest('Friendship does not exist...'))

    const { usu_id_amigo: userA, usu_id_origen: userB } = body
    const canDeleteFriendship = await friendService.canDeleteFriendship(userA, userB)
    if (!canDeleteFriendship) return next(boom.badRequest('Friendship can\t be deleted'))

    await friendService.refuseOrDelete(body)

    res.status(200).json({
      error: false,
      pageNumber: null,
      numberEntries: null,
      results: {
        refused: true,
        ...body
      }
    })
  } catch (err) {
    next(err)
  }
}

const checkFriendship = async function (req, res, next) {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const { params } = req
    let { myId, userId } = params

    myId = Math.abs(myId) || 0
    userId = Math.abs(userId) || 0

    const [amistad] = await friendService.areFriends({ myId, userId })
    const follower = await followersService.followsAlready(userId, myId)
    const following = await followersService.followsAlready(myId, userId)

    return res.json({
      error: false,
      results: {
        friends: Boolean(amistad),
        follower,
        following
      }
    })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  getFriends,
  refuseFriendship,
  checkFriendship
}
