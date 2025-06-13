'use strict'

const debug = require('debug')('old-api:notifications-controller')
const boom = require('boom')
const uuid = require('uuid-base62')
const userService = require('../../services/users')
const notificationService = require('../../services/notifications')
const companiesService = require('../../services/companies')
const tokensService = require('../../services/tokens')

const getNotifications = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)

  try {
    const { query } = req
    const { usu_id: userID } = query

    // Verificar tipo de usuario
    const [usuario] = await userService.getById(userID)
    if (!usuario) return next(boom.badRequest('Usuario no existe'))
    const [empresa] = await userService.getEmpresaByUserId(userID)
    const { usu_tipo: tipo } = usuario
    const { emp_id: empresaID } = empresa

    const [quotesNoSeen] = await notificationService.quotesNoSeen(userID, tipo, empresaID)

    res.status(200).json({
      error: false,
      results: quotesNoSeen
    })
  } catch (err) {
    next(err)
  }
}

const getUserNotifications = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { params, query } = req
    const { user } = params
    let { number, page } = query

    number = number ? Math.abs(number) : 10
    page = page ? Math.abs(page) : 1

    if (isNaN(number) || isNaN(page)) return next(boom.badRequest('Bad query'))

    // Obtener alertas
    const notifications = await notificationService.getAlertsByUser(user, page, number)
    
    // Obtener las notificaciones no leídas
    const noLeidas = notifications.filter(n => n.visto === 0)

    res.status(200).json({
      error: false,
      results: {
        total: notifications.length,
        page: page ? Number(page) : 1,
        not_seen: noLeidas.length,
        notifications
      }
    })
  } catch (err) {
    next(err)
  }
}

const createNotificationToCot = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { body } = req

    // ¿Existen los usuarios?
    const [origen] = await userService.getById(body.origen)
    if (!origen) return next(boom.badRequest('Origen incorrecto'))

    

  } catch (error) {
    
  }
}

const createNotification = async (req, res, next) => {
  try {
    const { body } = req
    const notificacion = await notificationService.consumeSPInsertar_consultar_notificacion(body)
    res.status(200).json({
      error: false,
      results: {
        notificacion
      }
    })
  } catch (err) {
    next(err)
  }
}

const deleteNotification = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { body, params } = req
    const { uuid } = params

    // Eliminar notificación
    const { affectedRows: total } = await notificationService.deleteAlert(body, uuid)
    // Si no se encontró 400
    if (total === 0) return next(boom.badRequest('Notification not found'))

    res.status(200).json({
      error: false,
      results: {
        total,
        notification: {
          uuid,
          ...body
        }
      }
    })
  } catch (err) {
    next(err)
  }
}

const editNotification = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { params } = req
    const { uuid } = params

    // Obtener notificación actual
    const [notificacion] = await notificationService.getAlertById(uuid)
    if (!notificacion) {
      return next(boom.badRequest('Invalid ID'))
    }
    const { visto } = notificacion
    // Si está en 0 pasarla a 1
    // Si está en 1 pasarla a 0
    if (visto === 0) {
      await notificationService.updateAlert(uuid, 1)
    } else {
      await notificationService.updateAlert(uuid, 0)
    }
    res.status(200).json({
      error: false,
      results: {
        edited: true
      }
    })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  getNotifications,
  getUserNotifications,
  createNotification,
  deleteNotification,
  editNotification
}
