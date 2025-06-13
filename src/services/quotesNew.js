'use strict'
const debug = require('debug')('old-api:quotes-service')
const mysqlLib = require('../lib/db')

class QuoteNewService {
  constructor () {
    if (QuoteNewService.instance == null) {
      this.className = 'QuoteService'
      this.table = 'cotizacion'
      this.queryInfo = `
        SELECT
          c.cot_id AS "cotizacion_id",
          c.cot_delivery AS "cotizacion_delivery",
          c.cot_comentario AS "cotizacion_comentario",
          c.created_at AS "cotizacion_fecha_creacion",
          c.updated_at AS "cotizacion_fecha_actualizacion",
          c.descuento AS "cotizacion_descuento",
          c.visto AS "cotizacion_visto",
          c.cot_status AS "cotizacion_estatus",
          c.credito_fecha AS "cotizacion_credito_fecha",
          c.credito_dias AS "cotizacion_credito_dias",
          cb.cot_father_id AS "cotizacion_padre_id",
          COALESCE(cp.created_at, c.created_at) AS "cotizacion_padre_fecha",
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
          uv.usu_id AS "usuario_vendedor_id",
          uv.usu_nombre AS "usuario_vendedor_nombre",
          uv.usu_app AS "usuario_vendedor_app",
          uv.usu_puesto AS "usuario_vendedor_puesto",
          uv.usu_email AS "usuario_vendedor_email",
          uv.usu_foto AS "usuario_vendedor_foto",
          uv.usu_tipo AS "usuario_vendedor_tipo",
          uc.usu_id AS "usuario_comprador_id",
          uc.usu_nombre AS "usuario_comprador_nombre",
          uc.usu_app AS "usuario_comprador_app",
          uc.usu_puesto AS "usuario_comprador_puesto",
          uc.usu_email AS "usuario_comprador_email",
          uc.usu_foto AS "usuario_comprador_foto",
          uc.usu_tipo AS "usuario_comprador_tipo",
          cmp.cmetodo_desc_esp AS "metodo_pago"
      `
      this.queryFrom = `
        FROM cotizacion AS c
        LEFT JOIN cot_bitacora AS cb ON cb.cot_children_id = c.cot_id
        LEFT JOIN cotizacion AS cp ON cp.cot_id = cb.cot_father_id
        JOIN empresa AS ev ON ev.emp_id = c.emp_id_vendedor
        JOIN empresa AS ec ON ec.emp_id = c.emp_id_comprador
        JOIN usuario AS uv ON uv.usu_id = c.usu_id_vendedor
        JOIN usuario AS uc ON uc.usu_id = c.usu_id_comprador
        JOIN cat_metodo_pago AS cmp ON cmp.cmetodo_id = c.cmetodo_id
      `
      this.queryDetails = `${this.queryInfo}${this.queryFrom}`
      QuoteNewService.instance = this
    }
    return QuoteNewService.instance
  }

  async getUserDetails (id) {
    debug(`${this.className} => getUserDetails`)
    const queryString = `
      SELECT
        u.usu_tipo AS 'userType',
        e.emp_id AS 'companyID'
      FROM usuario AS u
      JOIN empresa_usuario AS eu USING(usu_id)
      JOIN empresa AS e USING(emp_id)
      WHERE u.usu_id = ${id}
    `
    const { result: resultUserRaw } = await mysqlLib.query(queryString)
    const [user] = resultUserRaw
    return user
  }

  async getNotSeenMessages (user, quote) {
    debug('quoteService -> getNotSeenMessages')
    const queryString = `
      SELECT COUNT(*) AS "total"
      FROM comentario_cotizacion
      WHERE cot_id = ${quote}
      AND visto = 0
      AND autor <> ${user}
    `
    const { result: resultTotal } = await mysqlLib.query(queryString)
    const [totalRaw] = resultTotal
    const { total } = totalRaw
    return total
  }

  async getTotalAmount (products) {
    debug('quoteService -> getTotalAmount')
    const total = products.reduce((iv, product) => {
      const { cantidad, precio } = product
      iv += (cantidad * precio)
      return iv
    }, 0)
    return total
  }

  async getFirstProductProperties (quote, product) {
    debug('quoteService -> getFirstProductProperties')
    if (product) {
      const { moneda, cotizacion_calificacion: rate, cotizacion_calificacion_comentario: comment, cotizacion_producto_version: version } = product
      quote.moneda = moneda
      quote.calificacion = rate
      quote.calificacion_comentario = comment
      quote.version = version
      return
    }
    quote.moneda = null
    quote.calificacion = null
    quote.calificacion_comentario = null
    quote.version = null
  }

