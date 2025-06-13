'use strict'

const path = require('path')
const debug = require('debug')('old-api:cotizacion-controller')
const defaults = require('defaults')
const boom = require('boom')
const moment = require('moment')
const uuid = require('uuid-base62')
const appRoot = require('app-root-path')
const quoteService = require('../../services/quotes')
const userService = require('../../services/users')
const cotizacionesService = require('../../services/cotizaciones')
const productService = require('../../services/products')
const addressesService = require('../../services/addresses')
const companiesService = require('../../services/companies')
const turnsService = require('../../services/turns')
const friendService = require('../../services/friends')
const creditReportService = require('../../services/credit-report')
const quoteNewService = require('../../services/quotesNew')
const { email } = require('../../config')
const calcularTotal = require('../../utils/convertirMoneda')
const toBase64 = require('../../utils/tobase64')
const generatePDF = require('../../utils/pdfs/generate')
const sendgrid = require('../../lib/sendgrid')
const { requestProductReviewTemplate } = require('../../utils/templates/emails')
const s3 = require('../../utils/uploadImageS3')
const userTypes = { seller: 1, buyer: 2, admin: 3 }
const logger = require('../../../src/utils/logs/logger')
const cipher = require('../../utils/cipherService')
Object.freeze(userTypes)

const getQuotesWithFilters = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  const { query } = req
  try {
    // Obtener el tipo de usuario
    const [usuario] = await userService.getById(query.usu_id)
    if (!usuario) return next(boom.badRequest('User does not exist'))

    const quotes = await quoteService.get(query, usuario.usu_tipo)

    let quotesReduce = quotes.reduce((bv, cv, index) => {
      const mapIndexOf = bv.map(e => e.cotizacion_id).indexOf(cv.cotizacion_id)
      if (mapIndexOf === -1) {
        bv.push({
          cotizacion_id: cv.cotizacion_id,
          cotizacion_padre_id: cv.cotizacion_padre_id,
          cotizacion_hija_id: cv.cot_children_id,
          empresa_usuario_comprador: cv.empresa_usuario_comprador,
          empresa_id: cv.empresa_id,
          empresa_vendedora_logo: cv.empresa_logo,
          empresa_compradora_logo: cv.empresa_usuario_comprador_logo,
          empresa_compradora_certificada: cv.empresa_usuario_comprador_certificada,
          empresa_compradora_id: cv.empresa_usuario_comprador_id,
          empresa_pais_id: cv.empresa_pais_id,
          empresa_estado_id: cv.empresa_estado_id,
          empresa_pais: cv.empresa_pais,
          empresa_estado: cv.empresa_estado,
          empresa_certificada: cv.empresa_certificada,
          usuario_comprador_id: cv.usuario_comprador_id,
          usuario_vendedor_id: cv.usuario_vendedor_id,
          nombre_empresa: cv.nombre_empresa,
          fecha_entrega: cv.fecha_entrega,
          metodo_pago: cv.metodo_pago,
          credito_dias: cv.credito_dias,
          moneda: cv.moneda,
          cotizacion_version: cv.cotizacion_version,
          cotizacion_fecha: cv.fecha_cotizacion,
          cotizacion_comentario: cv.comentario,
          cotizacion_calificacion: cv.cotizacion_calificacion,
          cotizacion_calificacion_comentario: cv.calificacion_comentario,
          cotizacion_estatus: cv.estatus_cotizacion,
          cotizacion_visto: cv.cotizacion_visto,
          cotizacion_descuento: cv.cotizacion_descuento,
          reporte_activo: cv.reporte_vigente
        })
      } else {

      }
      return bv
    }, [])

    // Obtener productos de cada cotización resultante
    for (let i = 0; i < quotesReduce.length; i++) {
      const { result } = await quoteService.getCotizacionProductos(quotesReduce[i].cotizacion_id)
      quotesReduce[i].productos = result
    }
    // Obtener fotos...
    for (let i = 0; i < quotesReduce.length; i++) {
      const productos = quotesReduce[i].productos
      if (productos !== undefined) {
        for (let j = 0; j < productos.length; j++) {
          const foto = await productService.getProductoFoto(productos[j].producto_id)
          quotesReduce[i].productos[j].foto = foto
        }
      }
    }
    // Calcular el total de cada cotización en base al costo de sus productos
    for (let i = 0; i < quotesReduce.length; ++i) {
      quotesReduce[i].total = quotesReduce[i].productos.reduce((bv, cv) => (bv + (cv.precio * cv.cantidad)), 0)
    }

    // Si hijas

    if (query.hijas && query.hijas == 1) {
      const padres = quotesReduce.filter(q => q.cotizacion_padre_id === null)
      const padresId = padres.map(q => q.cotizacion_id)
      const hijas = []

      for (let i = 0; i < padres.length; i++) {
        const hija = quotesReduce.filter(q => q.cotizacion_padre_id === padresId[i]).sort((a, b) => a.cotizacion_id > b.cotizacion_id ? 1 : -1).pop()
        if (!hija) {
          padres[i].fecha_cot_padre = padres[i].cotizacion_fecha
          hijas.push(padres[i])
        } else {
          hija.fecha_cot_padre = padres[i].cotizacion_fecha
          hijas.push(hija)
        }
      }

      hijas.sort((a, b) => a.fecha_cot_padre > b.fecha_cot_padre ? 1 : -1)

      quotesReduce = hijas.reverse()
    }

    // Filtrar mis compras y mis ventas
    const { usu_tipo: tipo, usu_id: userID } = usuario
    const administrador = 3
    if (tipo === administrador) {
      const [empresaDetails] = await userService.getEmpresaByUserId(usuario.usu_id)
      const { emp_id: companyID } = empresaDetails
      const cotizaciones = quotesReduce.reduce((iv, cv) => {
        const { empresa_compradora_id: compradora } = cv
        if (compradora === companyID) {
          iv.compras.push(cv)
        } else {
          iv.ventas.push(cv)
        }
        return iv
      }, {
        compras: [],
        ventas: []
      })
      const { compras, ventas } = cotizaciones

      for (let i = 0; i < compras.length; i++) {
        const quoteID = compras[i].cotizacion_padre_id || quotesReduce[i].cotizacion_id
        const [notSeenMessagesRaw] = await quoteService.getQuotesNotSeenMessages(userID, quoteID)
        const { total: notSeenMessages } = notSeenMessagesRaw
        compras[i].not_seen = notSeenMessages
        // Obtener solicitud de reporte
        const { empresa_id: empresa_vendedora_id, empresa_compradora_id } = compras[i]
        const origin = companyID === empresa_vendedora_id ? empresa_vendedora_id : empresa_compradora_id
        const destiny = companyID === empresa_vendedora_id ? empresa_compradora_id : empresa_vendedora_id
        const originQuote = compras[i].cotizacion_padre_id || compras[i].cotizacion_id
        const reporteSolicitud = await creditReportService.getReportSolicitude(originQuote, origin, destiny)
        compras[i].report = reporteSolicitud
      }

      for (let i = 0; i < ventas.length; i++) {
        const quoteID = ventas[i].cotizacion_padre_id || quotesReduce[i].cotizacion_id
        const [notSeenMessagesRaw] = await quoteService.getQuotesNotSeenMessages(userID, quoteID)
        const { total: notSeenMessages } = notSeenMessagesRaw
        ventas[i].not_seen = notSeenMessages
        // Obtener solicitud de reporte
        const { empresa_id: empresa_vendedora_id, empresa_compradora_id } = ventas[i]
        const origin = companyID === empresa_vendedora_id ? empresa_vendedora_id : empresa_compradora_id
        const destiny = companyID === empresa_vendedora_id ? empresa_compradora_id : empresa_vendedora_id
        const originQuote = ventas[i].cotizacion_padre_id || ventas[i].cotizacion_id
        const reporteSolicitud = await creditReportService.getReportSolicitude(originQuote, origin, destiny)
        ventas[i].report = reporteSolicitud
      }

      quotesReduce = {
        compras: {
          total: compras.length || 0,
          results: compras
        },
        ventas: {
          total: ventas.length || 0,
          results: ventas
        }
      }
    } else {
      // Obtener total de mensajes no vistos del usuario que hace la petición
      for (let i = 0; i < quotesReduce.length; i++) {
        const [empresaDetails] = await userService.getEmpresaByUserId(usuario.usu_id)
        const { emp_id: companyID } = empresaDetails
        const quoteID = quotesReduce[i].cotizacion_padre_id || quotesReduce[i].cotizacion_id
        const [notSeenMessagesRaw] = await quoteService.getQuotesNotSeenMessages(userID, quoteID)
        const { total: notSeenMessages } = notSeenMessagesRaw
        quotesReduce[i].not_seen = notSeenMessages
        // Obtener solicitud de reporte
        const { empresa_id: empresa_vendedora_id, empresa_compradora_id } = quotesReduce[i]
        const origin = companyID === empresa_vendedora_id ? empresa_vendedora_id : empresa_compradora_id
        const destiny = companyID === empresa_vendedora_id ? empresa_compradora_id : empresa_vendedora_id
        const originQuote = quotesReduce[i].cotizacion_padre_id || quotesReduce[i].cotizacion_id
        const reporteSolicitud = await creditReportService.getReportSolicitude(originQuote, origin, destiny)
        quotesReduce[i].report = reporteSolicitud
      }
    }

    res.json({
      error: false,
      numberEntries: quotesReduce.length,
      results: quotesReduce
    })
  } catch (err) {
    next(err)
  }
}

