'use strict'

const debug = require('debug')('old-api:messages-router')
const boom = require('boom')
const uuid = require('uuid-base62')
const messagesService = require('../../services/messages')
const userService = require('../../services/users')
const companiesService = require('../../services/companies')
const getCompanyTurn = require('../../utils/companyTurn')

const getMessages = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    let { query: { user: userID } } = req
    userID = Math.abs(userID) || 0

    // ¿Existe usuario?
    const [user] = await userService.getById(userID)
    if (!user) return next(boom.badRequest('User not found'))

    const chatRoomsRaw = await messagesService.getChatRoomsByUser(userID)
    if (chatRoomsRaw.length === 0) return next(boom.badRequest('No chat rooms for this user'))

    const chatRoomsList = chatRoomsRaw.map(c => c.sala_uuid)
    const rooms = []
    for (let i = 0; i < chatRoomsList.length; i++) {
      const room = chatRoomsList[i]
      const [chatRoom] = await messagesService.getChatRoomByUuid(room)
      const [notSeen] = await messagesService.getMessagesNotSeenTotal(room, userID)
      const [lastMessage] = await messagesService.getLastMessageFromARoom(room)
      chatRoom.messages = {
        not_seen: notSeen.total,
        last_message: lastMessage || null
      }
      rooms.push(chatRoom)
    }

    return res.json({
      error: false,
      results: {
        total: rooms.length || 0,
        rooms
      }
    })
  } catch (err) {
    next(err)
  }
}

const getRoomDetails = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { params: { roomUUID } } = req
    let { query: { user: userID } } = req

    userID = Math.abs(userID) || 0

    // ¿Existe usuario?
    const [user] = await userService.getById(userID)
    if (!user) return next(boom.badRequest('User not found'))

    const [room] = await messagesService.getChatRoomByUuid(roomUUID)
    if (!room) return next(boom.badRequest('Chat room does not exists'))

    const messages = await messagesService.getMessagesFromChatRoom(roomUUID)
    const [notSeen] = await messagesService.getMessagesNotSeenTotal(roomUUID, userID)

    return res.json({
      error: false,
      results: {
        total: messages.length || 0,
        not_seen: notSeen.total || 0,
        room,
        messages
      }
    })
  } catch (err) {
    next(err)
  }
}

const deleteMessage = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { params } = req
    const { roomUUID, messageUUID, userID } = params

    const { affectedRows: deletedMessages } = await messagesService.deleteMessageFromChatRoom(roomUUID, messageUUID, userID)
    if (deletedMessages !== 1) return next(boom.badRequest('Error while deleting message'))

    return res.json({
      error: false,
      results: {
        deleted: true
      }
    })
  } catch (err) {
    next(err)
  }
}

const changeSeenStatus = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { body, params } = req
    const { messages, status } = body
    const { roomUUID } = params

    // Check status
    if (status === 'Seen') {
      body.status = 1
    } else {
      body.status = 0
    }

    // Cambiar el estatus
    const updated = []
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i]
      const { affectedRows: updatedMessages } = await messagesService.updateMessageSeenStatus(body, roomUUID, message)
      if (updatedMessages === 1) {
        updated.push(message)
      }
    }

    return res.json({
      error: false,
      results: {
        total: updated.length || 0,
        updated
      }
    })
  } catch (err) {
    next(err)
  }
}

const createChatRoom = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { body } = req
    const { user: buyerID, company: companySeller } = body

    // ¿Existe usuario y empresa?
    const [buyer] = await userService.getById(buyerID)
    if (!buyer) return next(boom.badRequest('User not found'))
    const [company] = await companiesService.getEmpresa(companySeller)
    if (!company) return next(boom.badRequest('Company not found'))

    // Obtener detalles para crear sala
    const [companyBuyerRaw] = await userService.getEmpresaByUserId(buyerID)
    const { emp_id: companyBuyer } = companyBuyerRaw

    // ¿El usuario intenta comunicarse con su propia empresa?
    if (companyBuyer === companySeller) return next(boom.badRequest('Same company'))

    const uuidRoom = `${uuid.v4()}${uuid.v4()}`

    // ¿Existe una sala entre este usuario y esta empresa?
    const [roomExists] = await messagesService.getChatRoom(buyerID, companySeller)
    if (roomExists) return next(boom.badRequest('Room already exists'))

    // Crear sala entre usuario y empresa
    const sellerID = await getCompanyTurn(companySeller)

    await messagesService.createChatRoom(uuidRoom, buyerID, sellerID, companyBuyer, companySeller)

    // Crear mensaje en sala de chat
    const uuidMessage = `${uuid.v4()}${uuid.v4()}`
    const { message } = body
    await messagesService.createChatMessage(uuidRoom, uuidMessage, buyerID, message)
    const [messageCreated] = await messagesService.getMessageDetailsByUuid(uuidRoom, uuidMessage)

    return res.json({
      error: false,
      results: {
        created: true,
        uuid: uuidRoom,
        message: messageCreated
      }
    })
  } catch (err) {
    next(err)
  }
}

const createMessage = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { body } = req

    // Revisar si existe sala de chat
    const { uuid: roomUuid } = body
    const [roomDetails] = await messagesService.getChatRoomByUuid(roomUuid)
    if (!roomDetails) return next(boom.badRequest('Chat room does not exists'))

    // Revisar si el usuario existe en esta sala
    const { user } = body
    const { usuario_comprador: buyer, usuario_vendedor: seller } = roomDetails
    if (user !== buyer && user !== seller) return next(boom.badRequest('Wrong user'))

    // Genera uuid de mensaje
    const messageUuid = `${uuid.v4()}${uuid.v4()}`

    // Genera mensaje
    const { message, product } = body
    const { affectedRows: messagesCreated } = await messagesService.createChatMessage(roomUuid, messageUuid, user, message, product)
    if (messagesCreated !== 1) return next(boom.badRequest('Message not created'))

    // Obtener detalles de mensaje
    const [messageCreated] = await messagesService.getMessageDetailsByUuid(roomUuid, messageUuid)

    return res.json({
      error: false,
      results: {
        created: true,
        message_created: messageCreated,
        users: {
          buyer,
          seller
        }
      }
    })
  } catch (err) {
    next(err)
  }
}

const getChatRoomByCompany = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    let { query: { user, company } } = req
    user = Math.abs(user) || 0
    company = Math.abs(company) || 0

    const room = await messagesService.getChatRoomByUserAndCompany(user, company)
    if (!room) return next(boom.notFound('Chat room not found'))
    return res.json({
      error: false,
      results: {
        room
      }
    })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  getMessages,
  getRoomDetails,
  deleteMessage,
  changeSeenStatus,
  createChatRoom,
  createMessage,
  getChatRoomByCompany
}