  async getReportSolicitude (company, quote) {
    debug('quoteService -> getReportSolicitude')
    const { cotizacion_id: quoteID, empresa_vendedora_id: sellerID, empresa_compradora_id: buyerID } = quote
    const origin = company === sellerID ? sellerID : buyerID
    const destiny = company === sellerID ? buyerID : sellerID
    const query = `
      SELECT
        reporte_id, estatus, url, fecha_creacion, fecha_actualizacion
      FROM reporte_credito_solicitud
      WHERE cot_id = ${quoteID}
      AND empresa_solicitante = ${origin}
      AND empresa_destino = ${destiny}
    `
    const { result: raw } = await mysqlLib.query(query)
    const [result] = raw
    if (result) return result
    return null
  }

  async getPhotosByProductID (product) {
    debug('quoteService -> getPhotosByProductID')
    const queryPhotos = `
      SELECT *
      FROM producto_foto
      WHERE prod_id = ${product}
    `
    const { result } = await mysqlLib.query(queryPhotos)
    return result
  }

  async getProductsByQuoteID (quote) {
    debug('quoteService -> getProductsByQuoteID')
    const queryProducts = `
      SELECT
        cp.cp_cantidad AS "cantidad",
        cp.cp_precio AS "precio",
        cp.cot_mejorprecio AS "cotizacion_mejor_precio",
        cp.cot_calificacion AS "cotizacion_calificacion",
        cp.cot_calificacion_comentario AS "cotizacion_calificacion_comentario",
        cp.cot_prod_comentario AS "cotizacion_producto_comentario",
        cp.cot_version AS "cotizacion_producto_version",
        p.prod_id AS "producto_id",
        p.prod_nuevo AS "nuevo",
        p.prod_clearance AS "clearance",
        p.prod_precio_lista AS "precio_lista",
        p.prod_precio_promo AS "precio_promo",
        p.prod_compra_minima AS "compra_minima",
        p.prod_cobertura_loc AS "cobertura_local",
        p.prod_cobertura_nac AS "cobertura_nacional",
        p.prod_cobertura_int AS "cobertura_internacional",
        p.prod_disponible AS "disponible",
        p.prod_precio_envio AS "precio_envio_local",
        p.prod_precio_envio_nacional AS "precio_envio_nacional",
        p.prod_precio_envio_internacional AS "precio_envio_internacional",
        pt.prod_nombre AS "nombre",
        pt.prod_desc AS "descripcion",
        pt.prod_video AS "video",
        cm.cmon_desc_esp AS "moneda",
        cu.cuni_desc_esp AS "unidad"
      FROM cot_productos AS cp
      JOIN producto AS p USING(prod_id)
      JOIN producto_translate AS pt USING(prod_id)
      JOIN cat_moneda AS cm USING(cmon_id)
      JOIN cat_unidad AS cu USING(cuni_id)
      WHERE cp.cot_id = ${quote}
      AND pt.idioma_id = 1
    `
    const { result: products } = await mysqlLib.query(queryProducts)

    for (let i = 0; i < products.length; i++) {
      const product = products[i].producto_id
      const photos = await this.getPhotosByProductID(product)
      products[i].fotos = photos
    }

    return products
  }

  async getAdminClosed (user, company) {
    debug('quoteService -> getAdminClosed')
    const queryString = `${this.queryDetails}
      WHERE
      (c.emp_id_vendedor = ${company}
      or c.emp_id_comprador = ${company})
      AND c.cot_status = 2
      ORDER BY c.cot_id DESC
    `
    const { result: resultQuotes } = await mysqlLib.query(queryString)

    for (let i = 0; i < resultQuotes.length; i++) {
      const quote = resultQuotes[i].cotizacion_id
      const products = await this.getProductsByQuoteID(quote)
      const [product] = products
      await this.getFirstProductProperties(resultQuotes[i], product)
      resultQuotes[i].total = await this.getTotalAmount(products)
      resultQuotes[i].mensajes_no_vistos = await this.getNotSeenMessages(user, quote)
      resultQuotes[i].reporte = await this.getReportSolicitude(company, resultQuotes[i])
      resultQuotes[i].productos = products
    }

    return resultQuotes
  }

