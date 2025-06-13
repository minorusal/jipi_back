'use strict'

const debug = require('debug')('old-api:statistics-service')
const mysqlLib = require('../lib/db')

const mostRepeated = require('../utils/mostRepeatedInArray')

class StatisticService {
  constructor () {
    if (StatisticService.instance == null) {
      this.table = 'publicaciones'
      StatisticService.instance = this
    }
    return StatisticService.instance
  }

  async getProspectos (empresa) {
    debug('StatisticService -> getProspectos')
    const queryString = `
      SELECT
        emp_id_comprador, count(*) AS 'total'
      FROM cotizacion
      WHERE
      emp_id_vendedor = ${empresa}
      AND cot_status <> 2
      AND cot_status <> 5
      GROUP BY emp_id_comprador
    `
    const { result: companies } = await mysqlLib.query(queryString)
    const total = companies.length
    return total
  }

  async getVentas (empresa) {
    debug('StatisticService -> getVentas')

    const queryString = `
      SELECT
        COUNT(*) as 'total'
      FROM cotizacion as c
      JOIN empresa_usuario AS eu
      ON eu.usu_id = c.usu_id_comprador
      WHERE
        c.emp_id_vendedor = ${empresa}
      AND cot_status = 2
    `

    const { result } = await mysqlLib.query(queryString)
    debug(queryString)

    return result
  }

  async getOpiniones (empresa) {
    debug('StatisticService -> getOpiniones')

    const queryString = `
      SELECT
        COUNT(*) as 'total'
      FROM cotizacion as c
      JOIN empresa_usuario AS eu
      ON eu.usu_id = c.usu_id_comprador
      WHERE
        c.emp_id_vendedor = ${empresa}
      AND cot_status = 2;
    `

    const { result } = await mysqlLib.query(queryString)
    debug(queryString)

    return result
  }

  async getCompras (empresa) {
    debug('StatisticService -> getCompras')

    const queryString = `
      SELECT
        COUNT(*) AS 'total'
      FROM cotizacion
      WHERE usu_id_comprador IN (
        SELECT usu_id
        FROM empresa_usuario
        WHERE emp_id = ${empresa}
      )
      AND cot_status = 2
    `

    const { result } = await mysqlLib.query(queryString)
    debug(queryString)

    return result
  }

  async getContactos (empresa) {
    debug('StatisticService -> getCompras')

    const queryString = `
      SELECT COUNT(*) AS 'total'
      FROM network
      WHERE usu_id_origen IN (
        SELECT usu_id
        FROM empresa_usuario
        WHERE emp_id = ${empresa}
      )
      OR usu_id_amigo IN (
        SELECT usu_id
        FROM empresa_usuario
        WHERE emp_id = ${empresa}
      )
    `

    const { result } = await mysqlLib.query(queryString)
    debug(queryString)

    return result
  }