const getQuoteDateDays = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  const { id, dias } = req.params

  try {
    const datos = await quoteService.getQuoteDate(id)

    if (datos.length === 0) {
      return next(boom.badRequest('No quotes'))
    }

    // Estos son objetos tipo Date()
    const { created, updated, now } = datos[0]

    function setDate(date) {
      return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
    }

    const fecha = setDate(created)

    const maxEspera = moment(fecha).add(dias, 'days')
    const hoy = moment(now)
    // Si hoy NO es antes de la espera máxima
    const before = hoy.isBefore(maxEspera)
    if (!before) {
      return next(boom.badRequest('Wrong date'))
    }

    const restantes = maxEspera.diff(hoy, 'days')

    res.status(200).json({
      error: false,
      results: [
        {
          id,
          created,
          updated,
          now,
          valid: restantes >= 0,
          days: restantes
        }
      ]
    })
  } catch (err) {
    next(err)
  }
}

const getQuoteReceipts = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const { query } = req
    let { cot_id: cotID } = query
    cotID = Math.abs(cotID) || 0

    const [quote] = await quoteService.getById(cotID)
    if (!quote) return next(boom.badRequest('No hay cotización'))

    const payments = await quoteService.getPaymentProof(cotID)

    return res.json({
      error: false,
      results: {
        payments
      }
    })
  } catch (err) {
    next(err)
  }
}

const getQuotePDF = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const { query } = req
    let { quote, user } = query

    quote = Math.abs(quote) || 0
    user = Math.abs(user) || 0

    const [details] = await quoteService.getQuoteDetailsForDocumentDetails(quote)
    if (!details) return next(boom.badRequest('Quote not found'))

    const { usuario_vendedor_id: vendedorID, usuario_comprador_id: compradorID } = details
    if (user !== vendedorID && user !== compradorID) return next(boom.badRequest('User not found'))

    // Obtener telefonos
    const { domicilio_id: domicilioID } = details
    const [telefono] = await companiesService.getEmpresaDomicilioTelefonos(domicilioID)

    // Obtener productos
    const { cotizacion_id: cotID } = details
    const productos = await quoteService.getQuoteDetailsForDocumentProducts(cotID)

    details.telefono = telefono || null
    details.productos = productos || null

    let { empresa_vendedora_logo: vendedoraLogo } = details

    vendedoraLogo = toBase64(`${appRoot}/media/fotoperfil/seramat.jpg`)

    details.empresa_vendedora_logo = vendedoraLogo

    const pdfGenerado = await generatePDF(details)

    delete details.empresa_vendedora_logo

    return res.json({
      ok: true,
      pdfGenerado,
      quote,
      user,
      details
    })
  } catch (err) {
    next(err)
  }
}

const getQuoteById = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  const { cotId } = req.params

  try {
    const quote = await quoteService.getById(cotId)
    res.status(200).json({
      error: false,
      results: quote
    })
  } catch (err) {
    next(err)
  }
}

const getCotizacionProductos = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/cotizacion.js - methosd: getCotizacionProductos`
  try {
    const { params: { cotId } } = req
    logger.info(`Inicio consulta de productos por cotización con parametros: ${JSON.stringify(cotId)} - ${fileMethod}`)

    const [quote] = await cotizacionesService.getCotizacionById(cotId)
    logger.info(`Consulta de cotizaciones por id: ${JSON.stringify(quote)} - ${fileMethod}`)
    
    if (!quote) {
      logger.warn(`No existe la cotización con el ID: ${JSON.stringify(cotId)} - ${fileMethod}`)
      return next(boom.badRequest('No existe la cotización'))
    }

    const { result } = await cotizacionesService.getCotizacionProductos(cotId)
    logger.info(`Productos de cotización número ${JSON.stringify(cotId)}: ${JSON.stringify(result)} - ${fileMethod}`)

    const { empresa_vendedora_id: empresaVendedora } = quote
    
    // Itera los productos
    for (let i = 0; i < result.length; ++i) {
      const [productoFoto] = await productService.getProductoFoto(result[i].producto_id)
      if (productoFoto) {
        result[i].foto_url = productoFoto.foto_url
      } else {
        result[i].foto_url = null
      }
    }

    // Obtener direcciones
    const direcciones = await companiesService.getEmpresaDomicilios(empresaVendedora)
    logger.info(`Direcciones de la empresa vendedora: ${JSON.stringify(direcciones)} - ${fileMethod}`)

    // Obtener teléfonos
    for (let i = 0; i < direcciones.length; i++) {
      const telefonos = await companiesService.getEmpresaDomicilioTelefonos(direcciones[i].domicilio_id)
      direcciones[i].telefonos = telefonos
    }

    quote.direcciones = direcciones

    await cotizacionesService.seen(cotId)
    logger.info(`Respuesta exitosa: ${JSON.stringify( {
      ...quote,
      productos: result
    })} - ${fileMethod}`)

    const encryptedResponse = await cipher.encryptData(JSON.stringify({
      error: false,
      results: {
        ...quote,
        productos: result
      }
    }));

    res.status(200).send(encryptedResponse)
  } catch (error) {
    logger.error(`Ocurrio un error y no se pudo regresar una respuesta exitosa: ${JSON.stringify(error)} - ${fileMethod}`)
    next(error)
  }
}

const getQuoteProducts = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const { params: { cotId } } = req

    const [quote] = await quoteService.getDetailsById(cotId)
    if (!quote) return next(boom.badRequest('No existe la cotización'))

    const { result } = await quoteService.getCotizacionProductos(cotId)

    const quoteFatherID = await quoteService.getFatherQuoteId(cotId)
    const { empresa_vendedor_id: empresaVendedora, empresa_comprador_id: empresaCompradora } = quote
    const reportVendedor = await creditReportService.getReportSolicitude(quoteFatherID, empresaVendedora, empresaCompradora)
    const reportComprador = await creditReportService.getReportSolicitude(quoteFatherID, empresaCompradora, empresaVendedora)
    quote.reporteVendedor = reportVendedor
    quote.reporteComprador = reportComprador

    const { usuario_comprador_id: buyerID, usuario_vendedor_id: sellerID } = quote
    const [buyerNotSeenRaw] = await quoteService.getQuotesNotSeenMessages(buyerID, quoteFatherID)
    const { total: buyerNotSeen } = buyerNotSeenRaw
    const [sellerNotSeenRaw] = await quoteService.getQuotesNotSeenMessages(sellerID, quoteFatherID)
    const { total: sellerNotSeen } = sellerNotSeenRaw

    quote.notSeen = { buyerNotSeen, sellerNotSeen }

    // Itera los productos
    for (let i = 0; i < result.length; ++i) {
      const [productoFoto] = await productService.getProductoFoto(result[i].producto_id)
      if (productoFoto) {
        result[i].foto_url = productoFoto.foto_url
      } else {
        result[i].foto_url = null
      }
    }

    // Obtener direcciones
    const direcciones = await companiesService.getEmpresaDomicilios(quote.empresa_vendedor_id)

    // Obtener teléfonos
    for (let i = 0; i < direcciones.length; i++) {
      const telefonos = await companiesService.getEmpresaDomicilioTelefonos(direcciones[i].domicilio_id)
      direcciones[i].telefonos = telefonos
    }

    quote.direcciones = direcciones

    await quoteService.seen(cotId)

    res.status(200).json({
      error: false,
      results: {
        ...quote,
        productos: result
      }
    })
  } catch (err) {
    next(err)
  }
}

const getCotizaciones = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/cotizacion.js - methosd: getCotizaciones`
  try {
    const { query: { type } } = req
    let { params: { user } } = req
    user = Math.abs(user) || 0

    logger.info(`Parametros de entrada: ${JSON.stringify(user)} - ${fileMethod}`)

    const cotizaciones = await cotizacionesService.getCotizacionesByUserAndType(user, type)
    logger.info(`Cotizaciónes del usuario: ${JSON.stringify(cotizaciones)} - ${fileMethod}`)
    const agrupado = {}
    cotizaciones.forEach(item => {
      const cotizacion_id = item.cotizacion_id
      if (!agrupado[cotizacion_id]) {
        agrupado[cotizacion_id] = []
      }
      agrupado[cotizacion_id].push(item)
    })

    const resultado = [];
    Object.values(agrupado).forEach(cotizacionArray => {
      const nuevaCotizacion = {};
      const productos = [];
      const cotizacionInfo = {};
      let tienePDF = false; // Variable para verificar si hay PDF en la cotización

      cotizacionArray.forEach(cotizacion => {
        if (cotizacion.prod_id !== null) {
          productos.push({
            prod_id: cotizacion.prod_id,
            nombre: cotizacion.prod_nombre,
            cantidad: cotizacion.cantidad,
            serie: cotizacion.serie,
            concepto_descripcion: cotizacion.concepto_descripcion,
            precio_unitario: cotizacion.precio_unitario,
            subtotal: cotizacion.subtotal,
            foto_url: cotizacion.foto_url
          });
        }

        for (const key in cotizacion) {
          if (cotizacion[key] !== null && key !== 'cotizacion_pdf') {
            cotizacionInfo[key] = cotizacion[key];
          }
        }

        // Verificar si hay PDF en la cotización
        if (cotizacion.cotizacion_pdf !== null) {
          tienePDF = true;
        }
      });

      if (productos.length > 0 || tienePDF) {
        nuevaCotizacion.productos = productos;
        nuevaCotizacion.cotizacion_info = cotizacionInfo;
        nuevaCotizacion.cotizacion_pdf = cotizacionArray[0].cotizacion_pdf;
        resultado.push(nuevaCotizacion);
      }
    })

    const encryptedResponse = await cipher.encryptData(JSON.stringify({
      error: false,
      cotizaciones: resultado
    }));

    res.status(200).send(encryptedResponse)
  } catch (error) {
    logger.error(`Error general del endpoint: ${JSON.stringify(error)} - ${fileMethod}`)
    next(error)
  }
}