  async getAdminDeleted (user, company) {
    debug('quoteService -> getAdminDeleted')
    const queryString = `${this.queryDetails}
      WHERE
      (c.emp_id_vendedor = ${company}
      or c.emp_id_comprador = ${company})
      AND c.cot_status = 3
      ORDER BY c.cot_id DESC
    `
    const { result: resultQuotes } = await mysqlLib.query(queryString)

    for (let i = 0; i < resultQuotes.length; i++) {
      const quote = resultQuotes[i].cotizacion_id
      const products = await this.getProductsByQuoteID(quote)
      const [product] = products
      await this.getFirstProductProperties(resultQuotes[i], product)
      resultQuotes[i].total = await this.getTotalAmount(products)
      resultQuotes[i].mensajes_no_vistos = await this.getNotSeenMessages(user, quote)
      resultQuotes[i].reporte = await this.getReportSolicitude(company, resultQuotes[i])
      resultQuotes[i].productos = products
    }

    return resultQuotes
  }

  async getChildQuotes (quotes) {
    debug('quoteService -> getChildQuotes')
    const copyQuotes = [...quotes]
    const fathers = copyQuotes.filter(q => q.cotizacion_padre_id === null)
    const childsRaw = copyQuotes.filter(q => q.cotizacion_padre_id !== null)

    const childsReduce = childsRaw.reduce((iv, cv) => {
      const key = cv.cotizacion_padre_id
      if (!iv[key]) {
        iv[key] = []
      }
      iv[key].push(cv)
      return iv
    }, {})

    const childs = []
    for (const key in childsReduce) {
      const childsArrayRaw = childsReduce[key]
      const childsArray = [...childsArrayRaw]
      childs.push(childsArray.shift())
    }

    const childsFathersIDS = childs.map(c => c.cotizacion_padre_id)

    const childQuotes = [...childs]
    fathers.forEach(f => {
      const id = f.cotizacion_id
      if (!childsFathersIDS.includes(id)) {
        childQuotes.push(f)
      }
    })

    childQuotes.sort((a, b) => a.cotizacion_id < b.cotizacion_id ? 1 : -1)

    return childQuotes
  }

  async getAdminOpen (user, company) {
    debug('quoteService -> getAdminOpen')
    const queryString = `${this.queryDetails}
      WHERE
      (c.emp_id_vendedor = ${company}
      or c.emp_id_comprador = ${company})
      AND (
        c.cot_status = 1
        OR c.cot_status = 4
      )
      ORDER BY c.cot_id DESC
    `
    const { result: resultQuotes } = await mysqlLib.query(queryString)

    const quotes = await this.getChildQuotes(resultQuotes)

    for (let i = 0; i < quotes.length; i++) {
      const quote = quotes[i].cotizacion_id
      const products = await this.getProductsByQuoteID(quote)
      const [product] = products
      await this.getFirstProductProperties(quotes[i], product)
      quotes[i].total = await this.getTotalAmount(products)
      quotes[i].mensajes_no_vistos = await this.getNotSeenMessages(user, quote)
      quotes[i].reporte = await this.getReportSolicitude(company, quotes[i])
      quotes[i].productos = products
    }
    return quotes
  }

  async getAdminCanReport (user, company) {
    debug('quoteService -> getAdminCanReport')
    const queryString = `${this.queryDetails}
      LEFT JOIN reporte_cotizacion AS rc ON rc.cot_id = c.cot_id
      WHERE
      (c.emp_id_vendedor = ${company}
      or c.emp_id_comprador = ${company})
      AND c.cot_status = 2
      AND rc.rep_id IS NULL
      ORDER BY c.cot_id DESC
    `
    const { result: resultQuotes } = await mysqlLib.query(queryString)

    const quotes = await this.getChildQuotes(resultQuotes)

    for (let i = 0; i < quotes.length; i++) {
      const quote = quotes[i].cotizacion_id
      const products = await this.getProductsByQuoteID(quote)
      const [product] = products
      await this.getFirstProductProperties(quotes[i], product)
      quotes[i].total = await this.getTotalAmount(products)
      quotes[i].mensajes_no_vistos = await this.getNotSeenMessages(user, quote)
      quotes[i].reporte = await this.getReportSolicitude(company, quotes[i])
      quotes[i].productos = products
    }
    return quotes
  }

