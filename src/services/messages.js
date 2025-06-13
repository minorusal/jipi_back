'use strict'
const debug = require('debug')('old-api:messages-service')
const mysqlLib = require('../lib/db')

class MessagesService {
  constructor () {
    if (MessagesService.instance == null) {
      this.messagesTable = 'chat_empresa_mensajes'
      this.table = 'chat_empresa_salas'
      MessagesService.instance = this
    }
    return MessagesService.instance
  }

  async createChatRoom (uuid, buyer, seller, buyerCompany, sellerCompany) {
    debug('messages->createChatRoom')
    const queryString = `
      INSERT INTO ${this.table}
      (sala_uuid, usuario_comprador, usuario_vendedor, empresa_compradora, empresa_vendedora)
      VALUES
      ('${uuid}', ${buyer}, ${seller}, ${buyerCompany}, ${sellerCompany})
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getChatRoom (buyer, sellerCompany) {
    debug('messages->getChatRoom')
    const queryString = `
      SELECT * FROM ${this.table}
      WHERE
      usuario_comprador = ${buyer}
      AND empresa_vendedora = ${sellerCompany}
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getChatRoomByUuid (uuid) {
    debug('messages->getChatRoomByUuid')
    const queryString = `
      SELECT
        s.*,
        uc.usu_nombre AS "usuario_comprador_nombre",
        uc.usu_app AS "usuario_comprador_app",
        uc.usu_puesto AS "usuario_comprador_puesto",
        uc.usu_email AS "usuario_comprador_email",
        uc.usu_foto AS "usuario_comprador_foto",
        uv.usu_nombre AS "usuario_vendedor_nombre",
        uv.usu_app AS "usuario_vendedor_app",
        uv.usu_puesto AS "usuario_vendedor_puesto",
        uv.usu_email AS "usuario_vendedor_email",
        uv.usu_foto AS "usuario_vendedor_foto",
        ec.emp_nombre AS "empresa_compradora_nombre",
        ec.emp_razon_social AS "empresa_compradora_razon_social",
        ec.emp_website AS "empresa_compradora_website",
        ec.emp_logo AS "empresa_compradora_logo",
        ec.emp_banner AS "empresa_compradora_banner",
        ec.emp_certificada AS "empresa_compradora_certificada",
        ev.emp_nombre AS "empresa_vendedora_nombre",
        ev.emp_razon_social AS "empresa_vendedora_razon_social",
        ev.emp_website AS "empresa_vendedora_website",
        ev.emp_logo AS "empresa_vendedora_logo",
        ev.emp_banner AS "empresa_vendedora_banner",
        ev.emp_certificada AS "empresa_vendedora_certificada"
      FROM ${this.table} AS s
      JOIN usuario AS uc ON uc.usu_id = s.usuario_comprador
      JOIN usuario AS uv ON uv.usu_id = s.usuario_vendedor
      JOIN empresa AS ec ON ec.emp_id = s.empresa_compradora
      JOIN empresa AS ev ON ev.emp_id = s.empresa_vendedora
      WHERE s.sala_uuid = '${uuid}'
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async createChatMessage (room, messageUuid, user, message, product = null) {
    debug('messages->createChatMessage')
    const queryString = `
      INSERT INTO ${this.messagesTable}
      (sala_uuid, mensaje_uuid, usuario, mensaje, producto_id)
      VALUES
      ('${room}', '${messageUuid}', ${user}, '${message}', ${product})
    `
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getMessagesFromChatRoom (room) {
    debug('messages->getMessagesFromChatRoom')
    const queryString = `
      SELECT
        mensaje_uuid,
        usuario,
        mensaje,
        visto,
        producto_id,
        fecha_creacion
      FROM ${this.messagesTable}
      WHERE sala_uuid = '${room}'
      ORDER BY fecha_creacion ASC
    `
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getChatRoomsByUser (user) {
    debug('messages->getChatRoomsByUser')
    const queryString = `
      SELECT *
      FROM chat_empresa_salas
      WHERE usuario_comprador = ${user}
      OR usuario_vendedor = ${user}
    `
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async deleteMessageFromChatRoom (room, message, user) {
    debug('messages->deleteMessageFromChatRoom')
    const queryString = `
      DELETE FROM ${this.messagesTable}
      WHERE sala_uuid = '${room}'
      AND mensaje_uuid = '${message}'
      AND usuario = ${user}
      LIMIT 1
    `
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getMessagesNotSeenTotal (room, user) {
    debug('messages->getMessagesNotSeenTotal')
    const queryString = `
      SELECT COUNT(*) AS "total"
      FROM ${this.messagesTable}
      WHERE sala_uuid = '${room}'
      AND usuario <> ${user}
      AND visto = 0
    `
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getLastMessageFromARoom (room) {
    debug('messages->getLastMessageFromARoom')
    const queryString = `
      SELECT
        mensaje_uuid,
        usuario,
        mensaje,
        visto,
        producto_id,
        fecha_creacion
      FROM ${this.messagesTable}
      WHERE sala_uuid = '${room}'
      ORDER BY fecha_creacion DESC
      LIMIT 1
    `
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async updateMessageSeenStatus ({ user, status }, room, message) {
    debug('messages->updateMessageSeenStatus')
    const queryString = `
      UPDATE ${this.messagesTable}
      SET
        visto = ${status}
      WHERE sala_uuid = '${room}'
      AND mensaje_uuid = '${message}'
      AND usuario <> ${user}
      AND visto <> ${status}
    `
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getMessageDetailsByUuid (room, message) {
    debug('messages->getMessageDetailsByUuid')
    const queryString = `
      SELECT * FROM ${this.messagesTable}
      WHERE mensaje_uuid = '${message}'
      AND sala_uuid = '${room}'
    `
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getChatRoomByUserAndCompany (user, company) {
    debug('messages->getChatRoomByUserAndCompany')
    const queryString = `
      SELECT * FROM ${this.table}
      WHERE (
        usuario_comprador = ${user}
        OR usuario_vendedor = ${user}
      )
      AND (
        empresa_compradora = ${company}
        OR empresa_vendedora = ${company}
      )
    `
    debug(queryString)
    const { result: resultRaw } = await mysqlLib.query(queryString)
    const [result] = resultRaw
    return result || null
  }
}

const inst = new MessagesService()
Object.freeze(inst)

module.exports = inst