const filterCompany = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  const fileMethod = `file: src/controllers/api/cotizacion.js - methosd: filterCompany`
  try {
    const { emp } = req.params
    logger.info(`Criterio de busqueda: ${JSON.stringify(emp)} - ${fileMethod}`)
    const getEmp = await cotizacionesService.searchCompanies(emp)
    logger.info(`Resultado de la busqueda: ${JSON.stringify(getEmp)} - ${fileMethod}`)
  
    const encryptedResponse = await cipher.encryptData(JSON.stringify({
      error: false,
      empresas: getEmp
    }));

    res.status(200).send(encryptedResponse)
  } catch (err) {
    logger.error(`Error general del endpoint: ${JSON.stringify(err)} - ${fileMethod}`)
    next(err)
  }
}

const updateCotizacion = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  const fileMethod = `file: src/controllers/api/cotizacion.js - methosd: updateCotizacion`
  try {
    const body = typeof req.decryptedBody === 'string' ? JSON.parse(req.decryptedBody) : req.decryptedBody
    const { cotizacion_id, emp_id_origen, emp_id_destino, usu_id_origen, productos, pdf } = body
    logger.info(`Inicio de actualización de cotización con los datos: ${JSON.stringify(body)} - ${fileMethod}`)

    let productosJSON = productos
    let incomingPdf = false
    let locationAWS = null
    let pdfInserted = false

    logger.info(`Inicio consulta de cotización con ID: ${cotizacion_id} - ${fileMethod}`)
    const cotizacionSaved = await cotizacionesService.getCotizacionById(cotizacion_id)
    if (!cotizacionSaved) {
      logger.error(`Ocurrio algun problema al buscar la cotización con ID en el sistema: ${cotizacion_id} - ${fileMethod}`)
      return next(boom.badRequest('Valida el id de la cotización que deseas ver'))
    }
    logger.info(`Se encontro la siguiente información de la cotización con ID: ${cotizacion_id}: ${JSON.stringify(cotizacionSaved)} - ${fileMethod}`)

    // Valida si tiene listado de productos o archivo PDF
    if (cotizacionSaved[0].cotizacion_pdf != null) pdfInserted = true

    logger.info(`La cotización con ID ${cotizacion_id} es de tipo ${pdfInserted ? 'PDF' : 'Listado de productos'} - ${fileMethod}`)

    // Valida que solo se pueda modificar el pdf subido si es cotizacion de tipo pdf
    if (pdfInserted && pdf == undefined) {
      logger.warn(`No se detecto un archivo pdf valido - ${fileMethod}`)
      return next(boom.badRequest('No se detecto un archivo pdf valido'))
    }

    // Valida  si viene un archivo pdf adjunto
    if (pdf) {
      incomingPdf = true
      const pathBucket = 'cotizacionesDocs'

      // Valida si pdfInserted == true
      if (pdfInserted) {
        // Se sube el nuevo pdf
        locationAWS = await s3.uploadImage(pdf, pathBucket)
        if (locationAWS == undefined) {
          logger.error(`Ocurrio un error al subir el archivo de la cotizacion con ID ${cotizacion_id} - ${fileMethod}`)
          return next(boom.badRequest('No se subio el archivo a AWS'))
        }
        logger.info(`Ruta del archivo subido ara la cotización con el ID ${cotizacion_id}: ${locationAWS} - ${fileMethod}`)

        // Se actualiza la tabla cotizaciones
        const updateCotizacion = await cotizacionesService.updateCotizacionPdf(cotizacion_id, locationAWS)
        if (updateCotizacion.updateCotizacionPdf == 0) {
          logger.error(`Ocurrio un error al actualizar rel registro del archivo de la cotizacion con ID ${cotizacion_id} - ${fileMethod}`)
          return next(boom.badRequest('Ocurrio un error en la actualizacion del archivo pdf'))
        }
        logger.info(`El registro para actualizar el archivo pdf de la cotización con ID ${cotizacion_id} se realizo correctamente: ${JSON.stringify(updateCotizacion)} - ${fileMethod}`)

        // Se formatea la url actual del archivo a eliminar
        const indiceBarraDespuesDeHTTP = cotizacionSaved[0].cotizacion_pdf.indexOf('/', 'https://'.length)
        const nuevaUrl = indiceBarraDespuesDeHTTP !== -1 ? cotizacionSaved[0].cotizacion_pdf.substring(indiceBarraDespuesDeHTTP) : ''

        // Se elimina el archivo anterior del bucket
        const deleteObjetcAWS = await s3.deleteFileFromS3(nuevaUrl.slice(1))
        if (deleteObjetcAWS == undefined) {
          logger.error(`Ocurrio un error al eliminar el archivo anterior de la cotizacion con ID ${cotizacion_id} - ${fileMethod}`)
          return next(boom.badRequest('No se ha podilo eliminar el archivo anterior'))
        }
        logger.info(`Se elimino correctamente el archivo pdf de la cotización con ID ${cotizacion_id} - ${fileMethod}`)
      }
    }

    if (typeof productos === 'string') {
      productosJSON = JSON.parse(productos)
    } else {
      productosJSON = productos
    }

    logger.info(`Productos para actualizar de la cotización con ID ${cotizacion_id}: ${JSON.stringify(productosJSON)} - ${fileMethod}`)
    // Valida si las compañias y el usuario son validos y existen
    const [empOrigenValid] = await cotizacionesService.getCompanyById(emp_id_origen)
    if (!empOrigenValid) {
      logger.error(`La compañia origen o vendedora con ID ${emp_id_origen} no se encuentra registrado en el sistema - ${fileMethod}`)
      return next(boom.badRequest('emp_id_origen no valido'))
    }
    logger.info(`La compañia con ID ${emp_id_origen} cuenta con la siguiente información: ${JSON.stringify(empOrigenValid)} - ${fileMethod}`)

    const [empDestinoValid] = await cotizacionesService.getCompanyById(emp_id_destino)
    if (!empDestinoValid) {
      logger.error(`La compañia  destino o compradora con ID ${emp_id_destino} no se encuentra registrado en el sistema - ${fileMethod}`)
      return next(boom.badRequest('emp_id_destino no valido'))
    }
    logger.info(`La compañia destino o compradora con ID ${emp_id_origen} cuenta con la siguiente información: ${JSON.stringify(empDestinoValid)} - ${fileMethod}`)

    // Valida que el usuario pertenezca a la empresa origen
    const [usuOrigenValid] = await cotizacionesService.getUserByIdEmp(usu_id_origen, emp_id_origen)
    if (!usuOrigenValid) {
      logger.error(`El usuario origen o vendedor con ID ${emp_id_destino} no se encuentra registrado en el sistema - ${fileMethod}`)
      return next(boom.badRequest('usu_id_origen no valido'))
    }
    logger.info(`El usuario irigen o vendedor con ID ${emp_id_origen} cuenta con la siguiente información: ${JSON.stringify(usuOrigenValid)} - ${fileMethod}`)

    body.cotizacion_pdf = locationAWS;

    // Se actualiza contizaciones
    logger.info(`La cotización con ID ${cotizacion_id} se actualizara con la siguiente información: ${JSON.stringify(body)} - ${fileMethod}`)
    const updatedCotizacion = await cotizacionesService.updateCotizacion(body)
    if (!updatedCotizacion) {
      logger.error(`La cotización con ID ${cotizacion_id} no fue actualizada correctamente - ${fileMethod}`)
      return next(boom.badRequest('La cotización no fue actualizada exitosamente'))
    }
    logger.info(`La cotización con ID ${cotizacion_id} se actualizo correctamente - ${fileMethod}`)

    if (!incomingPdf) {
      // Se actualizan productos cotizados
      logger.info(`La cotización con ID ${cotizacion_id} se actualizara cpm ña información de los productos: ${JSON.stringify(body)} - ${fileMethod}`)
      const updatedProducts = await cotizacionesService.updateProductosCotizados(body)
      if (!updatedProducts) {
        logger.error(`La cotización con ID ${cotizacion_id} no fue actualizada correctamente con los productos - ${fileMethod}`)
        return next(boom.badRequest('Los productos cotizados no fueron actualizada exitosamente'))
      }
      logger.info(`La cotización con ID ${cotizacion_id} fue actualizada correctamente: ${JSON.stringify(updatedProducts)} - ${fileMethod}`)
    }

    const productosCotizados = await cotizacionesService.getCotizacionById(cotizacion_id)
    if (!productosCotizados) {
      logger.error(`La cotización con ID ${cotizacion_id} no fue encontrada correctamente - ${fileMethod}`)
      return next(boom.badRequest('Hubo un error al obtener la cotizacion'))
    }
    logger.info(`La cotización con ID ${cotizacion_id} fue encontrada con la siguiente información: ${JSON.stringify(productosCotizados)} - ${fileMethod}`)

    const dataRoot = {
      cotizacion_id: productosCotizados[0].cotizacion_id,
      empresa_vendedora_id: productosCotizados[0].empresa_vendedora_id,
      empresa_compradora_id: productosCotizados[0].empresa_compradora_id,
      divisa: productosCotizados[0].divisa,
      cotizacion_fecha_creacion: productosCotizados[0].cotizacion_fecha_creacion,
      cotizacion_fecha_actualizacion: productosCotizados[0].cotizacion_fecha_actualizacion,
      cotizacion_estatus: productosCotizados[0].cotizacion_estatus,
      empresa_vendedora_cotizacion_pdf: productosCotizados[0].cotizacion_pdf,
      empresa_vendedora_nombre: productosCotizados[0].empresa_vendedora_nombre,
      empresa_vendedora_razon_social: productosCotizados[0].empresa_vendedora_razon_social,
      empresa_vendedora_rfc: productosCotizados[0].empresa_vendedora_rfc,
      empresa_vendedora_website: productosCotizados[0].empresa_vendedora_website,
      empresa_vendedora_logo: productosCotizados[0].empresa_vendedora_logo,
      empresa_vendedora_banner: productosCotizados[0].empresa_vendedora_banner,
      empresa_vendedora_certificada: productosCotizados[0].empresa_vendedora_certificada,
      empresa_compradora_nombre: productosCotizados[0].empresa_compradora_nombre,
      empresa_compradora_razon_social: productosCotizados[0].empresa_compradora_razon_social,
      empresa_compradora_rfc: productosCotizados[0].empresa_compradora_rfc,
      empresa_compradora_website: productosCotizados[0].empresa_compradora_website,
      empresa_compradora_logo: productosCotizados[0].empresa_compradora_logo,
      empresa_compradora_banner: productosCotizados[0].empresa_compradora_banner,
      empresa_compradora_certificada: productosCotizados[0].empresa_compradora_certificada,
      usuario_vendedor_id: productosCotizados[0].usuario_vendedor_id,
      usuario_vendedor_nombre: productosCotizados[0].usuario_vendedor_nombre,
      usuario_vendedor_app: productosCotizados[0].usuario_vendedor_app,
      usuario_vendedor_puesto: productosCotizados[0].usuario_vendedor_puesto,
      usuario_vendedor_email: productosCotizados[0].usuario_vendedor_email,
      usuario_vendedor_foto: productosCotizados[0].usuario_vendedor_foto,
      usuario_vendedor_tipo: productosCotizados[0].usuario_vendedor_tipo,
      usuario_comprador_id: productosCotizados[0].usuario_comprador_id,
      usuario_comprador_nombre: productosCotizados[0].usuario_comprador_nombre,
      usuario_comprador_app: productosCotizados[0].usuario_comprador_app,
      usuario_comprador_puesto: productosCotizados[0].usuario_comprador_puesto,
      usuario_comprador_email: productosCotizados[0].usuario_comprador_email,
      usuario_comprador_foto: productosCotizados[0].usuario_comprador_foto,
      usuario_comprador_tip: productosCotizados[0].usuario_comprador_tip
    };

    logger.info(`La cotización con ID ${cotizacion_id} prepara la información para responder: ${JSON.stringify(dataRoot)} - ${fileMethod}`)

    let productos_res = undefined
    if (!incomingPdf) {
      productos_res = productosCotizados.map(item => ({
        producto_cotizado_id: item.producto_cotizado_id,
        producto_id: item.producto_id,
        cantidad: item.cantidad,
        serie: item.serie,
        concepto_descripcion: item.concepto_descripcion,
        precio_unitario: item.precio_unitario,
        subtotal: item.subtotal,
        prod_precio_lista: item.prod_precio_lista,
        foto_url: item.foto_url
      }));
    }
    const cotizacion = {
      cotizacion: dataRoot,
      productos: productos_res
    }

    const encryptedResponse = await cipher.encryptData(JSON.stringify({
      error: false,
      cotizacion
    }));

    res.status(200).send(encryptedResponse)


  } catch (error) {
    logger.error(`Error general del endpoint: ${JSON.stringify(error)} - ${fileMethod}`)
    next(error)
  }
}