  async reduceAdminQuotes (company, quotes) {
    debug('quoteService -> reduceAdminQuotes')
    const quotesReduce = [...quotes].reduce((iv, quote) => {
      const { empresa_vendedora_id: quoteSeller, empresa_compradora_id: quoteBuyer } = quote
      if (company === quoteSeller) {
        iv.ventas.push(quote)
      } else if (company === quoteBuyer) {
        iv.compras.push(quote)
      }
      return iv
    }, { compras: [], ventas: [] })

    const { compras, ventas } = quotesReduce

    const data = {
      compras: {
        total: compras.length,
        payload: compras
      },
      ventas: {
        total: ventas.length,
        payload: ventas
      }
    }
    return data
  }

  async getAdminReported (user, company) {
    debug('quoteService -> getAdminReported')
    const queryString = `${this.queryInfo},
      rc.vigente AS "reporte_vigente"
      ${this.queryFrom}
      LEFT JOIN reporte_cotizacion AS rc ON rc.cot_id = c.cot_id
      WHERE
      (c.emp_id_vendedor = ${company}
      OR c.emp_id_comprador = ${company})
      AND c.cot_status = 2
      ORDER BY c.cot_id DESC
    `
    const { result: resultQuotes } = await mysqlLib.query(queryString)

    for (let i = 0; i < resultQuotes.length; i++) {
      const quote = resultQuotes[i].cotizacion_id
      const products = await this.getProductsByQuoteID(quote)
      const [product] = products
      await this.getFirstProductProperties(resultQuotes[i], product)
      resultQuotes[i].total = await this.getTotalAmount(products)
      resultQuotes[i].mensajes_no_vistos = await this.getNotSeenMessages(user, quote)
      resultQuotes[i].reporte = await this.getReportSolicitude(company, resultQuotes[i])
      resultQuotes[i].productos = products
    }

    return resultQuotes
  }

  async getBuyerOpen (user, company) {
    debug('quoteService -> getBuyerOpen')
    const queryString = `${this.queryDetails}
      WHERE
      c.usu_id_comprador = ${user}
      AND (
        c.cot_status = 1
        OR c.cot_status = 4
      )
      ORDER BY c.cot_id DESC
    `
    const { result: resultQuotes } = await mysqlLib.query(queryString)

    const quotes = await this.getChildQuotes(resultQuotes)
    for (let i = 0; i < quotes.length; i++) {
      const quote = quotes[i].cotizacion_id
      const products = await this.getProductsByQuoteID(quote)
      const [product] = products
      await this.getFirstProductProperties(quotes[i], product)
      quotes[i].total = await this.getTotalAmount(products)
      quotes[i].mensajes_no_vistos = await this.getNotSeenMessages(user, quote)
      quotes[i].reporte = await this.getReportSolicitude(company, quotes[i])
      quotes[i].productos = products
    }
    return quotes
  }

  async getBuyerClosed (user, company) {
    debug('quoteService -> getBuyerClosed')
    const queryString = `${this.queryDetails}
      WHERE
      c.usu_id_comprador = ${user}
      AND c.cot_status = 2
      ORDER BY c.cot_id DESC
    `
    const { result: quotes } = await mysqlLib.query(queryString)

    for (let i = 0; i < quotes.length; i++) {
      const quote = quotes[i].cotizacion_id
      const products = await this.getProductsByQuoteID(quote)
      const [product] = products
      await this.getFirstProductProperties(quotes[i], product)
      quotes[i].total = await this.getTotalAmount(products)
      quotes[i].mensajes_no_vistos = await this.getNotSeenMessages(user, quote)
      quotes[i].reporte = await this.getReportSolicitude(company, quotes[i])
      quotes[i].productos = products
    }
    return quotes
  }

  async getBuyerDeleted (user, company) {
    debug('quoteService -> getBuyerDeleted')
    const queryString = `${this.queryDetails}
      WHERE
      c.usu_id_comprador = ${user}
      AND c.cot_status = 3
      ORDER BY c.cot_id DESC
    `
    const { result: resultQuotes } = await mysqlLib.query(queryString)

    const quotes = await this.getChildQuotes(resultQuotes)

    for (let i = 0; i < quotes.length; i++) {
      const quote = quotes[i].cotizacion_id
      const products = await this.getProductsByQuoteID(quote)
      const [product] = products
      await this.getFirstProductProperties(quotes[i], product)
      quotes[i].total = await this.getTotalAmount(products)
      quotes[i].mensajes_no_vistos = await this.getNotSeenMessages(user, quote)
      quotes[i].reporte = await this.getReportSolicitude(company, quotes[i])
      quotes[i].productos = products
    }
    return quotes
  }

