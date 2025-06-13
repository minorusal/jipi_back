'use strict'

const debug = require('debug')('old-api:quotes-service')
const mysqlLib = require('../lib/db')

class QuoteService {
  constructor() {
    if (QuoteService.instance == null) {
      this.table = 'cotizacion'
      QuoteService.instance = this
    }
    return QuoteService.instance
  }

  async get(query, userType) {
    debug('quoteService -> get')
    debug(query)

    let queryWhere = (query && (query.usu_id || query.status || query.empresa_id || query.reporte_activo || query.reporte)) ? 'where ' : ''

    const [vendedor, administrador] = [1, 3]
    let cotUserType = ''
    if (userType === vendedor) {
      cotUserType = 'c.usu_id_vendedor'
    } else {
      cotUserType = 'c.usu_id_comprador'
    }

    let u = `${query.usu_id ? `${cotUserType} = ${query.usu_id}` : ''}`
    if (userType === administrador) {
      u = ''
    }
    let s = null
    if (query.status == 1) {
      // Si el status es 1 también regresar el 4
      s = `${u !== '' && query.status ? ' AND ' : ''}${query.status ? `c.cot_status = ${query.status} OR c.cot_status = 4` : ''}`
    } else {
      s = `${u !== '' && query.status ? ' AND ' : ''}${query.status ? `c.cot_status = ${query.status}` : ''}`
    }
    let e = null
    if (userType === administrador) {
      // e = `${query.empresa_id && (query.usu_id || query.status) ? ' AND ' : ''}${query.empresa_id ? `(c.emp_id_comprador = ${query.empresa_id} OR c.emp_id_vendedor = ${query.empresa_id})` : ''}`
      e = `${query.empresa_id && (query.status) ? ' AND ' : ''}${query.empresa_id ? `(c.emp_id_comprador = ${query.empresa_id} OR c.emp_id_vendedor = ${query.empresa_id})` : ''}`
    } else {
      e = `${query.empresa_id && (query.usu_id || query.status) ? ' AND ' : ''}${query.empresa_id ? `e.emp_id = ${query.empresa_id}` : ''}`
    }
    // const a = `${query.reporte_activo && (query.usu_id || query.status || query.empresa_id) ? ' AND ' : ''}${query.reporte_activo ? `rc.vigente = ${query.reporte_activo}` : ''}`

    const r = `${query.reporte && (query.usu_id || query.status || query.empresa_id || query.reporte_activo) ? ' AND ' : ''}${query.reporte ? `${query.reporte == 1 ? 'rc.rep_id IS NOT NULL' : 'rc.rep_id IS NULL'}` : ''}`

    queryWhere = `${queryWhere}${u}${s}${e}${r}`

    const queryString = `
      SELECT 
        c.cot_id AS "cotizacion_id",
        c.usu_id_comprador AS "usuario_comprador_id",
        c.usu_id_vendedor AS "usuario_vendedor_id",
        c.cot_delivery AS "fecha_entrega",
        c.cot_comentario AS "comentario",
        c.created_at AS "fecha_cotizacion",
        c.cot_status AS "estatus_cotizacion",
        c.visto AS "cotizacion_visto",
        c.descuento AS "cotizacion_descuento",
        c.credito_dias AS "credito_dias",
        e.emp_id AS "empresa_id",
        e.emp_nombre AS "nombre_empresa",
        e.emp_certificada AS "empresa_certificada",
        e.emp_logo AS "empresa_logo",
        cp.emp_id_vendedor AS "empresa_vendedor_id",
        cp.prod_id AS "producto_id",
        cp.cp_cantidad AS "cantidad",
        cp.cp_precio AS "precio",
        cp.cot_version AS "cotizacion_version",
        cp.cot_calificacion AS "cotizacion_calificacion",
        cp.cot_calificacion_comentario AS "calificacion_comentario",
        pf.foto_url AS "foto_producto",
        cmp.cmetodo_desc_esp AS "metodo_pago",
        cu.cuni_desc_esp AS "unidad",
        cm.cmon_desc_esp AS "moneda",
        e1.emp_nombre AS "empresa_usuario_comprador",
        e1.emp_logo AS "empresa_usuario_comprador_logo",
        e1.emp_certificada AS "empresa_usuario_comprador_certificada",
        e1.emp_id AS "empresa_usuario_comprador_id",
        cb.cot_father_id AS "cotizacion_padre_id"
        ${query.reporte_activo || query.reporte ? `
          ,rc.vigente AS "reporte_vigente"
        ` : ''}
      FROM cotizacion AS c
      LEFT JOIN empresa AS e
        ON c.emp_id_vendedor = e.emp_id
      LEFT JOIN cot_productos AS cp
        ON c.cot_id = cp.cot_id
      LEFT JOIN cat_metodo_pago AS cmp
        ON cmp.cmetodo_id = c.cmetodo_id
      LEFT JOIN producto AS p
        ON p.prod_id = cp.prod_id
      LEFT JOIN producto_foto AS pf
        ON pf.prod_id = p.prod_id
      LEFT JOIN cat_unidad AS cu
        ON cu.cuni_id = p.cuni_id
      LEFT JOIN cat_moneda AS cm
        ON p.cmon_id = cm.cmon_id
      LEFT JOIN empresa_usuario AS eu
        ON eu.usu_id = c.usu_id_comprador
      LEFT JOIN empresa as e1
        ON e1.emp_id = eu.emp_id
      LEFT JOIN cot_bitacora as cb
        ON cb.cot_children_id = c.cot_id
      ${query.reporte_activo || query.reporte ? `
      LEFT JOIN reporte_cotizacion AS rc
        ON c.cot_id = rc.cot_id
      ` : ''}
      ${queryWhere} AND (pf.foto_num = 1 OR pf.foto_num IS NULL)
      ORDER BY c.cot_id DESC
    `

    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getById(id) {
    debug('quotes->getById')

    const queryString = `
      SELECT 
      c.cot_id AS "cotizacion_id",
      c.usu_id_comprador AS "usuario_comprador_id",
      c.usu_id_vendedor AS "usuario_vendedor_id",
      c.cot_delivery AS "cotizacion_fecha_entrega",
      c.created_at AS "cotizacion_fecha",
      c.cot_comentario AS "comentario",
      c.cot_status AS "cotizacion_estatus",
      c.cot_comentario AS "cotizacion_comentario",
      c.descuento AS "cotizacion_descuento",
      c.visto AS "cotizacion_visto",
      c.domicilio_id AS "empresa_comprador_domicilio_id",
      c.credito_fecha AS "credito_fecha",
      c.credito_dias AS "credito_dias",
      cmp.cmetodo_id AS "metodo_pago_id",
      cmp.cmetodo_desc_esp AS "metodo_pago",
      e.emp_id AS "empresa_comprador_id",
      e.emp_nombre AS "empresa_comprador_nombre",
      e.emp_logo AS "empresa_comprador_logo",
      e.emp_certificada AS "empresa_comprador_certificada",
      e2.emp_id AS "empresa_vendedor_id",
      e2.emp_nombre AS "empresa_vendedor_nombre",
      e2.emp_logo AS "empresa_vendedor_logo",
      e2.emp_certificada AS "empresa_vendedor_certificada"
    FROM ${this.table} AS c
    LEFT JOIN empresa_usuario AS eu
      ON eu.usu_id = c.usu_id_comprador
    LEFT JOIN cat_metodo_pago AS cmp
      ON cmp.cmetodo_id = c.cmetodo_id
    LEFT JOIN empresa AS e
      ON e.emp_id = eu.emp_id
    LEFT JOIN empresa AS e2
      ON e2.emp_id = c.emp_id_vendedor
    WHERE 
      c.cot_id = ${id}
    ORDER BY c.cot_id DESC
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getDetailsById(id) {
    debug('quotes->getDetailsBy')

    const queryString = `
      SELECT 
      c.cot_id AS "cotizacion_id",
      c.usu_id_comprador AS "usuario_comprador_id",
      c.usu_id_vendedor AS "usuario_vendedor_id",
      c.cot_delivery AS "cotizacion_fecha_entrega",
      c.created_at AS "cotizacion_fecha",
      c.cot_comentario AS "comentario",
      c.cot_status AS "cotizacion_estatus",
      c.cot_comentario AS "cotizacion_comentario",
      c.credito_dias AS "credito_dias",
      cmp.cmetodo_id AS "metodo_pago_id",
      cmp.cmetodo_desc_esp AS "metodo_pago",
      e2.emp_id AS "empresa_vendedor_id",
      e2.emp_nombre AS "empresa_vendedor_nombre",
      e2.emp_logo AS "empresa_vendedor_logo",
      e2.emp_certificada AS "empresa_vendedor_certificada",
      e2.emp_razon_social AS "empresa_vendedora_razon_social",
      e.emp_id AS "empresa_comprador_id",
      e.emp_nombre AS "empresa_comprador_nombre",
      e.emp_logo AS "empresa_comprador_logo",
      e.emp_certificada AS "empresa_comprador_certificada",
      e.emp_razon_social AS "empresa_comprador_razon_social",
      c.descuento AS "cotizacion_descuento",
      c.visto AS "cotizacion_visto",
      e.emp_rfc AS "comprador_rfc",
      e2.emp_website AS "vendedor_website",
      uv.usu_nombre AS "usuario_vendedor_nombre",
      uv.usu_app AS "usuario_vendedor_apellido",
      uv.usu_foto AS "usuario_vendedor_foto",
      uc.usu_nombre AS "usuario_comprador_nombre",
      uc.usu_app AS "usuario_comprador_apellido",
      uc.usu_foto AS "usuario_comprador_foto",
      rc.rep_id AS "reporte_cotizacion_id",
      rc.vigente AS "reporte_cotizacion_vigente",
      rc.fecha_creacion AS "reporte_cotizacion_fecha_creacion",
      rc.fecha_actualizacion AS "reporte_cotizacion_fecha_actualizacion"
    FROM ${this.table} AS c
    LEFT JOIN empresa_usuario AS eu ON eu.usu_id = c.usu_id_comprador
    LEFT JOIN cat_metodo_pago AS cmp ON cmp.cmetodo_id = c.cmetodo_id
    LEFT JOIN empresa AS e ON e.emp_id = eu.emp_id
    LEFT JOIN empresa AS e2 ON e2.emp_id = c.emp_id_vendedor
    LEFT JOIN reporte_cotizacion AS rc ON rc.cot_id = c.cot_id
    JOIN usuario AS uv ON uv.usu_id = c.usu_id_vendedor
    JOIN usuario AS uc ON uc.usu_id = c.usu_id_comprador
    WHERE 
      c.cot_id = ${id}
    ORDER BY c.cot_id DESC
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async create(quoteData, seller, company) {
    debug(quoteData)
    const diasCredito = ['', '']
    if (quoteData.cmetodo_id !== 1 && quoteData.credito_dias) {
      diasCredito[0] = `,
        credito_dias`
      diasCredito[1] = `,
        ${quoteData.credito_dias}
`
    }
    const queryString = `
        INSERT INTO cotizacion 
        (
          usu_id_comprador,
          emp_id_vendedor,
          cot_delivery,
          cmetodo_id,
          cpais_id,
          cedo_id,
          cot_comentario,
          cot_status,
          domicilio_id,
          usu_id_vendedor,
          emp_id_comprador${diasCredito[0]}
        )
        VALUES 
        (
            ${quoteData.usu_id_comprador},
            ${quoteData.emp_id_vendedor},
            "${quoteData.cot_delivery}",
            ${quoteData.cmetodo_id},
            ${quoteData.cpais_id},
            ${quoteData.cedo_id},
            "${quoteData.cot_comentario}",
            ${quoteData.cot_status},
            ${quoteData.address_id},
            ${seller},
            ${company}${diasCredito[1]}
        );
    `
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async createCotizacionProducto(cotizacionProductoData) {
    debug('createCotizacionProducto')
    const queryString = `
        INSERT INTO cot_productos 
        (cot_id, prod_id, emp_id_vendedor, cot_version, cp_cantidad, cp_precio, cot_mejorprecio, cot_prod_comentario)
        VALUES 
        (
            ${cotizacionProductoData.cot_id},
            ${cotizacionProductoData.prod_id},
            ${cotizacionProductoData.emp_id_vendedor},
            ${cotizacionProductoData.cot_version},
            ${cotizacionProductoData.cp_cantidad},
            ${cotizacionProductoData.cp_precio},
            ${cotizacionProductoData.cot_mejorprecio},
            '${cotizacionProductoData.comentario}'
        );
    `
    debug(queryString)
    return mysqlLib.query(queryString)
  }

  async getCotizacionProductos(cotizacionId) {
    debug('getCotizacionProductos')

    const queryString = `
      SELECT
        r.cotizacion_id AS "cotizacion_id",
        r.producto_id AS "producto_id",
        r.empresa_id_vendedor AS "empresa_vendedor_id",
        r.cantidad AS "cantidad",
        r.cotizacion_version,
        r.precio,
        r.mejor_precio,
        r.cobertura_local,
        r.cobertura_nacional,
        r.cobertura_internacional,
        r.unidad_id,
        r.unidad,
        r.producto_disponible,
        r.moneda_id,
        r.moneda,
        r.producto_nombre,
        r.producto_descripcion,
        r.producto_video,
        r.producto_comentario,
        r.compra_minima
      FROM (
        SELECT
          cp.cot_id AS "cotizacion_id",
          p.prod_id AS "producto_id",
          cp.emp_id_vendedor AS "empresa_id_vendedor",
          cp_cantidad AS "cantidad",
          cp.cot_version AS "cotizacion_version",
          cp.cot_mejorprecio AS "mejor_precio",
          cp.cp_precio AS precio,
          p.prod_cobertura_loc AS "cobertura_local",
          p.prod_cobertura_nac AS "cobertura_nacional",
          p.prod_cobertura_int AS "cobertura_internacional",
          p.cuni_id AS "unidad_id",
          cu.cuni_desc_esp AS "unidad",
          p.prod_disponible AS "producto_disponible",
          cm.cmon_id AS "moneda_id",
          cm.cmon_desc_esp AS "moneda",
          pt.prod_nombre AS "producto_nombre",
          pt.prod_desc AS "producto_descripcion",
          pt.prod_video AS "producto_video",
          cp.cot_prod_comentario AS "producto_comentario",
          p.prod_compra_minima AS "compra_minima"
        FROM cot_productos AS cp
        INNER JOIN producto AS p
          ON cp.prod_id = p.prod_id
        INNER JOIN cat_unidad AS cu
          ON p.cuni_id = cu.cuni_id
        INNER JOIN cat_moneda AS cm
          ON p.cmon_id = cm.cmon_id
        INNER JOIN producto_translate AS pt
          ON pt.prod_id = p.prod_id
        ${cotizacionId ? `WHERE cot_id = ${cotizacionId} AND pt.idioma_id = 1` : 'pt.idioma_id = 1'}
      ) as r;
    `

    return mysqlLib.query(queryString)
  }

  async update(cotId, quoteData) {
    const queryString = `
      UPDATE ${this.table}
      SET cot_status = ${quoteData.cot_status}
      ${quoteData.visto ? `,
      visto = ${quoteData.visto}` : ''}
      WHERE cot_id = ${cotId}
    `
    debug(queryString)

    await mysqlLib.query(queryString)

    return this.getById(cotId)
  }

  async createChildrenQuote(quoteChildren, creditDays) {
    debug('quoteService -> createChildrenQuote')
    const days = ['', '']
    if (creditDays) {
      days[0] = ', credito_dias'
      days[1] = `, ${creditDays}`
    }

    const queryString = `
      INSERT INTO ${this.table}
      (usu_id_comprador, emp_id_vendedor, cot_delivery, cmetodo_id, cpais_id, cedo_id, cot_comentario, cot_status, descuento, visto, usu_id_vendedor, emp_id_comprador, domicilio_id${days[0]})
      VALUES
      (
        ${Object.keys(quoteChildren).reduce((bv, cv, index) => {
      bv += `${!(isNaN(quoteChildren[cv])) ? parseInt(quoteChildren[cv]) : `"${quoteChildren[cv]}"`}`
      bv += Object.keys(quoteChildren).length === index + 1 ? '' : ','
      return bv
    }, '')}${days[1]}
      )
    `
    debug(queryString)

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async crearBitacoraCotizacion(cotId, cotIdChildren) {
    debug('createBitacoraCotizacion')
    debug(`Padre ${cotId} - Children ${cotIdChildren}`)
    const queryString = `
      INSERT INTO cot_bitacora
      (cot_father_id, cot_children_id)
      VALUES
      (
        ${parseInt(cotId)},
        ${parseInt(cotIdChildren)}
      )
    `
    debug(queryString)

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getChildrenQuotes(cotId) {
    debug('getChildrenQuotes')

    const queryString = `
      SELECT
        cot_bit_id AS "cotizacion_bitacora_id",
        cot_father_id AS "cotizacion_padre_id",
        cot_children_id AS "cotizacion_hija_id",
        c.created_at AS "fecha_cotizacion",
        c.cot_status AS "cotizacion_estatus_id",
        c.visto AS "cotizacion_visto"
      FROM cot_bitacora AS cb
      INNER JOIN cotizacion AS c
        ON c.cot_id = cb.cot_father_id
      WHERE cot_father_id = ${cotId}
    `
    debug(queryString)

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async seen(cotId) {
    debug('QuoteService -> seen')

    const queryString = `
      UPDATE ${this.table} SET visto = 1 WHERE cot_id = ${cotId}
    `

    debug(queryString)

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getReports(id) {
    debug('QuoteService -> getReports')
    const queryString = `SELECT * FROM reporte_cotizacion WHERE cot_id = ${id}`
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async addReport(id) {
    debug('QuoteService -> addReport')
    const queryString = `INSERT INTO reporte_cotizacion (cot_id) VALUES (${id})`
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async updateReport(id, vigente) {
    debug('QuoteService -> updateReport')
    const queryString = `UPDATE reporte_cotizacion SET vigente = ${vigente}, fecha_actualizacion = NOW() WHERE cot_id = ${id}`
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  // TODO:
  // Eliminar este método temporal
  async deleteReport(id) {
    debug('QuoteService -> deleteReport')
    const queryString = `DELETE FROM reporte_cotizacion WHERE cot_id = ${id}`
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getPayments(reporteId) {
    debug('QuoteService -> getPayments')
    const queryString = `SELECT * FROM pago_cotizacion WHERE reporte_id = ${reporteId}`
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async addPayment(reporteId, cantidad) {
    debug('QuoteService -> addPayment')
    const queryString = `INSERT INTO pago_cotizacion (reporte_id, monto) VALUES (${reporteId}, ${cantidad})`
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async updatePayment(pagoId, cantidad) {
    debug('QuoteService -> updatePayment')
    const queryString = `UPDATE pago_cotizacion SET monto = ${cantidad}, fecha_actualizacion = NOW() WHERE pago_id = ${pagoId}`
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async deletePayment(id) {
    debug('QuoteService -> deletePayment')
    const queryString = `DELETE FROM pago_cotizacion WHERE pago_id = ${id} LIMIT 1`
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getQuoteDate(id) {
    debug('quoteService -> get')
    debug(id)

    const queryString = `
      SELECT
        created_at AS "created",
        updated_at AS "updated",
        NOW() AS "now"
      FROM cotizacion
      WHERE cot_id = ${id}
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async insertComment({ cotizacion, usuario, comentario, origen }) {
    debug('quoteService -> insertComent')

    const queryString = `
      INSERT INTO comentario_cotizacion
        (cot_id, autor, texto, cot_origen)
      VALUES
        (${cotizacion}, ${usuario}, '${comentario}', ${origen})
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getCommentById(id) {
    debug('quoteService -> getCommentById')

    const queryString = `
      SELECT *
      FROM comentario_cotizacion
      WHERE comentario_id = ${id}
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }


  async getComments(id) {
    debug('quoteService -> getComments')

    const queryString = `
      SELECT 
        cc.*,
        CONCAT(u.usu_nombre, ' ', u.usu_app) AS usu_nombre,
        e.emp_nombre
      FROM 
        comentario_cotizacion AS cc
      INNER JOIN 
        usuario AS u ON u.usu_id = cc.autor
      INNER JOIN 
        empresa_usuario AS eu ON eu.usu_id = cc.autor
      INNER JOIN 
        empresa AS e ON e.emp_id = eu.emp_id
      WHERE 
        cc.cot_id = ${id}
      ORDER BY 
      cc.fecha_creacion ASC;
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getCommentsSinLeer(id) {
    debug('quoteService -> getCommentsSinLeer')
    const queryString = `
      SELECT *
      FROM comentario_cotizacion
      WHERE cot_id = ${id}
      AND visto = 0
      ORDER BY comentario_id ASC
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getQuotesNotSeenMessages(user, quote) {
    debug('quoteService -> getQuotesNotSeenMessages')
    const queryString = `
      SELECT COUNT(*) AS "total"
      FROM comentario_cotizacion
      WHERE cot_id = ${quote}
      AND visto = 0
      AND autor <> ${user}
    `
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async updateCommentsSinLeer(cotizacion, comentarios) {
    debug('quoteService -> updateCommentsSinLeer')
    const queryString = `
      UPDATE comentario_cotizacion
      SET visto = 1
      WHERE comentario_id IN (${comentarios.join(',')})
      AND cot_id = ${cotizacion}
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async deleteComment(cotizacion, comentario) {
    debug('quoteService -> deleteComment')

    const queryString = `
      DELETE FROM comentario_cotizacion
      WHERE comentario_id = ${comentario}
      AND cot_id = ${cotizacion};
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getExperience({ cot_id: cotID }) {
    debug('quoteService -> getExperience')
    const queryString = `
      SELECT * FROM cot_experiencia
      WHERE cot_id = ${cotID}
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getExperienceLastQuoteID({ comprador_id: buyerID, vendedor_id: sellerID }) {
    debug('quoteService -> getExperienceLastQuoteID')
    const queryString = `
      SELECT
        cot_id AS "quoteID"
      FROM cotizacion
      WHERE cot_status = 2
      AND emp_id_comprador = ${buyerID}
      AND emp_id_vendedor = ${sellerID}
      ORDER BY cot_id DESC
      LIMIT 1
    `
    const { result } = await mysqlLib.query(queryString)
    const [quote] = result
    if (!quote) return null
    const { quoteID } = quote
    return quoteID
  }

  async createNewExperience({ cot_id: cotID, comprador_id: buyerID, vendedor_id: sellerID, tiempo, calidad, servicio, comentario }) {
    debug('quoteService -> createNewExperience')

    const queryUpdatePrevious = `
      UPDATE cot_experiencia
      SET
      estatus = 'Inactivo'
      WHERE
      comprador_id = ${buyerID}
      AND vendedor_id = ${sellerID}
      AND estatus = 'Activo'
    `
    await mysqlLib.query(queryUpdatePrevious)

    const queryInsert = `
      INSERT INTO cot_experiencia
      (cot_id, comprador_id, vendedor_id, tiempo, calidad, servicio, comentario)
      VALUES
      (${cotID}, ${buyerID}, ${sellerID}, ${tiempo}, ${calidad}, ${servicio}, ${comentario ? `'${comentario}'` : null}     )
    `
    const { result: { affectedRows } } = await mysqlLib.query(queryInsert)
    return Boolean(affectedRows)
  }

  async insertExperience({ cot_id, comprador_id, tiempo, calidad, servicio, comentario }) {
    debug('quoteService -> insertExperience')

    let query = null
    if (comentario !== null && comentario !== undefined) {
      query = `'${comentario}'`
    }

    const queryString = `
      INSERT INTO cot_experiencia
        (cot_id, comprador_id, tiempo, calidad, servicio, comentario)
      VALUES
        (${cot_id}, ${comprador_id}, ${tiempo}, ${calidad}, ${servicio}, ${query})
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async updateExperience(id, { comprador_id, tiempo, calidad, servicio, comentario }) {
    debug('quoteService -> insertExperience')

    let query = null
    if (comentario !== null && comentario !== undefined) {
      query = `'${comentario}'`
    }

    const queryString = `
      UPDATE cot_experiencia
      SET
        tiempo = ${tiempo},
        calidad = ${calidad},
        servicio = ${servicio},
        comentario = ${query},
        fecha_actualizacion = NOW()
      WHERE cot_id = ${id}
      AND comprador_id = ${comprador_id}
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getLastChild(id) {
    debug('quoteService -> getLastChild')

    const queryString = `
      SELECT
        c.cot_id AS 'cot_padre',
        c.created_at,
        c.cot_delivery,
        c.cmetodo_id,
        c.visto,
        c.cot_status,
        c.usu_id_vendedor,
        cb.cot_children_id AS 'cot_id',
        cmp.cmetodo_desc_esp,
        cmp.cmetodo_desc_ing
      FROM cotizacion AS c
      JOIN cot_bitacora AS cb
      ON cb.cot_father_id = c.cot_id
      JOIN cat_metodo_pago AS cmp
      ON cmp.cmetodo_id = c.cmetodo_id
      WHERE c.cot_id = ${id}
      ORDER BY cb.cot_bit_id desc
      LIMIT 1
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getLastChildTotalAmount(id) {
    debug('quoteService -> getLastChildTotalAmount')

    const queryString = `
      SELECT
        cp.cp_cantidad AS 'cantidad',
        cp.cp_precio AS 'precio',
        cp.cot_mejorprecio AS 'mejor_precio',
        cp.prod_id,
        p.prod_precio_lista AS 'precio_lista',
        p.prod_precio_promo AS 'precio_promo',
        p.prod_precio_envio AS 'precio_envio',
        p.prod_precio_envio_nacional AS 'envio_nacional',
        p.prod_precio_envio_internacional AS 'envio_internacional',
        p.cmon_id AS 'moneda_id',
        cm.cmon_desc_esp AS 'moneda_esp',
        cm.cmon_desc_ing AS 'moneda_ing'
      FROM cot_productos AS cp
      JOIN producto AS p
      ON p.prod_id = cp.prod_id
      JOIN cat_moneda AS cm
      ON cm.cmon_id = p.cmon_id
      WHERE cp.cot_id = ${id}
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async setCreditDate(id, days) {
    debug('quoteService -> setCreditDate')

    const queryString = `
      UPDATE ${this.table}
      SET
        credito_fecha = DATE_ADD(NOW(), INTERVAL ${days} DAY)
      WHERE cot_id = ${id}
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getBuyerAndSeller(quote) {
    debug('quoteService -> getBuyerAndSeller')

    const queryString = `
      SELECT
        c.usu_id_comprador AS 'usuario_comprador',
        c.usu_id_vendedor AS 'usuario_vendedor',
        c.emp_id_vendedor AS 'empresa_vendedora',
        c.emp_id_comprador AS 'empresa_compradora',
        vendedora.emp_nombre AS 'empresa_vendedora_nombre',
        compradora.emp_nombre AS 'empresa_compradora_nombre'
      FROM cotizacion AS c
      JOIN empresa AS vendedora
      ON vendedora.emp_id = c.emp_id_vendedor
      JOIN empresa AS compradora
      ON compradora.emp_id = c.emp_id_comprador
      WHERE c.cot_id = ${quote}
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async insertPaymentProof(quote, uuid, image) {
    debug('quoteService -> insertPayment')

    const queryString = `
      INSERT INTO cotizacion_pago
      (foto_uuid, cot_id, imagen)
      VALUES
      ('${uuid}', ${quote.cot_id}, '${image}')
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getPaymentProof(quote) {
    debug('quoteService -> getPayment')
    const queryString = `
      SELECT * FROM cotizacion_pago
      WHERE cot_id = ${quote}
      ORDER BY fecha DESC
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getPaymentProofById(id) {
    debug('quoteService -> getPaymentProofById')
    const queryString = `SELECT * FROM cotizacion_pago WHERE foto_uuid = "${id}"`
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getQuoteDetailsForDocumentDetails(id) {
    debug('quoteService -> getQuoteDetailsForDocumentDetails')
    const queryString = `
      SELECT
        c.cot_id AS "cotizacion_id",
        c.cot_delivery AS "fecha_envio",
        c.cot_comentario AS "cotizacion_comentario",
        c.created_at AS "cotizacion_fecha_creacion",
        c.descuento AS "cotizacion_descuento",
        c.credito_fecha AS "cotizacion_credito_fecha",
        c.credito_dias AS "cotizacion_credito_dias",
        uv.usu_id AS "usuario_vendedor_id",
        uv.usu_nombre AS "usuario_vendedor_nombre",
        uv.usu_app AS "usuario_vendedor_apellido",
        uv.usu_puesto AS "usuario_vendedor_puesto",
        uv.usu_email AS "usuario_vendedor_email",
        uv.usu_foto AS "usuario_vendedor_avatar",
        uv.usu_tipo AS "usuario_vendedor_tipo",
        uc.usu_id AS "usuario_comprador_id",
        uc.usu_nombre AS "usuario_comprador_nombre",
        uc.usu_app AS "usuario_comprador_apellido",
        uc.usu_puesto AS "usuario_comprador_puesto",
        uc.usu_email AS "usuario_comprador_email",
        uc.usu_foto AS "usuario_comprador_avatar",
        uc.usu_tipo AS "usuario_comprador_tipo",
        ev.emp_id AS "empresa_vendedora_id",
        ev.emp_nombre AS "empresa_vendedora_nombre",
        ev.emp_razon_social AS "empresa_vendedora_razon_social",
        ev.emp_rfc AS "empresa_vendedora_rfc",
        ev.emp_website AS "empresa_vendedora_website",
        ev.emp_logo AS "empresa_vendedora_logo",
        ev.emp_banner AS "empresa_vendedora_banner",
        ev.emp_certificada AS "empresa_vendedora_certificada",
        ec.emp_id AS "empresa_compradora_id",
        ec.emp_nombre AS "empresa_compradora_nombre",
        ec.emp_razon_social AS "empresa_compradora_razon_social",
        ec.emp_rfc AS "empresa_compradora_rfc",
        ec.emp_website AS "empresa_compradora_website",
        ec.emp_logo AS "empresa_compradora_logo",
        ec.emp_banner AS "empresa_compradora_banner",
        ec.emp_certificada AS "empresa_compradora_certificada",
        cmp.cmetodo_id AS "metodo_pago_id",
        cmp.cmetodo_desc_esp AS "metodo_pago",
        d.domicilio_id AS "domicilio_id",
        d.estado_id AS "domicilio_estado_id",
        d.domicilio_tipo AS "domicilio_tipo",
        d.nombre AS "domicilio_nombre",
        d.direccion AS "domicilio_direccion",
        et.nombre AS "estado",
        pt.nombre AS "pais"
      FROM ${this.table} AS c
      JOIN usuario as uv ON uv.usu_id = c.usu_id_vendedor
      JOIN usuario as uc ON uc.usu_id = c.usu_id_comprador
      JOIN empresa AS ev ON ev.emp_id = c.emp_id_vendedor
      JOIN empresa AS ec ON ec.emp_id = c.emp_id_comprador
      JOIN cat_metodo_pago AS cmp USING(cmetodo_id)
      JOIN domicilio AS d USING(domicilio_id)
      JOIN estado AS e USING(estado_id)
      JOIN estado_translate AS et USING(estado_id)
      JOIN pais AS p USING(pais_id)
      JOIN pais_translate AS pt USING(pais_id)
      WHERE c.cot_id = ${id}
      AND et.idioma_id = 1
      AND pt.idioma_id = 1
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getQuoteDetailsForDocumentProducts(id) {
    debug('quoteService -> getQuoteDetailsForDocumentProducts')
    const queryString = `
      SELECT
        cp.prod_id AS "producto_id",
        cp.cp_cantidad AS "cotizacion_producto_cantidad",
        cp.cp_precio AS "cotizacion_producto_precio",
        cp.cot_mejorprecio AS "cotizacion_producto_mejor_precio",
        cp.cot_calificacion AS "cotizacion_producto_calificacion",
        cp.cot_prod_comentario AS "cotizacion_producto_comentario",
        p.prod_clearance AS "producto_clearance",
        p.prod_precio_lista AS "producto_precio_lista",
        p.prod_precio_promo AS "producto_precio_promo",
        p.prod_precio_envio AS "producto_precio_envio",
        p.prod_compra_minima AS "producto_compra_minima",
        p.cuni_id AS "producto_unidad_id",
        p.prod_precio_envio AS "producto_envio",
        p.prod_marca AS "producto_marca",
        p.prod_precio_envio_nacional AS "producto_precio_envio_nacional",
        p.prod_precio_envio_internacional AS "producto_precio_envio_internacional",
        p.prod_categoria_id AS "producto_categoria_id",
        pt.prod_nombre AS "nombre",
        pt.prod_desc AS "descripcion"
      FROM cot_productos AS cp
      JOIN producto AS p USING(prod_id)
      JOIN producto_translate AS pt USING(prod_id)
      WHERE cot_id = ${id}
      AND pt.idioma_id = "1"
      AND pt.prod_nombre <> ""
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getQuoteProductsForReviewEmail(id) {
    debug('quoteService -> getQuoteProductsForReviewEmail')
    const queryString = `
      SELECT
        cp.prod_id AS "product_id",
        cp.emp_id_vendedor AS "company_id",
        p.prod_marca AS "product_brand",
        e.emp_nombre AS "company_name",
        e.emp_razon_social AS "company_business_name",
        e.emp_rfc AS "company_rfc",
        e.emp_website AS "company_website",
        e.emp_logo AS "company_logo",
        pt.prod_nombre AS "product_name",
        pt.prod_desc AS "product_description"
      FROM cot_productos AS cp
      JOIN producto AS p using(prod_id)
      JOIN empresa AS e on e.emp_id = cp.emp_id_vendedor
      JOIN producto_translate AS pt using(prod_id)
      WHERE cot_id = ${id}
      AND pt.idioma_id = 1
      AND pt.prod_nombre <> ""
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getFatherQuoteId(id) {
    debug('quoteService -> getQuoteProductsForReviewEmail')
    const queryString = `
      SELECT *
      FROM cot_bitacora
      WHERE cot_children_id = ${id}
    `
    const { result: resultRaw } = await mysqlLib.query(queryString)
    const [result] = resultRaw
    if (result) {
      const { cot_father_id: cot } = result
      return cot
    }
    return Number(id)
  }

  async getQuotesToRateAdmin(company) {
    debug('quoteService -> getQuotesToRateAdmin')
    const queryString = `
      SELECT
        c.cot_id,
        c.cot_delivery,
        c.cmetodo_id,
        c.cpais_id,
        c.created_at,
        c.updated_at,
        c.credito_fecha,
        u.usu_id,
        u.usu_nombre,
        u.usu_app,
        u.usu_puesto,
        u.usu_foto,
        e.emp_id,
        e.emp_nombre,
        e.emp_razon_social,
        e.emp_certificada,
        e.emp_logo,
        e.emp_banner
      FROM cotizacion AS c
      JOIN usuario AS u on u.usu_id = c.usu_id_vendedor
      JOIN empresa AS e on e.emp_id = c.emp_id_vendedor
      LEFT JOIN cot_experiencia AS ce ON ce.cot_id = c.cot_id
      WHERE emp_id_comprador = ${company}
      AND cot_status = 2
      AND cot_delivery <= NOW()
      AND ce.fecha_creacion IS NULL
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getQuotesToRateBuyer(user) {
    debug('quoteService -> getQuotesToRateBuyer')
    const queryString = `
      SELECT
        c.cot_id,
        c.cot_delivery,
        c.cmetodo_id,
        c.cpais_id,
        c.created_at,
        c.updated_at,
        c.credito_fecha,
        u.usu_id,
        u.usu_nombre,
        u.usu_app,
        u.usu_puesto,
        u.usu_foto,
        e.emp_id,
        e.emp_nombre,
        e.emp_razon_social,
        e.emp_certificada,
        e.emp_logo,
        e.emp_banner
      FROM cotizacion AS c
      JOIN usuario AS u on u.usu_id = c.usu_id_vendedor
      JOIN empresa AS e on e.emp_id = c.emp_id_vendedor
      LEFT JOIN cot_experiencia AS ce ON ce.cot_id = c.cot_id
      WHERE usu_id_comprador = ${user}
      AND cot_status = 2
      AND cot_delivery <= NOW()
      AND ce.fecha_creacion IS NULL
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getSuccessCases(idiomaId) {
    const queryString = `
    select concat(trim(e.emp_nombre), ' ',trim(e.emp_razon_social)) as emp_vendedora, e.emp_phone,
        (select pt2.prod_nombre from producto_translate pt2 where pt2.prod_id = cp.prod_id and pt2.idioma_id = ${idiomaId}) as prod_nombre,
        cp.cp_cantidad as prod_cantidad, p.cuni_id as prod_unidad,
        cp.cp_cantidad * cp.cp_precio as total,
        cm.cmon_desc_esp as moneda,
        (select ce.comentario from cot_experiencia ce where ce.cot_id = cp.cot_id and ce.estatus = 'Activo') as cot_comentario,
        (select pt2.nombre from domicilio d, estado ee, pais_translate pt2
            where d.emp_id = cp.emp_id_vendedor and d.estado_id = ee.estado_id and ee.pais_id = pt2.pais_id and pt2.idioma_id = ${idiomaId} and d.domicilio_tipo = 1 limit 1) as pais_vendedor,
        (select pt2.nombre from domicilio d, estado ee, pais_translate pt2
            where c.domicilio_id = d.domicilio_id and d.estado_id = ee.estado_id and ee.pais_id = pt2.pais_id and pt2.idioma_id = ${idiomaId}) as pais_comprador,
        (select pf.foto_url from producto_foto pf where cp.prod_id = pf.prod_id and pf.foto_num = 1) as prod_foto_url,
        (select ef.ef_url from empresa_foto ef where ef.emp_id = e.emp_id limit 1) as emp_vendedora_foto_url
    from cot_productos cp
        join empresa e on e.emp_id = cp.emp_id_vendedor
        join empresa_usuario eu on cp.emp_id_vendedor = eu.emp_id
        join usuario u on u.usu_id = eu.usu_id
        join producto p on cp.prod_id = p.prod_id
        join cat_moneda cm on p.cmon_id = cm.cmon_id
        join cotizacion c on cp.cot_id = c.cot_id

    where  eu.tipo = 1 and u.usu_tipo = 3 and (
                  u.usu_email like '%arcsa%'
                  or u.usu_email like '%bloc%'
                  or u.usu_email like '%marketchoice%'
              )
    order by rand() limit 10
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }
}

const inst = new QuoteService()
Object.freeze(inst)

module.exports = inst