const createCotizacion = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  const fileMethod = `file: src/controllers/api/cotizacion.js - methosd: createCotizacion`
  try {
    const body = typeof req.decryptedBody === 'string' ? JSON.parse(req.decryptedBody) : req.decryptedBody;
    const { emp_id_origen, emp_id_destino, usu_id_origen, productos, metodo_pago_id, dias_credito, direccion_id, pdf } = body
    logger.info(`Inicio de creacion de cotizacion con los datos: ${JSON.stringify(body)} - ${fileMethod}`)

    const [getAdminUser] = await cotizacionesService.getUserAdminByCompany(emp_id_destino)
    if (!getAdminUser) {
      logger.error(`El usuario que buscas no existe: ${emp_id_destino} - ${fileMethod}`)
      return next(boom.badRequest('usuario administrador no existe'))
    }

    body.admin_destino_id = getAdminUser.usu_id


    let productosJSON = productos
    let cotizacion_id = null
    let incomingPdf = false
    let locationAWS = null

    if (pdf) {
      incomingPdf = true
      const pathBucket = 'cotizacionesDocs'

      logger.info(`Se iniciara upload de archivo pdf de cotizacion a: ${pathBucket} - ${fileMethod}`)

      locationAWS = await s3.uploadImage(pdf, pathBucket)
      if (locationAWS == undefined) {
        logger.error(`Ha habido un error al subir el archivo a AWS : ${locationAWS} - ${fileMethod}`)
        return next(boom.badRequest('No se subio el archivo a AWS'))
      }
      logger.info(`El archivo se encuentra en bucket AWS: ${locationAWS} - ${fileMethod}`)
    }

    if (typeof productos === 'string') {
      productosJSON = JSON.parse(productos)
    } else {
      productosJSON = productos
    }
    logger.info(`Los productos cotizados son: ${JSON.stringify(productosJSON)} - ${fileMethod}`)

    const [empOrigenValid] = await cotizacionesService.getCompanyById(emp_id_origen)
    if (!empOrigenValid) {
      logger.error(`La compañia origen o vendedora con ID: ${emp_id_origen} no existe - ${fileMethod}`)
      return next(boom.badRequest('emp_id_origen no valido'))
    }
    logger.info(`La compañia origen o vendedora con ID: ${emp_id_origen} cuenta con la siguiente informacion: ${JSON.stringify(empOrigenValid)} - ${fileMethod}`)

    const [empDestinoValid] = await cotizacionesService.getCompanyById(emp_id_destino)
    if (!empDestinoValid) {
      logger.error(`La compañia destino o compradora con ID: ${emp_id_destino} no existe - ${fileMethod}`)
      return next(boom.badRequest('emp_id_destino no valido'))
    }
    logger.info(`La compañia destino o compradora con ID: ${emp_id_destino} cuenta con la siguiente informacion: ${JSON.stringify(empDestinoValid)} - ${fileMethod}`)

    const [usuOrigenValid] = await cotizacionesService.getUserByIdEmp(usu_id_origen, emp_id_origen)
    if (!usuOrigenValid) {
      logger.error(`El usuario origen o vendedor con ID: ${usu_id_origen} no existe - ${fileMethod}`)
      return next(boom.badRequest('usu_id_origen no valido'))
    }
    logger.info(`La usuario origen o vendedor con ID: ${usu_id_origen} cuenta con la siguiente informacion: ${JSON.stringify(usuOrigenValid)} - ${fileMethod}`)

    body.cotizacion_pdf = locationAWS;

    logger.info(`La contización se insertara con la siguiente informacion: ${JSON.stringify(body)} - ${fileMethod}`)

    const insertCotizacion = await cotizacionesService.insertCotizacion(body)
    if (!insertCotizacion) {
      logger.error(`La contización no fue insertada: ${JSON.stringify(insertCotizacion)} - ${fileMethod}`)
      return next(boom.badRequest('La cotización no fue insertada'))
    }
    cotizacion_id = insertCotizacion.insertId

    logger.info(`La contización con ID: ${cotizacion_id} se inserta correctamente - ${fileMethod}`)

    if (metodo_pago_id && dias_credito && direccion_id) {
      // metodo_pago_id -> 5 [Crédito al proveedor]
      if (metodo_pago_id == 5) {
        // Se realiza insert en la tabla creditos
        // cotizacion_id [cotizacion_id], usu_id_origen [usuario_id], emp_id_origen [empresa_vendedora_id], emp_id_destino [empresa_compradora_id], monto [total], dias_credito, direccion_id

        const insertCredito = await cotizacionesService.inserCredito(cotizacion_id, body);
        if (!insertCredito) {
          logger.error(`El credito no fue insertado - ${fileMethod}`)
          return next(boom.badRequest('Credito no fue insertado correctamente'))
        }
      } else {
        logger.warn(`Actualmente solo esta soportado el metodo de pago Crédito al proveedor - ${fileMethod}`)
        return next(boom.badRequest('Actualmente solo esta soportado el metodo de pago Crédito al proveedor'));
      }
    }

    logger.info(`Metodo de pago: ${metodo_pago_id}, dias de credito: ${dias_credito}, ID de dirección: ${direccion_id} - ${fileMethod}`)

    if (!incomingPdf) {
      // Valida que los productos pertenezcan a la empresa origen
      for (let i in productosJSON) {
        const [producto] = await cotizacionesService.getProdByIdEmp(productosJSON[i].producto_id, emp_id_origen)
        if (!producto) {
          logger.error(`Los productos que intentas cotizar no existen en el sistema - ${fileMethod}`)
          return next(boom.badRequest('Product does not exist...'))
        }

        productosJSON[i].cotizacion_id = insertCotizacion.insertId

        // Se insertan productos cotizados
        const insertProductoCotizado = await cotizacionesService.insertProductoCotizado(productosJSON[i])
        if (!insertProductoCotizado) {
          logger.error(`Los productos que intentas cotizar no existen en el sistema - ${fileMethod}`)
          return next(boom.badRequest('Hubo un error al insertar producto cotizado'))
        }
      }
    }

    const productosCotizados = await cotizacionesService.getCotizacionById(cotizacion_id)
    if (!productosCotizados) {
      logger.error(`No s epudo obtener la cotización - ${fileMethod}`)
      return next(boom.badRequest('Hubo un error al obtener la cotizacion'))
    }

    const dataRoot = {
      cotizacion_id: productosCotizados[0].cotizacion_id,
      empresa_vendedora_id: productosCotizados[0].empresa_vendedora_id,
      empresa_compradora_id: productosCotizados[0].empresa_compradora_id,
      divisa: productosCotizados[0].divisa,
      cotizacion_fecha_creacion: productosCotizados[0].cotizacion_fecha_creacion,
      cotizacion_fecha_actualizacion: productosCotizados[0].cotizacion_fecha_actualizacion,
      cotizacion_estatus: productosCotizados[0].cotizacion_estatus,
      empresa_vendedora_cotizacion_pdf: productosCotizados[0].cotizacion_pdf,
      empresa_vendedora_nombre: productosCotizados[0].empresa_vendedora_nombre,
      empresa_vendedora_razon_social: productosCotizados[0].empresa_vendedora_razon_social,
      empresa_vendedora_rfc: productosCotizados[0].empresa_vendedora_rfc,
      empresa_vendedora_website: productosCotizados[0].empresa_vendedora_website,
      empresa_vendedora_logo: productosCotizados[0].empresa_vendedora_logo,
      empresa_vendedora_banner: productosCotizados[0].empresa_vendedora_banner,
      empresa_vendedora_certificada: productosCotizados[0].empresa_vendedora_certificada,
      empresa_compradora_nombre: productosCotizados[0].empresa_compradora_nombre,
      empresa_compradora_razon_social: productosCotizados[0].empresa_compradora_razon_social,
      empresa_compradora_rfc: productosCotizados[0].empresa_compradora_rfc,
      empresa_compradora_website: productosCotizados[0].empresa_compradora_website,
      empresa_compradora_logo: productosCotizados[0].empresa_compradora_logo,
      empresa_compradora_banner: productosCotizados[0].empresa_compradora_banner,
      empresa_compradora_certificada: productosCotizados[0].empresa_compradora_certificada,
      usuario_vendedor_id: productosCotizados[0].usuario_vendedor_id,
      usuario_vendedor_nombre: productosCotizados[0].usuario_vendedor_nombre,
      usuario_vendedor_app: productosCotizados[0].usuario_vendedor_app,
      usuario_vendedor_puesto: productosCotizados[0].usuario_vendedor_puesto,
      usuario_vendedor_email: productosCotizados[0].usuario_vendedor_email,
      usuario_vendedor_foto: productosCotizados[0].usuario_vendedor_foto,
      usuario_vendedor_tipo: productosCotizados[0].usuario_vendedor_tipo,
      usuario_comprador_id: productosCotizados[0].usuario_comprador_id,
      usuario_comprador_nombre: productosCotizados[0].usuario_comprador_nombre,
      usuario_comprador_app: productosCotizados[0].usuario_comprador_app,
      usuario_comprador_puesto: productosCotizados[0].usuario_comprador_puesto,
      usuario_comprador_email: productosCotizados[0].usuario_comprador_email,
      usuario_comprador_foto: productosCotizados[0].usuario_comprador_foto,
      usuario_comprador_tip: productosCotizados[0].usuario_comprador_tip
    };

    let productos_res = undefined
    if (!incomingPdf) {
      productos_res = productosCotizados.map(item => ({
        producto_cotizado_id: item.producto_cotizado_id,
        producto_id: item.producto_id,
        cantidad: item.cantidad,
        serie: item.serie,
        concepto_descripcion: item.concepto_descripcion,
        precio_unitario: item.precio_unitario,
        subtotal: item.subtotal,
        prod_precio_lista: item.prod_precio_lista,
        foto_url: item.foto_url
      }));
    }
    const cotizacion = {
      cotizacion: dataRoot,
      productos: productos_res
    }

    logger.info(`Preparando la respuesta: ${JSON.stringify(cotizacion)} - ${fileMethod}`) 
    const encryptedResponse = await cipher.encryptData(JSON.stringify({
      error: false,
      cotizacion
    }));

    res.status(200).send(encryptedResponse)

  } catch (err) {
    logger.error(`Error general del endpoint: ${JSON.stringify(err)} - ${fileMethod}`)
    next(err)
  }
}