  async getBuyerReported (user, company) {
    debug('quoteService -> getBuyerReported')
    const queryString = `${this.queryInfo},
      rc.vigente AS "reporte_vigente"
      ${this.queryFrom}
      LEFT JOIN reporte_cotizacion AS rc ON rc.cot_id = c.cot_id
      WHERE
      c.usu_id_comprador = ${user}
      AND c.cot_status = 2
      ORDER BY c.cot_id DESC
    `
    const { result: quotes } = await mysqlLib.query(queryString)

    for (let i = 0; i < quotes.length; i++) {
      const quote = quotes[i].cotizacion_id
      const products = await this.getProductsByQuoteID(quote)
      const [product] = products
      await this.getFirstProductProperties(quotes[i], product)
      quotes[i].total = await this.getTotalAmount(products)
      quotes[i].mensajes_no_vistos = await this.getNotSeenMessages(user, quote)
      quotes[i].reporte = await this.getReportSolicitude(company, quotes[i])
      quotes[i].productos = products
    }
    return quotes
  }

  async getBuyerCanReport (user, company) {
    debug('quoteService -> getBuyerCanReport')
    const queryString = `${this.queryDetails}
      LEFT JOIN reporte_cotizacion AS rc ON rc.cot_id = c.cot_id
      WHERE
      c.usu_id_comprador = ${user}
      AND c.cot_status = 2
      AND rc.rep_id IS NULL
      ORDER BY c.cot_id DESC
    `
    const { result: quotesRaw } = await mysqlLib.query(queryString)

    const quotes = await this.getChildQuotes(quotesRaw)

    for (let i = 0; i < quotes.length; i++) {
      const quote = quotes[i].cotizacion_id
      const products = await this.getProductsByQuoteID(quote)
      const [product] = products
      await this.getFirstProductProperties(quotes[i], product)
      quotes[i].total = await this.getTotalAmount(products)
      quotes[i].mensajes_no_vistos = await this.getNotSeenMessages(user, quote)
      quotes[i].reporte = await this.getReportSolicitude(company, quotes[i])
      quotes[i].productos = products
    }
    return quotes
  }

  async getSellerOpen (user, company) {
    debug('quoteService -> getSellerOpen')
    const queryString = `${this.queryDetails}
      WHERE
      c.usu_id_vendedor = ${user}
      AND (
        c.cot_status = 1
        OR c.cot_status = 4
      )
      ORDER BY c.cot_id DESC
    `
    const { result: resultQuotes } = await mysqlLib.query(queryString)

    const quotes = await this.getChildQuotes(resultQuotes)

    for (let i = 0; i < quotes.length; i++) {
      const quote = quotes[i].cotizacion_id
      const products = await this.getProductsByQuoteID(quote)
      const [product] = products
      await this.getFirstProductProperties(quotes[i], product)
      quotes[i].total = await this.getTotalAmount(products)
      quotes[i].mensajes_no_vistos = await this.getNotSeenMessages(user, quote)
      quotes[i].reporte = await this.getReportSolicitude(company, quotes[i])
      quotes[i].productos = products
    }
    return quotes
  }

  async getSellerClosed (user, company) {
    debug('quoteService -> getSellerClosed')
    const queryString = `${this.queryDetails}
      WHERE
      c.usu_id_vendedor = ${user}
      AND c.cot_status = 2
      ORDER BY c.cot_id DESC
    `
    const { result: quotes } = await mysqlLib.query(queryString)

    for (let i = 0; i < quotes.length; i++) {
      const quote = quotes[i].cotizacion_id
      const products = await this.getProductsByQuoteID(quote)
      const [product] = products
      await this.getFirstProductProperties(quotes[i], product)
      quotes[i].total = await this.getTotalAmount(products)
      quotes[i].mensajes_no_vistos = await this.getNotSeenMessages(user, quote)
      quotes[i].reporte = await this.getReportSolicitude(company, quotes[i])
      quotes[i].productos = products
    }
    return quotes
  }