  async getQuotesDeal (empresa) {
    debug('quoteService -> getQuotesDeal')

    const queryString = `
      SELECT COUNT(*) as total
      FROM cotizacion
      WHERE emp_id_vendedor = ${empresa}
      AND cot_status = 2
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getClientesDeEmpresa (empresa) {
    debug('quoteService -> getClientesDeEmpresa')

    const queryString = `
      SELECT COUNT(*) as 'total'
      FROM (
        SELECT
          usu_id_comprador,
          COUNT(*)
        FROM cotizacion
        WHERE emp_id_vendedor = ${empresa}
        GROUP BY usu_id_comprador
      ) AS c
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getProveedoresDeUsuario (usuario) {
    debug('quoteService -> getProveedoresDeEmpresa')

    const queryString = `
      SELECT COUNT(*) AS 'total'
      FROM (
        SELECT emp_id_vendedor, COUNT(*) FROM cotizacion
        WHERE usu_id_comprador = ${usuario}
        GROUP BY emp_id_vendedor
      ) AS c
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getPromediosExperienciaEmpresa (empresa) {
    debug('quoteService -> getPromediosExperienciaEmpresa')

    const queryString = `
      SELECT
        TRUNCATE(AVG(tiempo), 2) AS 'tiempo',
        TRUNCATE(AVG(calidad), 2) AS 'calidad',
        TRUNCATE(AVG(servicio), 2) AS 'servicio'
      FROM cot_experiencia AS ce
      JOIN cotizacion AS c
      ON c.cot_id = ce.cot_id
      WHERE c.emp_id_vendedor = ${empresa}
      AND ce.estatus = 'Activo'
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getComprasDeUsuario (usuario) {
    debug('quoteService -> getComprasDeUsuario')

    const queryString = `
      SELECT COUNT(*) AS 'total'
      FROM cotizacion
      WHERE usu_id_comprador = ${usuario}
      AND cot_status = 2
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getProspectosDeUsuario (usuario) {
    debug('quoteService -> getProspectosDeUsuario')

    const queryString = `
      SELECT
        cot_father_id,
        count(*) AS 'total'
      FROM cotizacion AS c
      JOIN cot_bitacora AS cb
      ON cb.cot_children_id = c.cot_id
      WHERE c.usu_id_comprador = ${usuario}
      AND c.cot_status = 1
      GROUP BY cot_father_id
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getSeguidores (usuario) {
    debug('quoteService -> getSeguidores')

    const queryString = `
      SELECT
        COUNT(*) AS "total"
      FROM seguidores
      WHERE usuario_destino = ${usuario}
      AND estatus = 'Follow'
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getTotalProductos () {
    debug('quoteService -> getTotalProductos')

    const queryString = `
      SELECT
        COUNT(*) AS "total"
      FROM producto
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getTotalEmpresasVendedoras () {
    debug('quoteService -> getTotalEmpresasVendedoras')

    const queryString = `
      SELECT c.emp_id_vendedor, count(*)
      FROM empresa AS e
      JOIN cotizacion AS c ON c.emp_id_vendedor = e.emp_id
      GROUP BY c.emp_id_vendedor
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getDealsDiarios () {
    debug('quoteService -> getDealsDiarios')

    const queryString = `
      SELECT created_at, count(*) AS 'total'
      FROM cotizacion
      WHERE cot_status = 2
      GROUP BY created_at
      ORDER BY created_at ASC
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getUltimasCotizacionesDetalles () {
    debug('quoteService -> getUltimasCotizacionesDetalles')

    const queryString = `
      SELECT
        c.cot_id,
        c.created_at AS "fecha",
        pt.nombre AS "pais",
        et.nombre AS "estado"
      FROM cotizacion as c
      LEFT JOIN cot_bitacora AS cb ON cb.cot_father_id = c.cot_id
      JOIN domicilio AS d ON d.domicilio_id = c.domicilio_id
      JOIN estado AS e ON e.estado_id = d.estado_id
      JOIN pais_translate AS pt ON pt.pais_id = e.pais_id
      JOIN estado_translate AS et ON et.estado_id = e.estado_id
      WHERE pt.idioma_id = 1
      GROUP BY c.cot_id
      ORDER BY c.cot_id DESC
      LIMIT 10
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getUltimasCotizacionesProductos (quote) {
    debug('quoteService -> getUltimasCotizacionesProductos')

    const queryString = `
      select pt.prod_id, pt.prod_nombre
      from cot_productos as cp
      join producto_translate as pt on pt.prod_id = cp.prod_id
      where cp.cot_id = ${quote}
      and pt.prod_nombre <> ""
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getProductosEmpresasVerificadas (quote) {
    debug('quoteService -> getProductosEmpresasVerificadas')

    const queryString = `
      SELECT
        p.prod_id,
        p.prod_precio_lista,
        p.prod_precio_promo,
        p.prod_precio_envio,
        p.prod_compra_minima,
        p.prod_cobertura_loc,
        p.prod_cobertura_nac,
        p.prod_cobertura_int,
        p.prod_marca,
        e.emp_id,
        e.emp_nombre,
        e.emp_razon_social,
        e.emp_logo,
        e.emp_banner,
        e.emp_certificada,
        pt.prod_nombre,
        pt.prod_desc,
        pt.prod_video
      FROM producto AS p
      JOIN empresa AS e ON e.emp_id = p.emp_id
      JOIN producto_translate AS pt ON pt.prod_id = p.prod_id
      WHERE e.emp_certificada = 1
      AND pt.prod_nombre <> ""
      LIMIT 10
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getCompanyMovements (company) {
    debug('quoteService -> getCompanyMovements')

    const queryString = `
      SELECT COUNT(*) as total
      FROM cotizacion
      WHERE emp_id_vendedor = ${company}
      OR emp_id_comprador = ${company}
      AND cot_status = 2
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getMostSelledProducts () {
    debug('quoteService -> getMostSelledProducts')
    const queryString = `
      SELECT
        prod_id, count(*) as "total"
      FROM cot_productos
      GROUP BY prod_id
      ORDER BY total DESC
      LIMIT 10
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  /**
   * 
   * Se realiza nuevo metodo que consulta productos cotizados de un usuario
   * implementando el nuevo flujo de cotizaciones
   */

  async getHistoricalSalesV2 (user) {
    const queryString = `
      SELECT
      SUM(cp.cantidad * cp.precio_unitario) AS total
      FROM productos_cotizados AS cp
      JOIN cotizaciones AS c USING(cotizacion_id)
      WHERE
        c.estatus = 'pagada'
        AND c.user_id = ${user}
    `
    const { result: resultRaw } = await mysqlLib.query(queryString)
    const [result] = resultRaw
    const { total } = result
    return total
  }

  async getHistoricalSales (user) {
    debug('quoteService -> getHistoricalSales')
    const queryString = `
      SELECT
        SUM(cp.cp_cantidad * COALESCE(cp.cot_mejorprecio, cp.cp_precio)) AS 'total'
      FROM cot_productos AS cp
      JOIN cotizacion AS c USING(cot_id)
      WHERE
        c.cot_status = 2
        AND c.usu_id_vendedor = ${user}
    `
    const { result: resultRaw } = await mysqlLib.query(queryString)
    const [result] = resultRaw
    const { total } = result
    return total
  }

  async getTotalConversations (user) {
    debug('quoteService -> getTotalConversations')
    const queryString = `
      SELECT
      sala_uuid, count(*) AS 'total_mensajes'
      FROM chat_empresa_mensajes
      WHERE usuario = ${user}
      GROUP by sala_uuid
    `
    const { result } = await mysqlLib.query(queryString)
    const total = result.length
    return total
  }

  async getAverageTimeToRespond (user) {
    debug('quoteService -> getAverageTimeToRespond')
    const queryString = `
      SELECT SEC_TO_TIME(AVG(TIME_TO_SEC(fecha_creacion))) AS "time"
      FROM chat_empresa_mensajes WHERE usuario = ${user} ORDER BY fecha_creacion;
    `
    const { result: resultRaw } = await mysqlLib.query(queryString)
    const [result] = resultRaw
    const { time } = result
    return time
  }

  async getTimeFrameSalesAmount (user, start, finish) {
    debug('quoteService -> getTimeFrameSalesAmount')
    const queryString = `
      SELECT
        SUM(cp.cp_cantidad * COALESCE(cp.cot_mejorprecio, cp.cp_precio)) AS 'total'
      FROM cot_productos AS cp
      JOIN cotizacion AS c USING(cot_id)
      WHERE c.cot_status = 2 AND c.usu_id_vendedor = ${user}
      AND c.created_at BETWEEN '${start}' AND '${finish}'
    `
    const { result: resultRaw } = await mysqlLib.query(queryString)
    const [result] = resultRaw
    const { total } = result
    return total
  }

  async getTimeFrameSalesQuotes (user, start, finish) {
    debug('quoteService -> getTimeFrameSalesQuotes')
    const queryString = `
      SELECT COUNT(*) AS 'total'
      FROM cot_productos AS cp
      JOIN cotizacion AS c USING(cot_id)
      WHERE c.cot_status = 2 AND c.usu_id_vendedor = ${user}
      AND c.created_at BETWEEN '${start}' AND '${finish}'
    `
    const { result: resultRaw } = await mysqlLib.query(queryString)
    const [result] = resultRaw
    const { total } = result
    return total
  }

  async getPossibleSales (user, start, finish) {
    debug('quoteService -> getPossibleSales')
    // If the date is wrong return 0
    const queryCheckDate = `
      SELECT IF ((NOW() BETWEEN '${start}' AND '${finish}'), 1, 0) AS 'canGet'
    `
    const { result: resultDate } = await mysqlLib.query(queryCheckDate)
    const [value] = resultDate
    const { canGet } = value
    if (canGet === 0) return canGet

    // Get close still opened
    const queryOpened = `
      SELECT
        c.cot_id AS 'base',
        count(*) AS 'total'
      FROM cotizacion AS c
      LEFT join cot_bitacora AS cb ON cb.cot_father_id = c.cot_id
      WHERE c.usu_id_vendedor = ${user}
      AND c.cot_status <> 2 and c.cot_status <> 5
      AND c.created_at BETWEEN '${start}' AND '${finish}'
      GROUP BY c.cot_id
    `
    const { result: quotesRaw } = await mysqlLib.query(queryOpened)

    const quotesWithChildRaw = quotesRaw.filter(q => q.total !== 1).map(q => q.base)
    const quotesWithoutChild = quotesRaw.filter(q => q.total === 1).map(q => q.base)

    // Obtener ultimas hijas de las que tienen hijas
    const getChildQuotes = id => `
      SELECT
        cb.cot_children_id AS 'hija'
      FROM cotizacion AS c
      JOIN cot_bitacora AS cb ON cb.cot_father_id = c.cot_id
      WHERE c.cot_id = ${id}
      ORDER BY cb.cot_bit_id DESC
      LIMIT 1
    `
    const quotesWithChild = []
    for (let i = 0; i < quotesWithChildRaw.length; i++) {
      const query = getChildQuotes(quotesWithChildRaw[i])
      const { result: resultRaw } = await mysqlLib.query(query)
      const [result] = resultRaw
      const { hija } = result
      quotesWithChild.push(hija)
    }

    // Join the IDS
    const quotesIDS = [...quotesWithoutChild, ...quotesWithChild]
    if (quotesIDS.length === 0) return null

    const queryTotal = `
      SELECT
        SUM(cp.cp_cantidad * coalesce(cp.cot_mejorprecio, cp.cp_precio )) AS 'total'
      FROM cot_productos AS cp
      JOIN cotizacion AS c USING(cot_id)
      WHERE cp.cot_id in (${quotesIDS.join()})
    `
    const { result: totalSales } = await mysqlLib.query(queryTotal)
    const [result] = totalSales
    const { total } = result
    return total
  }

  async getCurrentDate () {
    debug('quoteService -> getCurrentDate')
    const queryGetDate = `
      SELECT YEAR(NOW()) AS 'year', MONTH(NOW()) AS 'month', DAY(NOW()) AS 'day'
    `
    const { result: resultCurrentDate } = await mysqlLib.query(queryGetDate)
    const [currentDate] = resultCurrentDate
    return currentDate
  }

  async getCurrentGoal (user) {
    debug('quoteService -> getCurrentGoal')
    const currentDate = await this.getCurrentDate()
    const { year, month } = currentDate
    const queryGetCurrentGoal = `
      SELECT * FROM vendedores_metas
      WHERE usuario_id = ${user}
      AND periodo = '${year}-${month}-01'
    `
    const { result: resultCurrentGoal } = await mysqlLib.query(queryGetCurrentGoal)
    const [result] = resultCurrentGoal
    return result
  }

  async createGoalForUser (user, goal) {
    debug('quoteService -> createGoalForUser')
    const currentDate = await this.getCurrentDate()
    const { year, month } = currentDate
    const queryGetCurrentGoal = `
      INSERT INTO vendedores_metas
      (usuario_id, meta, periodo)
      VALUES
      (${user}, ${goal}, '${year}-${month}-01')
    `
    const { result: { affectedRows } } = await mysqlLib.query(queryGetCurrentGoal)
    return Boolean(affectedRows)
  }

  async updateGoalForUser (user, goal) {
    debug('quoteService -> updateGoalForUser')
    const currentDate = await this.getCurrentDate()
    const { year, month } = currentDate
    const queryGetCurrentGoal = `
      UPDATE vendedores_metas
      SET
        usuario_id = ${user},
        meta = ${goal}
      WHERE periodo = '${year}-${month}-01'
      LIMIT 1
    `
    const { result: { affectedRows } } = await mysqlLib.query(queryGetCurrentGoal)
    return Boolean(affectedRows)
  }

  async getUserGoalPeriodOfTime (user, start, finish) {
    debug('quoteService -> getUserGoalPeriodOfTime')
    const queryGetCurrentGoal = `
      SELECT SUM(meta) AS 'total'
      FROM vendedores_metas
      WHERE usuario_id = ${user}
      AND periodo BETWEEN '${start}' AND '${finish}'
    `
    const { result: sumRaw } = await mysqlLib.query(queryGetCurrentGoal)
    const [result] = sumRaw
    const { total } = result
    return total
  }

  async getFollowersAndPostsByUserForAdminStatistics (user) {
    debug('quoteService -> getFollowersAndPostsByUserForAdminStatistics')
    const queryFollowers = `
      SELECT COUNT(*) AS 'total' FROM seguidores WHERE usuario_destino = ${user} AND estatus = 'Follow'
    `
    const { result: resultFollowersRaw } = await mysqlLib.query(queryFollowers)
    const [resultFollowers] = resultFollowersRaw
    const { total: followers } = resultFollowers

    const queryPosts = `
      SELECT COUNT(*) AS 'total' FROM publicaciones WHERE usuario_id = ${user}
    `
    const { result: resultPostsRaw } = await mysqlLib.query(queryPosts)
    const [resultPosts] = resultPostsRaw
    const { total: posts } = resultPosts

    const result = {
      followers,
      posts
    }
    return result
  }

  async getTotalFriendshipsByType (user, type) {
    debug('quoteService -> getTotalFriendshipsByType')
    const queryFriendsOrigin = `
      SELECT COUNT(*) AS 'total'
      FROM network AS n
      JOIN usuario AS u ON u.usu_id = n.usu_id_amigo
      WHERE n.usu_id_origen = ${user} AND u.usu_tipo = ${type} AND n.net_status = 1
    `
    const { result: resultFriendsOriginRaw } = await mysqlLib.query(queryFriendsOrigin)
    const [resultFriendsOrigin] = resultFriendsOriginRaw
    const { total: friendsOrigin } = resultFriendsOrigin
    const queryFriendsDestiny = `
      SELECT COUNT(*) AS 'total'
      FROM network AS n
      JOIN usuario AS u ON u.usu_id = n.usu_id_amigo
      WHERE n.usu_id_origen = ${user} AND u.usu_tipo = ${type} AND n.net_status = 1
    `
    const { result: resultFriendsDestinyRaw } = await mysqlLib.query(queryFriendsDestiny)
    const [resultFriendsDestiny] = resultFriendsDestinyRaw
    const { total: friendsDestiny } = resultFriendsDestiny
    const total = friendsOrigin + friendsDestiny
    return total
  }

  async getFriendsIDS (user) {
    debug('quoteService -> getFriendsIDS')
    const queryFriendsOrigin = `
      SELECT usu_id_amigo AS 'id'
      FROM network
      WHERE usu_id_origen = ${user}
      AND net_status = 1
    `
    const { result: resultFriendsOriginRaw } = await mysqlLib.query(queryFriendsOrigin)
    const resultFriendsOrigin = resultFriendsOriginRaw.map(r => r.id)

    const queryFriendsDestiny = `
      SELECT usu_id_origen AS 'id'
      FROM network
      WHERE usu_id_amigo = ${user}
      AND net_status = 1
    `
    const { result: resultFriendsDestinyRaw } = await mysqlLib.query(queryFriendsDestiny)
    const resultFriendsDestiny = resultFriendsDestinyRaw.map(r => r.id)

    const ids = [...resultFriendsOrigin, ...resultFriendsDestiny]
    return ids
  }

  async getSellerNumbersForAdminStatistics (user) {
    debug('quoteService -> getSellerNumbersForAdminStatistics')
    const followersAndPosts = await this.getFollowersAndPostsByUserForAdminStatistics(user)
    const clients = await this.getTotalFriendshipsByType(user, 2)
    const queryProspectsIDs = `
      SELECT
      c.usu_id_comprador AS 'id',
      COUNT(*) AS 'total'
      FROM cotizacion AS c
      JOIN usuario AS u ON u.usu_id = c.usu_id_comprador
      WHERE c.usu_id_vendedor = ${user}
      GROUP BY c.usu_id_comprador
    `
    const { result: buyersIDsRaw } = await mysqlLib.query(queryProspectsIDs)
    // IDS from user that have quotes with ${user} these IDS can be friends with ${user} or not
    const buyersIDs = buyersIDsRaw.map(p => p.id)
    let prospects = null
    if (buyersIDs.length === 0) {
      prospects = 0
    } else {
      // This is all your friends IDS, these are ID that ${user} have in their network already
      const friendsIDS = await this.getFriendsIDS(user)
      prospects = buyersIDs.filter(e => !friendsIDS.includes(e)).length
    }

    const result = {
      ...followersAndPosts,
      prospects,
      clients
    }
    return result
  }

  async getBuyerNumbersForAdminStatistics (user) {
    debug('quoteService -> getBuyerNumbersForAdminStatistics')
    const followersAndPosts = await this.getFollowersAndPostsByUserForAdminStatistics(user)
    const providers = await this.getTotalFriendshipsByType(user, 1)
    const result = {
      ...followersAndPosts,
      providers
    }
    return result
  }

  async getHistoricalPurchasesV2 (user) {
    const queryString = `
      SELECT
        SUM(cp.cantidad * cp.precio_unitario) AS 'totalAmount'
      FROM productos_cotizados AS cp
      JOIN cotizaciones AS c USING(cotizacion_id)
      WHERE
        c.estatus = 'pagada'
        AND c.user_id_comprador = ${user}
    `
    const { result: resultAmountRaw } = await mysqlLib.query(queryString)
    const [resultAmount] = resultAmountRaw
    const { totalAmount } = resultAmount

    const queryHowManyQuotes = `
      SELECT COUNT(*) AS 'totalQuotes'
      FROM cotizaciones WHERE user_id_comprador = ${user} AND estatus = 'pagada'
    `
    const { result: resultQuotesRaw } = await mysqlLib.query(queryHowManyQuotes)
    const [resultQuotes] = resultQuotesRaw
    const { totalQuotes } = resultQuotes

    const queryHoyManyProducts = `
      SELECT
        SUM(cp.cantidad) AS 'totalProducts'
      FROM productos_cotizados AS cp
      JOIN cotizaciones AS c USING(cotizacion_id)
      WHERE c.estatus = 'pagada' AND c.user_id_comprador = ${user}
    `
    const { result: resultProductsRaw } = await mysqlLib.query(queryHoyManyProducts)
    const [resultProducts] = resultProductsRaw
    const { totalProducts } = resultProducts

    const data = {
      totalAmount,
      totalQuotes,
      totalProducts
    }

    return data
  }

  async getHistoricalPurchases (user) {
    debug('quoteService -> getHistoricalPurchases')
    const queryString = `
      SELECT
        SUM(cp.cp_cantidad * COALESCE(cp.cot_mejorprecio, cp.cp_precio)) AS 'totalAmount'
      FROM cot_productos AS cp
      JOIN cotizacion AS c USING(cot_id)
      WHERE
        c.cot_status = 2
        AND c.usu_id_comprador = ${user}
    `
    const { result: resultAmountRaw } = await mysqlLib.query(queryString)
    const [resultAmount] = resultAmountRaw
    const { totalAmount } = resultAmount

    const queryHowManyQuotes = `
      SELECT COUNT(*) AS 'totalQuotes'
      FROM cotizacion WHERE usu_id_comprador = ${user} AND cot_status = 2
    `
    const { result: resultQuotesRaw } = await mysqlLib.query(queryHowManyQuotes)
    const [resultQuotes] = resultQuotesRaw
    const { totalQuotes } = resultQuotes

    const queryHoyManyProducts = `
      SELECT
        SUM(cp.cp_cantidad) AS 'totalProducts'
      FROM cot_productos AS cp
      JOIN cotizacion AS c USING(cot_id)
      WHERE c.cot_status = 2 AND c.usu_id_comprador = ${user}
    `
    const { result: resultProductsRaw } = await mysqlLib.query(queryHoyManyProducts)
    const [resultProducts] = resultProductsRaw
    const { totalProducts } = resultProducts

    const data = {
      totalAmount,
      totalQuotes,
      totalProducts
    }

    return data
  }

  async getPossiblePurchases (user, start, finish) {
    debug('quoteService -> getPossiblePurchases')
    // If the date is wrong return 0
    const queryCheckDate = `
      SELECT IF ((NOW() BETWEEN '${start}' AND '${finish}'), 1, 0) AS 'canGet'
    `
    const { result: resultDate } = await mysqlLib.query(queryCheckDate)
    const [value] = resultDate
    const { canGet } = value
    if (canGet === 0) return null

    // Get close still opened
    const queryOpened = `
      SELECT
        c.cot_id AS 'base',
        count(*) AS 'total'
      FROM cotizacion AS c
      LEFT join cot_bitacora AS cb ON cb.cot_father_id = c.cot_id
      WHERE c.usu_id_comprador = ${user}
      AND c.cot_status <> 2 and c.cot_status <> 5
      AND c.created_at BETWEEN '${start}' AND '${finish}'
      GROUP BY c.cot_id
    `
    const { result: quotesRaw } = await mysqlLib.query(queryOpened)

    const quotesWithChildRaw = quotesRaw.filter(q => q.total !== 1).map(q => q.base)
    const quotesWithoutChild = quotesRaw.filter(q => q.total === 1).map(q => q.base)

    // Obtener ultimas hijas de las que tienen hijas
    const getChildQuotes = id => `
      SELECT
        cb.cot_children_id AS 'hija'
      FROM cotizacion AS c
      JOIN cot_bitacora AS cb ON cb.cot_father_id = c.cot_id
      WHERE c.cot_id = ${id}
      ORDER BY cb.cot_bit_id DESC
      LIMIT 1
    `
    const quotesWithChild = []
    for (let i = 0; i < quotesWithChildRaw.length; i++) {
      const query = getChildQuotes(quotesWithChildRaw[i])
      const { result: resultRaw } = await mysqlLib.query(query)
      const [result] = resultRaw
      const { hija } = result
      quotesWithChild.push(hija)
    }

    // Join the IDS
    const quotesIDS = [...quotesWithoutChild, ...quotesWithChild]
    if (quotesIDS.length === 0) return null

    const queryTotal = `
      SELECT
        SUM(cp.cp_cantidad * coalesce(cp.cot_mejorprecio, cp.cp_precio )) AS 'total'
      FROM cot_productos AS cp
      JOIN cotizacion AS c USING(cot_id)
      WHERE cp.cot_id in (${quotesIDS.join()})
    `
    const { result: totalSalesRaw } = await mysqlLib.query(queryTotal)
    const [resultTotalSales] = totalSalesRaw
    const { total: totalSalesAmount } = resultTotalSales

    const totalOrders = quotesIDS.length

    const queryTotalProducts = `
      SELECT
        SUM(cp_cantidad) AS 'totalProducts'
      FROM cot_productos
      WHERE cot_id IN(${quotesIDS.join()})
    `
    const { result: resultTotalProductsRaw } = await mysqlLib.query(queryTotalProducts)
    const [resultTotalProducts] = resultTotalProductsRaw
    const { totalProducts } = resultTotalProducts

    const data = {
      totalSalesAmount,
      totalOrders,
      totalProducts
    }
    return data
  }

  async getSalesAmountCurrentMonthV2 (user) {
    debug('quoteService -> getSalesAmountCurrentMonth')
    const currentDate = await this.getCurrentDate()
    const { year, month } = currentDate
    const yearMonth = `${year}-${month}-01`
    const yearNextMonth = `${year}-${month + 1}-01`
    const queryString = `
      SELECT
        SUM(cp.cantidad * cp.precio_unitario) AS total
      FROM productos_cotizados AS cp
      JOIN cotizaciones AS c USING(cotizacion_id)
      WHERE c.estatus = 'pagada' AND c.user_id = ${user}
      AND c.created_at BETWEEN '${yearMonth}' AND '${yearNextMonth}'
    `
    const { result: resultRaw } = await mysqlLib.query(queryString)
    const [result] = resultRaw
    const { total } = result
    return total
  }

  async getSalesAmountCurrentMonth (user) {
    debug('quoteService -> getSalesAmountCurrentMonth')
    const currentDate = await this.getCurrentDate()
    const { year, month } = currentDate
    const yearMonth = `${year}-${month}-01`
    const yearNextMonth = `${year}-${month + 1}-01`
    const queryString = `
      SELECT
        SUM(cp.cp_cantidad * COALESCE(cp.cot_mejorprecio, cp.cp_precio)) AS 'total'
      FROM cot_productos AS cp
      JOIN cotizacion AS c USING(cot_id)
      WHERE c.cot_status = 2 AND c.usu_id_vendedor = ${user}
      AND c.created_at BETWEEN '${yearMonth}' AND '${yearNextMonth}'
    `
    const { result: resultRaw } = await mysqlLib.query(queryString)
    const [result] = resultRaw
    const { total } = result
    return total
  }

  async getPossiblePurchasesCurrentMonth (user) {
    debug('quoteService -> getPossiblePurchasesCurrentMonth')
    const currentDate = await this.getCurrentDate()
    const { year, month } = currentDate
    const yearMonth = `${year}-${month}-01`
    const yearNextMonth = `${year}-${month + 1}-01`
    // Get close still opened
    const queryOpened = `
      SELECT
        c.cot_id AS 'base',
        count(*) AS 'total'
      FROM cotizacion AS c
      LEFT join cot_bitacora AS cb ON cb.cot_father_id = c.cot_id
      WHERE c.usu_id_comprador = ${user}
      AND c.cot_status <> 2 and c.cot_status <> 5
      AND c.created_at BETWEEN '${yearMonth}' AND '${yearNextMonth}'
      GROUP BY c.cot_id
    `
    const { result: quotesRaw } = await mysqlLib.query(queryOpened)

    const quotesWithChildRaw = quotesRaw.filter(q => q.total !== 1).map(q => q.base)
    const quotesWithoutChild = quotesRaw.filter(q => q.total === 1).map(q => q.base)

    // Obtener ultimas hijas de las que tienen hijas
    const getChildQuotes = id => `
      SELECT
        cb.cot_children_id AS 'hija'
      FROM cotizacion AS c
      JOIN cot_bitacora AS cb ON cb.cot_father_id = c.cot_id
      WHERE c.cot_id = ${id}
      ORDER BY cb.cot_bit_id DESC
      LIMIT 1
    `
    const quotesWithChild = []
    for (let i = 0; i < quotesWithChildRaw.length; i++) {
      const query = getChildQuotes(quotesWithChildRaw[i])
      const { result: resultRaw } = await mysqlLib.query(query)
      const [result] = resultRaw
      const { hija } = result
      quotesWithChild.push(hija)
    }

    // Join the IDS
    const quotesIDS = [...quotesWithoutChild, ...quotesWithChild]
    if (quotesIDS.length === 0) return null

    const queryTotal = `
      SELECT
        SUM(cp.cp_cantidad * coalesce(cp.cot_mejorprecio, cp.cp_precio )) AS 'total'
      FROM cot_productos AS cp
      JOIN cotizacion AS c USING(cot_id)
      WHERE cp.cot_id in (${quotesIDS.join()})
    `
    const { result: totalSalesRaw } = await mysqlLib.query(queryTotal)
    const [resultTotalSales] = totalSalesRaw
    const { total: totalSalesAmount } = resultTotalSales

    return totalSalesAmount
  }

  async getPossiblePurchasesCurrentMonthV2 (user) {
    debug('quoteService -> getPossiblePurchasesCurrentMonth')
    const currentDate = await this.getCurrentDate()
    const { year, month } = currentDate
    const yearMonth = `${year}-${month}-01`
    const yearNextMonth = `${year}-${month + 1}-01`
    // Get close still opened
    const queryOpened = `
      SELECT
        c.cotizacion_id AS 'base',
        count(*) AS 'total'
      FROM cotizaciones AS c
      WHERE c.user_id_comprador = ${user}
      AND c.estatus = 'pendiente' or c.estatus = 'aceptada' or c.estatus = 'cambio' or c.estatus = 'creada'
      AND c.created_at BETWEEN '${yearMonth}' AND '${yearNextMonth}'
      GROUP BY c.cotizacion_id
    `
    const { result: quotesRaw } = await mysqlLib.query(queryOpened)
    const quotesWithoutChild = quotesRaw.filter(q => q.total === 1).map(q => q.base)

    // Join the IDS
    const quotesIDS = [...quotesWithoutChild]
    if (quotesIDS.length === 0) return null

    const queryTotal = `
      SELECT
        SUM(cp.cantidad * cp.precio_unitario) AS total
      FROM productos_cotizados AS cp
      JOIN cotizaciones AS c USING(cotizacion_id)
      WHERE cp.cotizacion_id in (${quotesIDS.join()})
    `
    const { result: totalSalesRaw } = await mysqlLib.query(queryTotal)
    const [resultTotalSales] = totalSalesRaw
    const { total: totalSalesAmount } = resultTotalSales

    return totalSalesAmount
  }

  async getFollowersByCompanyID (company) {
    debug('quoteService -> getFollowersByCompanyID')
    const query = `
      SELECT COUNT(*) AS 'total'
      FROM empresa_usuario AS eu
      JOIN seguidores AS s ON s.usuario_destino = eu.usu_id
      WHERE eu.emp_id = ${company}
    `
    const { result: resultRaw } = await mysqlLib.query(query)
    const [result] = resultRaw
    const { total } = result
    return total
  }

  async getFriends (user) {
    debug('quoteService -> getFriends')
    const query = `
    SELECT
      u.usu_id, u.usu_tipo,
      e.emp_id, e.emp_certificada,
      it.nombre AS "industria",
      s.estatus AS "follower"
    FROM network AS n
    JOIN usuario AS u ON u.usu_id = IF(n.usu_id_amigo = ${user}, n.usu_id_origen, n.usu_id_amigo)
    JOIN empresa_usuario AS eu ON eu.usu_id = u.usu_id
    JOIN empresa AS e ON e.emp_id = eu.emp_id
    JOIN industria_translate AS it ON it.industria_id = e.cin_id
    LEFT JOIN seguidores AS s ON s.usuario_origen = u.usu_id
    WHERE (n.usu_id_amigo = ${user} OR n.usu_id_origen = ${user})
    AND n.net_status = 1
    AND it.idioma_id = 1
    `
    const { result: friends } = await mysqlLib.query(query)

    const total = friends.length
    const sellers = friends.filter(f => f.usu_tipo === 1).length
    const buyers = friends.filter(f => f.usu_tipo === 2).length
    const admins = friends.filter(f => f.usu_tipo === 3).length
    const certified = friends.filter(f => f.emp_certificada === 1).length
    const industries = friends.map(f => f.industria).filter((v, i, s) => s.indexOf(v) === i)
    const companiesIDs = friends.map(f => f.emp_id)
    const followers = friends.map(f => f.follower === 'Follow').length

    let countries = []
    let estates = []

    if (companiesIDs.length !== 0) {
      const queryGetCountry = `
      SELECT
        et.nombre AS "estado", pt.nombre AS "pais"
      FROM domicilio
      JOIN estado AS e USING(estado_id)
      JOIN estado_translate AS et USING(estado_id)
      JOIN pais AS p USING(pais_id)
      JOIN pais_translate AS pt USING(pais_id)
      WHERE emp_id IN (${companiesIDs.join(',')})
      AND domicilio_tipo = 1
      AND et.idioma_id = 1
      AND pt.idioma_id = 1
    `
      const { result } = await mysqlLib.query(queryGetCountry)
      countries = result.map(r => r.pais).filter((v, i, s) => s.indexOf(v) === i)
      estates = result.map(r => r.estado).filter((v, i, s) => s.indexOf(v) === i)
    }

    const data = {
      total,
      sellers,
      buyers,
      admins,
      followers,
      certified,
      industries,
      countries,
      estates
    }

    return data
  }

  async getStatisticsForProductsByCompanyID (companyID) {
    debug('quoteService -> getStatisticsForProductsByCompanyID')
    const query = `
      SELECT
        p.prod_id,
        pv.usu_id, pv.fecha_creacion,
        u.usu_tipo, u.usu_nombre, u.usu_foto,
        e.emp_id, e.emp_nombre,
        e.emp_certificada,
        it.nombre as "industria",
        pt.nombre as "pais",
        et.nombre as "estado"
      FROM producto as p
      JOIN producto_vistas as pv using(prod_id)
      JOIN usuario as u using(usu_id)
      JOIN empresa_usuario eu using(usu_id)
      JOIN empresa as e on e.emp_id = eu.emp_id
      JOIN industria_translate as it on it.industria_id = e.cin_id
      JOIN domicilio as d on d.emp_id = e.emp_id
      JOIN estado as es using(estado_id)
      JOIN estado_translate as et using(estado_id)
      JOIN pais_translate as pt using(pais_id)
      WHERE p.emp_id = ${companyID}
      AND it.idioma_id = 1
      AND d.domicilio_tipo = 1
      AND pt.idioma_id = 1
      AND et.idioma_id = 1
    `
    const { result: views } = await mysqlLib.query(query)

    const industries = views.map(v => v.industria).filter((v, i, s) => s.indexOf(v) === i)
    const countries = views.map(v => v.pais)
    const estates = views.map(v => v.estado)
    const sellers = views.map(v => v.usu_tipo).filter((v, i, s) => s.indexOf(v) === i).filter(t => t === 1).length
    const buyers = views.map(v => v.usu_tipo).filter((v, i, s) => s.indexOf(v) === i).filter(t => t === 2).length
    const admins = views.map(v => v.usu_tipo).filter((v, i, s) => s.indexOf(v) === i).filter(t => t === 3).length
    const certified = views.filter(v => v.emp_certificada === 1).map(c => c.emp_id).filter((v, i, s) => s.indexOf(v) === i).length

    const data = {
      industries,
      countries: {
        views: mostRepeated(countries),
        list: countries.filter((v, i, s) => s.indexOf(v) === i)
      },
      estates: {
        views: mostRepeated(estates),
        list: estates.filter((v, i, s) => s.indexOf(v) === i)
      },
      users: {
        sellers,
        buyers,
        admins
      },
      certified
    }
    return data
  }

  async registerUserLogin (usuId) {
    debug('quoteService -> registerUserLogin')
    const query = `insert into historial_login (id_usuario) values (${usuId})`
    const { result } = await mysqlLib.query(query)
    return result
  }
}

const inst = new StatisticService()
Object.freeze(inst)

module.exports = inst