const createQuote = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { body } = req
    const { cmetodo_id: metodoPago, credito_dias: creditoDias } = body

    const [creditoMetodo, cincuentaCredito] = [2, 3]
    if ((metodoPago === creditoMetodo || metodoPago === cincuentaCredito) && !creditoDias) return next(boom.badRequest('Incorrecto para método de pago crédito'))

    const [existUser] = await userService.getById(body.usu_id_comprador)
    if (!existUser) return next(boom.badRequest('usu_id_comprador incorrect...'))

    // Existe direccion??
    const [existeDireccion] = await addressesService.getAdressById(body.address_id)
    if (!existeDireccion) return next(boom.badRequest('No existe la dirección proporcionada'))

    // CHECK DEFAULT VALUES IF ANY DOES NOT EXIST
    const quote = defaults(body, {
      cmetodo_id: 1,
      cpais_id: null,
      cedo_id: null,
      // "cot_fecha": new Date().toISOString().substr(0, 10),
      cot_status: 1
    })

    // Poner comentario en null en caso que no venga
    body.products = body.products.map(p => {
      if (!p.comentario) p.comentario = null
      return p
    })

    // FILL BASIC INFORMATION DATA FROM ORIGINAL PRODUCT
    const bodyProducts = body.products
    for (let i = 0; i < bodyProducts.length; i++) {
      const [producto] = await productService.getById(bodyProducts[i].prod_id)
      if (!producto) return next(boom.badRequest('Product does not exist...'))

      bodyProducts[i] = defaults(bodyProducts[i], {
        cot_version: 1,
        cp_cantidad: 1
      })
      bodyProducts[i].emp_id_vendedor = producto.empresa_id
      bodyProducts[i].cp_precio = producto.precio_lista
      bodyProducts[i].cot_mejorprecio = producto.compra_minima
    }

    // GROUP products by emp_id_vendedor from products table on the database
    const productsGroup = bodyProducts.reduce((bv, cv, i) => {
      if (!bv[cv.emp_id_vendedor]) {
        bv[cv.emp_id_vendedor] = [cv]
      } else {
        bv[String(cv.emp_id_vendedor)].push(cv)
      }
      return bv
    }, {})

    // CREATING OBJ RETURN AND MAKING QUOTES MULTIPLES
    const productsGroupKeys = Object.keys(productsGroup)
    const results = []
    for (let i = 0; i < productsGroupKeys.length; i++) {
      // Obtiene datos del comprador
      const [usuario] = await userService.getEmpresaByUserId(quote.usu_id_comprador)

      quote.cpais_id = null
      quote.cedo_id = null
      quote.emp_id_vendedor = productsGroup[productsGroupKeys[i]][0].emp_id_vendedor
      const empresaVendedora = quote.emp_id_vendedor

      // Asignar vendedor...

      let usuarioVendedor = null

      const amigosEmpresa = await friendService.getFriendsByCompanyAndType(usuario.usu_id, empresaVendedora, 1)
      const amigosEmpresaTotal = amigosEmpresa.length || 0

      if (amigosEmpresaTotal === 0) {
        // Si no hay amistad con esta empresa asignar vendedor por turno

        // Obtener vendedores de empresa
        const [vendedor, admin] = [1, 3]
        let vendedoresRaw = await companiesService.getCompanyEmployeesByType(empresaVendedora, vendedor)
        // Si la empresa no tienen vendedores, se traen los administradores
        if (vendedoresRaw.length === 0) {
          vendedoresRaw = await companiesService.getCompanyEmployeesByType(empresaVendedora, admin)
        }
        const vendedores = vendedoresRaw.map(v => v.id)
        // ¿Existe turno para esta empresa?
        const [existeTurno] = await turnsService.getTurns(empresaVendedora)

        if (!existeTurno) {
          // Si no existe un turno: Crear turno
          await turnsService.createTurns(empresaVendedora)
        } else {
          // Si existe un turno: Actualizar turno
          const turnoActual = existeTurno.turno
          const numeroVendedores = vendedores.length
          if (turnoActual >= numeroVendedores) {
            await turnsService.editTurns(empresaVendedora, 1)
          } else {
            await turnsService.editTurns(empresaVendedora, turnoActual + 1)
          }
        }

        // Obtener usuario correspondiente a este turno
        const [turnoActualRaw] = await turnsService.getTurns(empresaVendedora)
        const turnoActual = turnoActualRaw.turno
        usuarioVendedor = vendedores[turnoActual - 1]
      } else if (amigosEmpresaTotal === 1) {
        // Si hay una amistad con esta empresa darle la venta al amigo
        const [amigoEmpresa] = amigosEmpresa
        usuarioVendedor = amigoEmpresa.usu_id
      } else {
        // Si hay dos o más amigos con esta emprea hacer un random para elegir vendedor entre ellos
        const turno = Math.floor(Math.random() * amigosEmpresaTotal)
        usuarioVendedor = amigosEmpresa[turno].usu_id
      }

      // Create quote
      const { insertId } = await quoteService.create(quote, usuarioVendedor, usuario.emp_id)
      const [newQuote] = await quoteService.getById(insertId)
      for (let j = 0; j < productsGroup[productsGroupKeys[i]].length; j++) {
        productsGroup[productsGroupKeys[i]][j].cot_id = newQuote.cotizacion_id
        await quoteService.createCotizacionProducto(productsGroup[productsGroupKeys[i]][j])
      }

      results.push({
        ...newQuote,
        productos: productsGroup[productsGroupKeys[i]]
      })
    }

    res.status(200).json({
      error: false,
      results
    })
  } catch (err) {
    next(err)
  }
}