  async getSellerDeleted (user, company) {
    debug('quoteService -> getSellerDeleted')
    const queryString = `${this.queryDetails}
      WHERE
      c.usu_id_vendedor = ${user}
      AND c.cot_status = 3
      ORDER BY c.cot_id DESC
    `
    const { result: quotes } = await mysqlLib.query(queryString)

    for (let i = 0; i < quotes.length; i++) {
      const quote = quotes[i].cotizacion_id
      const products = await this.getProductsByQuoteID(quote)
      const [product] = products
      await this.getFirstProductProperties(quotes[i], product)
      quotes[i].total = await this.getTotalAmount(products)
      quotes[i].mensajes_no_vistos = await this.getNotSeenMessages(user, quote)
      quotes[i].reporte = await this.getReportSolicitude(company, quotes[i])
      quotes[i].productos = products
    }
    return quotes
  }

  async getSellerReported (user, company) {
    debug('quoteService -> getSellerReported')
    const queryString = `${this.queryInfo},
      rc.vigente AS "reporte_vigente"
      ${this.queryFrom}
      LEFT JOIN reporte_cotizacion AS rc ON rc.cot_id = c.cot_id
      WHERE
      c.usu_id_vendedor = ${user}
      AND c.cot_status = 2
      ORDER BY c.cot_id DESC
    `
    const { result: quotes } = await mysqlLib.query(queryString)

    for (let i = 0; i < quotes.length; i++) {
      const quote = quotes[i].cotizacion_id
      const products = await this.getProductsByQuoteID(quote)
      const [product] = products
      await this.getFirstProductProperties(quotes[i], product)
      quotes[i].total = await this.getTotalAmount(products)
      quotes[i].mensajes_no_vistos = await this.getNotSeenMessages(user, quote)
      quotes[i].reporte = await this.getReportSolicitude(company, quotes[i])
      quotes[i].productos = products
    }
    return quotes
  }

  async getSellerCanReport (user, company) {
    debug('quoteService -> getSellerCanReport')
    const queryString = `${this.queryDetails}
      LEFT JOIN reporte_cotizacion AS rc ON rc.cot_id = c.cot_id
      WHERE
      c.usu_id_vendedor = ${user}
      AND c.cot_status = 2
      AND rc.rep_id IS NULL
      ORDER BY c.cot_id DESC
    `
    const { result: quotesRaw } = await mysqlLib.query(queryString)

    const quotes = await this.getChildQuotes(quotesRaw)

    for (let i = 0; i < quotes.length; i++) {
      const quote = quotes[i].cotizacion_id
      const products = await this.getProductsByQuoteID(quote)
      const [product] = products
      await this.getFirstProductProperties(quotes[i], product)
      quotes[i].total = await this.getTotalAmount(products)
      quotes[i].mensajes_no_vistos = await this.getNotSeenMessages(user, quote)
      quotes[i].reporte = await this.getReportSolicitude(company, quotes[i])
      quotes[i].productos = products
    }
    return quotes
  }

  async getAdminNonComplianceQuotes (user, userCompany, destinyCompany) {
    debug('quoteService -> getAdminNonComplianceQuotes')
    const queryString = `${this.queryDetails}
    JOIN reporte_cotizacion AS rp ON rp.cot_id = c.cot_id
    WHERE
    (
      (c.emp_id_vendedor = ${userCompany} AND c.emp_id_comprador = ${destinyCompany})
      OR
      (c.emp_id_vendedor = ${destinyCompany} AND c.emp_id_comprador = ${userCompany})
    )
    AND c.cot_status = 2
    ORDER BY c.cot_id DESC
    `
    const { result: quotes } = await mysqlLib.query(queryString)

    for (let i = 0; i < quotes.length; i++) {
      const quote = quotes[i].cotizacion_id
      const products = await this.getProductsByQuoteID(quote)
      const [product] = products
      await this.getFirstProductProperties(quotes[i], product)
      quotes[i].total = await this.getTotalAmount(products)
      quotes[i].mensajes_no_vistos = await this.getNotSeenMessages(user, quote)
      quotes[i].reporte = await this.getReportSolicitude(userCompany, quotes[i])
      quotes[i].productos = products
    }

    return quotes
  }