const createChildrenQuote = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const { cotId } = req.params
    const { body } = req
    const { metodo_id: metodoPago, credito_dias: creditoDias } = body

    // THE BODY CAN NOT BE EMPTY
    if (Object.is(body, {})) {
      return next(boom.badRequest('The body can not be empty...'))
    }

    if (body && body.descuento && (body.descuento < 0 || body.descuento > 100)) {
      return next(boom.badRequest('El valor descuento es un porcentaje por lo que debe estar entre 0 y 100'))
    }

    const realFather = await quoteService.getFatherQuoteId(cotId)
    const quoteFather = await quoteService.getById(realFather)

    const [creditoMetodo, cincuentaCredito] = [2, 3]
    let diasCredito = null
    if ((metodoPago === creditoMetodo || metodoPago === cincuentaCredito) && !creditoDias) return next(boom.badRequest('Incorrecto para método de pago crédito'))
    if (creditoDias) diasCredito = creditoDias

    const childrenQuote = {
      usu_id_comprador: quoteFather && quoteFather[0] && quoteFather[0].usuario_comprador_id ? quoteFather[0].usuario_comprador_id : body.usuario_comprador_id,
      emp_id_vendedor: quoteFather && quoteFather[0] && quoteFather[0].empresa_vendedor_id ? quoteFather[0].empresa_vendedor_id : 0,
      cot_delivery: quoteFather && quoteFather[0] && quoteFather[0].cot_delivery ? quoteFather[0].cot_delivery : body.cotizacion_fecha_entrega,
      cmetodo_id: quoteFather && quoteFather[0] && quoteFather[0].cmetodo_id ? quoteFather[0].cmetodo_id : body.metodo_id,
      cpais_id: quoteFather && quoteFather[0] && quoteFather[0].empresa_pais_id ? quoteFather[0].empresa_pais_id : 1,
      cedo_id: quoteFather && quoteFather[0] && quoteFather[0].empresa_estado_id ? quoteFather[0].empresa_estado_id : 1,
      cot_comentario: body.cotizacion_comentario ? body.cotizacion_comentario : quoteFather[0].cotizacion_comentario,
      cot_status: 1,
      descuento: body && body.descuento ? body.descuento : 0,
      visto: body && body.visto ? body.visto : 0,
      usu_id_vendedor: quoteFather[0].usuario_vendedor_id,
      emp_id_comprador: quoteFather[0].empresa_comprador_id,
      empresa_comprador_domicilio_id: quoteFather[0].empresa_comprador_domicilio_id
    }

    // CREATING NEW QUOTE
    const newchildrenQuote = await quoteService.createChildrenQuote(childrenQuote, diasCredito)

    // GET ORIGINAL PRODUCTS
    const { result } = await quoteService.getCotizacionProductos(cotId)
    for (let i = 0; i < result.length; ++i) {
      const productoFoto = await productService.getProductoFoto(result[i].producto_id)
      result[i].foto_url = productoFoto[0].foto_url
    }

    // IF THE NUMBER OF PRODUCTOS ARE NOT THE SAME WITH ON THE DATABASE
    debug(result[0])
    if (result && result.length === 0 || body.productos.length === 0) {
      return next(boom.badRequest())
    }

    const productos = []
    for (let i = 0; i < body.productos.length; ++i) {
      const productResult = result.filter(e => e.producto_id == body.productos[i].prod_id)
      const p = {
        cot_id: newchildrenQuote.insertId,
        prod_id: body.productos[i].prod_id,
        emp_id_vendedor: productResult[0].empresa_vendedor_id,
        cot_version: productResult[0].cotizacion_version,
        cp_cantidad: body.productos[i].cp_cantidad,
        cp_precio: productResult[0].precio,
        cot_mejorprecio: productResult[0].mejor_precio,
        comentario: body.productos[i].comentario
      }
      await quoteService.createCotizacionProducto(p)
      productos.push(p)
    }

    // LINKING PRODUCTS
    await quoteService.crearBitacoraCotizacion(cotId, newchildrenQuote.insertId)

    // RESULT
    const quote = await quoteService.getById(newchildrenQuote.insertId)

    res.status(200).send({
      error: false,
      fatherQuote: cotId,
      childrenQuote: newchildrenQuote.insertId,
      results: {
        ...quote[0],
        productos
      }
    })
  } catch (err) {
    next(err)
  }
}