  async getAdminNonComplianceQuotesDeals (user, userCompany, destinyCompany) {
    debug('quoteService -> getAdminNonComplianceQuotesDeals')
    const queryString = `${this.queryDetails}
    WHERE
    (
      (c.emp_id_vendedor = ${userCompany} AND c.emp_id_comprador = ${destinyCompany})
      OR
      (c.emp_id_vendedor = ${destinyCompany} AND c.emp_id_comprador = ${userCompany})
    )
    AND c.cot_status = 2
    ORDER BY c.cot_id DESC
    `
    const { result: quotes } = await mysqlLib.query(queryString)

    for (let i = 0; i < quotes.length; i++) {
      const quote = quotes[i].cotizacion_id
      const products = await this.getProductsByQuoteID(quote)
      const [product] = products
      await this.getFirstProductProperties(quotes[i], product)
      quotes[i].total = await this.getTotalAmount(products)
      quotes[i].mensajes_no_vistos = await this.getNotSeenMessages(user, quote)
      quotes[i].reporte = await this.getReportSolicitude(userCompany, quotes[i])
      quotes[i].productos = products
    }

    return quotes
  }

  async getAdminNonComplianceQuotesCanReport (user, userCompany, destinyCompany) {
    debug('quoteService -> getAdminNonComplianceQuotesCanReport')
    const queryString = `${this.queryDetails}
    LEFT JOIN reporte_cotizacion AS rc ON rc.cot_id = c.cot_id
    WHERE
    (
      (c.emp_id_vendedor = ${userCompany} AND c.emp_id_comprador = ${destinyCompany})
      OR
      (c.emp_id_vendedor = ${destinyCompany} AND c.emp_id_comprador = ${userCompany})
    )
    AND c.cot_status = 2
    AND rc.rep_id IS NULL
    ORDER BY c.cot_id DESC
    `
    const { result: quotesRaw } = await mysqlLib.query(queryString)

    const quotes = await this.getChildQuotes(quotesRaw)

    for (let i = 0; i < quotes.length; i++) {
      const quote = quotes[i].cotizacion_id
      const products = await this.getProductsByQuoteID(quote)
      const [product] = products
      await this.getFirstProductProperties(quotes[i], product)
      quotes[i].total = await this.getTotalAmount(products)
      quotes[i].mensajes_no_vistos = await this.getNotSeenMessages(user, quote)
      quotes[i].reporte = await this.getReportSolicitude(userCompany, quotes[i])
      quotes[i].productos = products
    }

    return quotes
  }

  async getBuyerNonComplianceQuotes (user, userCompany, destinyCompany) {
    debug('quoteService -> getBuyerNonComplianceQuotes')
    const queryString = `${this.queryDetails}
    JOIN reporte_cotizacion AS rp ON rp.cot_id = c.cot_id
    WHERE
    c.usu_id_comprador = ${user}
    AND c.emp_id_vendedor = ${destinyCompany}
    AND c.cot_status = 2
    ORDER BY c.cot_id DESC
    `
    const { result: quotes } = await mysqlLib.query(queryString)

    for (let i = 0; i < quotes.length; i++) {
      const quote = quotes[i].cotizacion_id
      const products = await this.getProductsByQuoteID(quote)
      const [product] = products
      await this.getFirstProductProperties(quotes[i], product)
      quotes[i].total = await this.getTotalAmount(products)
      quotes[i].mensajes_no_vistos = await this.getNotSeenMessages(user, quote)
      quotes[i].reporte = await this.getReportSolicitude(userCompany, quotes[i])
      quotes[i].productos = products
    }

    return quotes
  }

  async getBuyerNonComplianceQuotesDeals (user, userCompany, destinyCompany) {
    debug('quoteService -> getBuyerNonComplianceQuotesDeals')
    const queryString = `${this.queryDetails}
    WHERE
    c.usu_id_comprador = ${user}
    AND c.emp_id_vendedor = ${destinyCompany}
    AND c.cot_status = 2
    ORDER BY c.cot_id DESC
    `
    const { result: quotes } = await mysqlLib.query(queryString)

    for (let i = 0; i < quotes.length; i++) {
      const quote = quotes[i].cotizacion_id
      const products = await this.getProductsByQuoteID(quote)
      const [product] = products
      await this.getFirstProductProperties(quotes[i], product)
      quotes[i].total = await this.getTotalAmount(products)
      quotes[i].mensajes_no_vistos = await this.getNotSeenMessages(user, quote)
      quotes[i].reporte = await this.getReportSolicitude(userCompany, quotes[i])
      quotes[i].productos = products
    }

    return quotes
  }