const getCotizacionLog = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  const fileMethod = `file: src/controllers/api/cotizacion.js - method: getCotizacionLog`
  try {
    const { cotId } = req.params
    const fatherQuote = await cotizacionesService.getById(cotId)
    logger.info(`Inicio consulta de cotización: ${JSON.stringify(fatherQuote)} - ${fileMethod}`)
    debug(fatherQuote[0])

    let childrenQuote = []
    childrenQuote.push({
      cotizacion_bitacora_id: null,
      cotizacion_padre_id: null,
      cotizacion_hija_id: fatherQuote[0].cotizacion_id,
      fecha_cotizacion: fatherQuote[0].cotizacion_fecha_entrega,
      cotizacion_estatus_id: fatherQuote[0].cotizacion_estatus,
      cotizacion_visto: fatherQuote[0].cotizacion_visto
    })

    logger.info(`Objeto de cotización: ${JSON.stringify(childrenQuote)} - ${fileMethod}`)

    // SORT
    childrenQuote.sort((a, b) => a.cotizacion_hija_id - b.cotizacion_hija_id)
    childrenQuote = childrenQuote.map((e, index) => {
      return { index: index + 1, ...e }
    })

    const encryptedResponse = await cipher.encryptData(JSON.stringify({
      error: false,
      results: childrenQuote
    }));

    res.status(200).send(encryptedResponse)
  } catch (err) {
    logger.error(`Ocurrio un error y no se pudo regresar una respuesta exitosa: ${JSON.stringify(err)} - ${fileMethod}`)
    next(err)
  }
}

const getQuoteLog = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)

  try {
    const { cotId } = req.params

    const fatherQuote = await quoteService.getById(cotId)
    debug(fatherQuote[0])

    let childrenQuote = await quoteService.getChildrenQuotes(cotId)
    childrenQuote.push({
      cotizacion_bitacora_id: null,
      cotizacion_padre_id: null,
      cotizacion_hija_id: fatherQuote[0].cotizacion_id,
      fecha_cotizacion: fatherQuote[0].cotizacion_fecha_entrega,
      cotizacion_estatus_id: fatherQuote[0].cotizacion_estatus,
      cotizacion_visto: fatherQuote[0].cotizacion_visto
    })

    // SORT
    childrenQuote.sort((a, b) => a.cotizacion_hija_id - b.cotizacion_hija_id)
    childrenQuote = childrenQuote.map((e, index) => {
      return { index: index + 1, ...e }
    })

    res.status(200).json({
      error: false,
      results: childrenQuote
    })
  } catch (err) {
    next(err)
  }
}

const getQuotePaymentReportByID = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { params } = req
    const { reporte } = params
    const results = await quoteService.getPayments(reporte)
    return res.json({
      error: false,
      results
    })
  } catch (err) {
    next(err)
  }
}

const createQuotePaymentReportPayment = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { body } = req
    const { reporte, cantidad } = body
    const results = await quoteService.addPayment(reporte, cantidad)
    return res.json({
      error: false,
      results
    })
  } catch (err) {
    next(err)
  }
}

const updateQuotePaymentReport = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { body } = req
    const { id, cantidad } = body
    const results = await quoteService.updatePayment(id, cantidad)
    return res.json({
      error: false,
      results
    })
  } catch (err) {
    next(err)
  }
}

const deleteQuotePaymentReportByID = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { params } = req
    const { id } = params
    const results = await quoteService.deletePayment(id)
    return res.json({
      error: false,
      results
    })
  } catch (err) {
    next(err)
  }
}

const createQuotePaymentReport = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { body: { cotizaciones } } = req

    if (cotizaciones.length != 0) {
      const results = []
      for (let i = 0; i < cotizaciones.length; i++) {
        const result = await quoteService.addReport(cotizaciones[i])
        results.push(result)
      }
      return res.json({
        error: false,
        results
      })
    }
  } catch (err) {
    next(err)
  }
}

const updateQuoteReport = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { body } = req
    const { reportes, vigente } = body

    if (reportes.length != 0) {
      const results = []
      for (let i = 0; i < reportes.length; i++) {
        const result = await quoteService.updateReport(reportes[i], vigente)
        results.push(result)
      }
      return res.json({
        error: false,
        results
      })
    }
  } catch (err) {
    next(err)
  }
}

const deleteQuoteReport = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { body } = req
    const { reportes } = body

    if (reportes.length != 0) {
      const results = []
      for (let i = 0; i < reportes.length; i++) {
        const result = await quoteService.deleteReport(reportes[i])
        results.push(result)
      }
      return res.json({
        error: false,
        results
      })
    }
  } catch (err) {
    next(err)
  }
}

const createQuoteComment = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { body } = req
    const { insertId } = await quoteService.insertComment(body)
    const [results] = await quoteService.getCommentById(insertId)
    return res.json({
      error: false,
      results
    })
  } catch (err) {
    next(err)
  }
}

const deleteQuoteComments = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { body } = req
    const { cotizacion, comentarios } = body

    if (!cotizacion) return next(boom.badRequest('No ID'))
    if (!comentarios || comentarios.length < 1) return next(boom.badRequest('No hay IDs de comentarios...'))

    // Eliminar comentarios
    const eliminados = []
    for (let i = 0; i < comentarios.length; i++) {
      const { affectedRows } = await quoteService.deleteComment(cotizacion, comentarios[i])
      if (affectedRows !== 0) {
        eliminados.push(comentarios[i])
      }
    }

    return res.json({
      eliminados
    })
  } catch (err) {
    next(err)
  }
}

const getQuoteReports = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { body } = req
    const { reporteId } = body
    const results = await quoteService.getPayments(reporteId)
    return res.json({
      error: false,
      results
    })
  } catch (err) {
    next(err)
  }
}

const getQuoteReportByID = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { id } = req.params
    const results = await quoteService.getReports(id)
    return res.json({
      error: false,
      results
    })
  } catch (err) {
    next(err)
  }
}

const updateQuoteStatus = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const { body, params: { cotId } } = req

    let updateQuote = await quoteService.update(cotId, body)
    let friends = null
    // Si el estatus fue un 2 DEAL
    if (body.cot_status === 2) {
      const [cotizacion] = updateQuote
      const { cotizacion_id: cotizacionID, metodo_pago_id: metodoPagoID, credito_dias: creditoDias } = cotizacion
      if (metodoPagoID === 2 || metodoPagoID === 3) {
        await quoteService.setCreditDate(cotizacionID, creditoDias)
        updateQuote = await quoteService.getById(cotId)
      }
      // Se comprueba si el comprador y vendedor de la cotización
      // son amigos. De NO ser amigos se creará la amistad automáticamente
      // siendo el comprador quien agregué al vendedor.
      const [datosCotizacion] = await quoteService.getBuyerAndSeller(cotId)
      const { usuario_comprador: compradorID, usuario_vendedor: vendedorID } = datosCotizacion
      const [areFriends] = await friendService.areFriends({ myId: compradorID, userId: vendedorID })
      friends = { alreadyFriends: true, newFriends: false }
      if (!areFriends) {
        await friendService.createFriendshipFromDeal(compradorID, vendedorID)
        friends = { alreadyFriends: false, newFriends: true }
      }

      // Obtener productos y enviar correo electronico de crear review
      const products = await quoteService.getQuoteProductsForReviewEmail(cotId)
      const [user] = await userService.getAllDataById(compradorID)

      // Enviar email por producto
      for (let i = 0; i < products.length; i++) {
        const msg = {
          to: `${user.usu_nombre} <${user.usu_email}>`,
          from: `${email.sender.name} <${email.sender.email}>`,
          replyTo: `${email.sender.email}`,
          subject: 'Calificación de Productos',
          text: 'Crea un review de tus productos',
          html: requestProductReviewTemplate(user.usu_id, products[i].product_id, user.usu_nombre, products[i])
        }
        await sendgrid(msg)
      }
    }
    res.status(200).json({
      error: false,
      results: updateQuote,
      friends
    })
  } catch (err) {
    next(err)
  }
}

const getQuoteCommentsByID = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { id } = req.params
    const results = await quoteService.getComments(id)
    
    const encryptedResponse = await cipher.encryptData(JSON.stringify({
      error: false,
      results
    }));

    return res.status(200).send(encryptedResponse)
  } catch (err) {
    next(err)
  }
}

const getQuoteCommentsNotSeen = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { params } = req
    const { id } = params

    const comentariosSinLeer = await quoteService.getCommentsSinLeer(id)
    return res.json({
      error: false,
      results: {
        total: comentariosSinLeer.length,
        comentarios: comentariosSinLeer
      }
    })
  } catch (err) {
    next(err)
  }
}

const updateQuoteCommentsNotSeen = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { body, params } = req
    const { comentarios } = body
    const { id } = params

    const results = await quoteService.updateCommentsSinLeer(id, comentarios)
    return res.json({
      error: false,
      results
    })
  } catch (err) {
    next(err)
  }
}

const createQuoteExperience = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { body } = req

    const latestQuoteID = await quoteService.getExperienceLastQuoteID(body)
    if (!latestQuoteID) return next(boom.badRequest('There is no closed quote'))

    body.cot_id = latestQuoteID

    const created = await quoteService.createNewExperience(body)
    if (!created) return next(boom.badRequest('Cant post'))
    return res.json({
      error: false,
      experiencia: body
    })
  } catch (err) {
    next(err)
  }
}

const updateQuoteExperience = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { body, params } = req
    const { id } = params

    const { affectedRows } = await quoteService.updateExperience(id, body)

    if (affectedRows === 0) return next(boom.badRequest('Experiencia no encontrada'))

    return res.json({
      error: false,
      experiencia: {
        cot_id: id,
        ...body
      }
    })
  } catch (err) {
    next(err)
  }
}

const getQuoteLatestUpdate = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { params } = req
    const { id } = params

    // Obtener última hija
    const [hija] = await quoteService.getLastChild(id)
    if (!hija) return next(boom.badRequest('No cotización'))
    const productos = await quoteService.getLastChildTotalAmount(hija.cot_id)
    if (!productos) return next(boom.badRequest('No totales'))

    // hija.productos = productos.length
    hija.productos = productos

    // Obtener total de $$$ de última hija
    const { total, moneda } = await calcularTotal(productos)
    hija.total = total

    return res.json({
      error: false,
      hija,
      moneda
    })
  } catch (err) {
    next(err)
  }
}

const getQuoteBuyerAndSeller = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { params } = req
    const { cotizacion } = params

    const [usuarios] = await quoteService.getBuyerAndSeller(cotizacion)

    return res.json({
      error: false,
      results: {
        usuarios
      }
    })
  } catch (err) {
    next(err)
  }
}

const getQuoteBuyerAndSellerV2 = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  const fileMethod = `file: src/controllers/api/cotizacion.js - method: getQuoteBuyerAndSellerV2`
  try {
    const { params } = req
    const { cotizacion } = params

    const [usuarios] = await cotizacionesService.getBuyerAndSeller(cotizacion)

    const encryptedResponse = await cipher.encryptData(JSON.stringify({
      error: false,
      results: {
        usuarios
      }
    }));

    res.status(200).send(encryptedResponse)
  } catch (err) {
    logger.error(`Ocurrio un error y no se pudo regresar una respuesta exitosa: ${JSON.stringify(err)} - ${fileMethod}`)
    next(err)
  }
}

const createQuoteReceipt = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const { body } = req

    // La cotización tiene que ser DEAL estatus 2
    const estatusDeal = 2
    const [cotizacion] = await quoteService.getById(body.cot_id)
    if (!cotizacion) return next(boom.badRequest('No existe cotización'))
    if (cotizacion.cotizacion_estatus !== estatusDeal) return next(boom.badRequest('Sólo cotizaciones cerradas'))
    const uuidGenerado = uuid.v4()
    let pagoGenerado = null

    // WAKO

    const { file } = req
    const Location = await s3.uploadImageS3(file)

    const { affectedRows } = await quoteService.insertPaymentProof(body, uuidGenerado, Location)
    pagoGenerado = affectedRows
    if (pagoGenerado === 0) return next(boom.badRequest('No se pudo crear'))
    const [payment] = await quoteService.getPaymentProofById(uuidGenerado)
    return res.json({
      error: false,
      results: {
        payment
      }
    })
  } catch (err) {
    next(err)
  }
}

const getQuotesToRate = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    let { params: { userID } } = req
    userID = Math.abs(userID) || null
    if (!userID) return next(boom.badRequest('Wrong user'))

    const details = await quoteNewService.getUserDetails(userID)
    if (!details) return next(boom.badRequest('Wrong user'))

    const { userType, companyID } = details
    let quotes = []

    switch (userType) {
      case userTypes.admin:
        quotes = await quoteService.getQuotesToRateAdmin(companyID)
        break
      case userTypes.buyer:
        quotes = await quoteService.getQuotesToRateBuyer(userID)
        break
    }

    return res.json({
      error: false,
      results: {
        total: quotes.length,
        quotes
      }
    })
  } catch (err) {
    next(err)
  }
}

const getSuccessCases = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)

    let { idioma } = req.query
    if (!Number(idioma)) return next(boom.badRequest('Idioma should be a number.'))
    if (!idioma) idioma = 1

    const results = await quoteService.getSuccessCases(idioma)

    return res.json({
      error: false,
      results
    })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  updateCotizacion,
  getCotizaciones,
  filterCompany,
  createCotizacion,
  getQuotesWithFilters,
  getQuoteDateDays,
  getQuoteReceipts,
  getQuotePDF,
  getQuoteById,
  getQuoteProducts,
  createQuote,
  createChildrenQuote,
  getQuoteLog,
  getQuotePaymentReportByID,
  createQuotePaymentReportPayment,
  updateQuotePaymentReport,
  deleteQuotePaymentReportByID,
  createQuotePaymentReport,
  updateQuoteReport,
  deleteQuoteReport,
  createQuoteComment,
  deleteQuoteComments,
  getQuoteReports,
  getQuoteReportByID,
  updateQuoteStatus,
  getQuoteCommentsByID,
  getQuoteCommentsNotSeen,
  updateQuoteCommentsNotSeen,
  createQuoteExperience,
  updateQuoteExperience,
  getQuoteLatestUpdate,
  getQuoteBuyerAndSeller,
  createQuoteReceipt,
  getQuotesToRate,
  getSuccessCases,
  getCotizacionProductos,
  getCotizacionLog,
  getQuoteBuyerAndSellerV2
}