  async getBuyerNonComplianceQuotesCanReport (user, userCompany, destinyCompany) {
    debug('quoteService -> getBuyerNonComplianceQuotesCanReport')
    const queryString = `${this.queryDetails}
    LEFT JOIN reporte_cotizacion AS rc ON rc.cot_id = c.cot_id
    WHERE
    c.usu_id_comprador = ${user}
    AND c.emp_id_vendedor = ${destinyCompany}
    AND c.cot_status = 2
    AND rc.rep_id IS NULL
    ORDER BY c.cot_id DESC
    `
    const { result: quotesRaw } = await mysqlLib.query(queryString)

    const quotes = await this.getChildQuotes(quotesRaw)

    for (let i = 0; i < quotes.length; i++) {
      const quote = quotes[i].cotizacion_id
      const products = await this.getProductsByQuoteID(quote)
      const [product] = products
      await this.getFirstProductProperties(quotes[i], product)
      quotes[i].total = await this.getTotalAmount(products)
      quotes[i].mensajes_no_vistos = await this.getNotSeenMessages(user, quote)
      quotes[i].reporte = await this.getReportSolicitude(userCompany, quotes[i])
      quotes[i].productos = products
    }

    return quotes
  }

  async getSellerNonComplianceQuotes (user, userCompany, destinyCompany) {
    debug('quoteService -> getSellerNonComplianceQuotes')
    const queryString = `${this.queryDetails}
    JOIN reporte_cotizacion AS rp ON rp.cot_id = c.cot_id
    WHERE
    c.usu_id_vendedor = ${user}
    AND c.emp_id_comprador = ${destinyCompany}
    AND c.cot_status = 2
    ORDER BY c.cot_id DESC
    `
    const { result: quotes } = await mysqlLib.query(queryString)

    for (let i = 0; i < quotes.length; i++) {
      const quote = quotes[i].cotizacion_id
      const products = await this.getProductsByQuoteID(quote)
      const [product] = products
      await this.getFirstProductProperties(quotes[i], product)
      quotes[i].total = await this.getTotalAmount(products)
      quotes[i].mensajes_no_vistos = await this.getNotSeenMessages(user, quote)
      quotes[i].reporte = await this.getReportSolicitude(userCompany, quotes[i])
      quotes[i].productos = products
    }

    return quotes
  }

  async getSellerNonComplianceQuotesDeals (user, userCompany, destinyCompany) {
    debug('quoteService -> getSellerNonComplianceQuotesDeals')
    const queryString = `${this.queryDetails}
    WHERE
    c.usu_id_vendedor = ${user}
    AND c.emp_id_comprador = ${destinyCompany}
    AND c.cot_status = 2
    ORDER BY c.cot_id DESC
    `
    const { result: quotes } = await mysqlLib.query(queryString)

    for (let i = 0; i < quotes.length; i++) {
      const quote = quotes[i].cotizacion_id
      const products = await this.getProductsByQuoteID(quote)
      const [product] = products
      await this.getFirstProductProperties(quotes[i], product)
      quotes[i].total = await this.getTotalAmount(products)
      quotes[i].mensajes_no_vistos = await this.getNotSeenMessages(user, quote)
      quotes[i].reporte = await this.getReportSolicitude(userCompany, quotes[i])
      quotes[i].productos = products
    }

    return quotes
  }

  async getSellerNonComplianceQuotesCanReport (user, userCompany, destinyCompany) {
    debug('quoteService -> getSellerNonComplianceQuotesCanReport')
    const queryString = `${this.queryDetails}
    LEFT JOIN reporte_cotizacion AS rc ON rc.cot_id = c.cot_id
    WHERE
    c.usu_id_vendedor = ${user}
    AND c.emp_id_comprador = ${destinyCompany}
    AND c.cot_status = 2
    AND rc.rep_id IS NULL
    ORDER BY c.cot_id DESC
    `
    const { result: quotesRaw } = await mysqlLib.query(queryString)

    const quotes = await this.getChildQuotes(quotesRaw)

    for (let i = 0; i < quotes.length; i++) {
      const quote = quotes[i].cotizacion_id
      const products = await this.getProductsByQuoteID(quote)
      const [product] = products
      await this.getFirstProductProperties(quotes[i], product)
      quotes[i].total = await this.getTotalAmount(products)
      quotes[i].mensajes_no_vistos = await this.getNotSeenMessages(user, quote)
      quotes[i].reporte = await this.getReportSolicitude(userCompany, quotes[i])
      quotes[i].productos = products
    }

    return quotes
  }
}

const inst = new QuoteNewService()
Object.freeze(inst)

module.exports = inst
