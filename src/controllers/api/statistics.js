'use strict'

const debug = require('debug')('old-api:statistics-controller')
const boom = require('boom')
const calcularPromedio = require('../../utils/calcularPromedioDeals')
const statisticService = require('../../services/statistics')
const userService = require('../../services/users')
const companiesService = require('../../services/companies')
const productService = require('../../services/products')

const getStatisticsByCompany = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const { params: { empresa } } = req
    const prospectos = await statisticService.getProspectos(empresa)
    const [ventas] = await statisticService.getVentas(empresa)
    const [opiniones] = await statisticService.getOpiniones(empresa)
    const [compras] = await statisticService.getCompras(empresa)
    const [contactos] = await statisticService.getContactos(empresa)
    const seguidores = await statisticService.getFollowersByCompanyID(empresa)
    const products = await statisticService.getStatisticsForProductsByCompanyID(empresa)
    res.status(200).json({
      error: false,
      results: {
        prospectos,
        compras: compras.total,
        ventas: ventas.total,
        seguidores,
        contactos: contactos.total,
        opiniones: opiniones.total,
        products
      }
    })
  } catch (err) {
    next(err)
  }
}

const getStatisticsByUser = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const { user } = req.params
    // Revisar usuario
    const [usuario] = await userService.getById(user)
    // Si no existe 400
    if (!usuario) return next(boom.badRequest(`User ${user} does not exists`))
    // Obtener la empresa del usuario
    const [empresa] = await userService.getEmpresaByUserId(user)
    const { emp_id: empID } = empresa
    // Revisar tipo de usuario
    const { usu_tipo: usuTipo } = usuario
    let estadisticas = null
    const [vendedor, comprador, administrador] = [1, 2, 3]
    if (usuTipo === vendedor) {
      // Prospectos: Cotizaciones abiertas
      // Ventas: Las cotizaciones cerradas
      // Seguidores:
      // Contactos: Proveedores + Clientes
      // Opiniones: El promedio de las experiencias de las cotizaciones
      const prospectos = await statisticService.getProspectosDeUsuario(user)
      const [ventas] = await statisticService.getQuotesDeal(empID)
      const [seguidores] = await statisticService.getSeguidores(user)
      const [proveedores] = await statisticService.getProveedoresDeUsuario(user)
      const [clientes] = await statisticService.getClientesDeEmpresa(empID)
      const [promedios] = await statisticService.getPromediosExperienciaEmpresa(empID)
      const { tiempo, calidad, servicio } = promedios

      estadisticas = {
        prospectos: prospectos.length,
        ventas: ventas.total,
        seguidores: seguidores.total,
        contactos: clientes.total + proveedores.total,
        opiniones: Number(((tiempo + calidad + servicio) / 3).toFixed(2))
      }
    } else if (usuTipo === comprador) {
      // Compras: El número de compras realizadas
      // Seguidores:
      // Contactos: Proveedores + Clientes
      // Opiniones: ???
      const [compras] = await statisticService.getComprasDeUsuario(user)
      const [seguidores] = await statisticService.getSeguidores(user)
      const [proveedores] = await statisticService.getProveedoresDeUsuario(user)
      const [clientes] = await statisticService.getClientesDeEmpresa(empID)
      const [promedios] = await statisticService.getPromediosExperienciaEmpresa(empID)
      const { tiempo, calidad, servicio } = promedios

      estadisticas = {
        compras: compras.total,
        seguidores: seguidores.total,
        contactos: clientes.total + proveedores.total,
        opiniones: Number(((tiempo + calidad + servicio) / 3).toFixed(2))
      }
    } else if (usuTipo === administrador) {
      const { userCompanyID: empresa } = await userService.getUserAndCompanyDetailsForStatistics(user)

      const prospectos = await statisticService.getProspectos(empresa)
      const [ventas] = await statisticService.getVentas(empresa)
      const [opiniones] = await statisticService.getOpiniones(empresa)
      const [compras] = await statisticService.getCompras(empresa)
      const [contactos] = await statisticService.getContactos(empresa)
      const seguidores = await statisticService.getFollowersByCompanyID(empresa)
      estadisticas = {
        prospectos,
        compras: compras.total,
        ventas: ventas.total,
        seguidores,
        contactos: contactos.total,
        opiniones: opiniones.total
      }
    }

    const network = await statisticService.getFriends(user)
    estadisticas.network = network

    res.status(200).json({
      error: false,
      estadisticas
    })
  } catch (err) {
    next(err)
  }
}

const getStatisticsForHomepage = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const productosMasVendidos = await statisticService.getMostSelledProducts()
    if (productosMasVendidos !== null || productosMasVendidos.length !== 0) {
      for (let i = 0; i < productosMasVendidos.length; i++) {
        const prodID = productosMasVendidos[i].prod_id
        const producto = await productService.getByIdDetalles(prodID)
        productosMasVendidos[i].detalles = producto
      }
    }

    const [productos] = await statisticService.getTotalProductos()
    const empresasVendedoras = await statisticService.getTotalEmpresasVendedoras()
    const dealsDiarios = await statisticService.getDealsDiarios()

    const cifras = {
      productos: productos.total,
      vendedoras: empresasVendedoras.length,
      deals: calcularPromedio(dealsDiarios)
    }

    const cotizaciones = await statisticService.getUltimasCotizacionesDetalles()

    if (cotizaciones !== null || cotizaciones.length !== 0) {
      for (let i = 0; i < cotizaciones.length; i++) {
        const { cot_id: ID } = cotizaciones[i]
        const productos = await statisticService.getUltimasCotizacionesProductos(ID)
        cotizaciones[i].productos = null
        if (productos) {
          cotizaciones[i].productos = productos
          // Obtener fotos de productos
          for (let j = 0; j < productos.length; j++) {
            const productoID = productos[j].prod_id
            const fotos = await productService.getProductoFotos(productoID)
            productos[j].fotos = fotos.map(f => f.foto_url) || null
          }
        }
      }
    }

    const productosEmpresasVerificadas = await statisticService.getProductosEmpresasVerificadas()

    if (productosEmpresasVerificadas !== null || productosEmpresasVerificadas.length !== 0) {
      for (let i = 0; i < productosEmpresasVerificadas.length; i++) {
        const productoID = productosEmpresasVerificadas[i].prod_id
        const fotos = await productService.getProductoFotos(productoID) || null
        productosEmpresasVerificadas[i].fotos = fotos
      }
    }

    res.status(200).json({
      error: false,
      results: {
        cifras,
        cotizaciones,
        productos_empresas_verificadas: productosEmpresasVerificadas,
        productos_mas_vendidos: productosMasVendidos || null
      }
    })
  } catch (err) {
    next(err)
  }
}

const getNumbersByUser = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const { query: { admin, start, finish }, params: { user } } = req

    const userDetails = await userService.getUserAndCompanyDetailsForStatistics(user)
    const [adminDetails] = await userService.getEmpresaByUserId(admin)
    if (!userDetails || !adminDetails) return next(boom.notFound('User not found'))
    const { userCompanyID } = userDetails
    const { emp_id: adminCompanyID } = adminDetails
    const [isAdminDetails] = await companiesService.getCompanyAdmin(adminCompanyID)
    if (admin !== isAdminDetails.id) return next(boom.unauthorized('Must be admin'))
    if (userCompanyID !== adminCompanyID) return next(boom.badRequest('Admin must be work in the same company as user'))

    const [typeSeller, typeBuyer] = [1, 2]
    const { userType } = userDetails

    let buyer = null
    let seller = null

    if (userType === typeBuyer) {
      const purchasesTotal = await statisticService.getHistoricalPurchases(user)
      const purchasesInProccess = await statisticService.getPossiblePurchases(user, start, finish)
      const deliveryTime = Math.floor(Math.random() * 14)
      const compliance = Math.floor(Math.random() * 100)
      const numbers = await statisticService.getBuyerNumbersForAdminStatistics(user)

      buyer = {
        purchasesTotal,
        purchasesInProccess,
        deliveryTime,
        compliance,
        ...numbers
      }
    } else if (userType === typeSeller) {
      // Ventas historicas: Ventas que ha hecho desde que se dio de alta en la plataforma con esa empresa, las ventas que tiene con esa empresa desde que se unio.
      // Meta: la meta del mes que le fijan a cada uno.
      // Venta del mes: lo que hizo en el mes, lo vendido
      // Posibles ventas: Sus posibles ventas de cotizaciones.
      // Faltante: lo faltante de sus ventas del mes, la resta de sus ventas menos su meta.
      // Conversaciones: Las conversaciones que respondio en el chat general de la empresa (no la de cotizacioens)
      // Tiempo estimado de respuesta: El tiempo que se tarda aproxiamadamente en responder un mensaje.

      const historicalSales = await statisticService.getHistoricalSales(user)
      const goal = await statisticService.getUserGoalPeriodOfTime(user, start, finish)
      const timeFrameSalesAmount = await statisticService.getTimeFrameSalesAmount(user, start, finish)
      const timeFrameSalesQuotes = await statisticService.getTimeFrameSalesQuotes(user, start, finish)
      const possibleSales = await statisticService.getPossibleSales(user, start, finish)
      const missing = goal - timeFrameSalesAmount
      const conversations = await statisticService.getTotalConversations(user)
      const timeToRespond = await statisticService.getAverageTimeToRespond(user)
      const numbers = await statisticService.getSellerNumbersForAdminStatistics(user)

      seller = {
        historicalSales,
        goal,
        timeFrameSalesAmount,
        timeFrameSalesQuotes,
        possibleSales,
        missing,
        conversations,
        timeToRespond,
        ...numbers
      }
    }
    return res.json({
      error: false,
      results: {
        buyer,
        seller
      }
    })
  } catch (err) {
    next(err)
  }
}

const createGoalForUser = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const { body: { admin, goal } } = req
    let { params: { user } } = req
    user = Math.abs(user)
    if (!user) return next(boom.badRequest('Wrong user'))

    const [userDetails] = await userService.getEmpresaByUserId(user)
    const [adminDetails] = await userService.getEmpresaByUserId(admin)
    if (!userDetails || !adminDetails) return next(boom.notFound('User not found'))
    const { emp_id: userCompanyID } = userDetails
    const { emp_id: adminCompanyID } = adminDetails
    const [isAdminDetails] = await companiesService.getCompanyAdmin(adminCompanyID)
    if (admin !== isAdminDetails.id) return next(boom.unauthorized('Must be admin'))
    if (userCompanyID !== adminCompanyID) return next(boom.badRequest('Admin must be work in the same company as user'))

    // Is there a goal for this user already?
    const currentGoal = await statisticService.getCurrentGoal(user)
    if (currentGoal) return next(boom.badRequest('Goal already exists'))
    // If it does return a bad request
    // If it doesnt create a goal for this user
    const created = await statisticService.createGoalForUser(user, goal)

    res.status(201).json({
      error: false,
      results: {
        created
      }
    })
  } catch (err) {
    next(err)
  }
}

const updateGoalForUser = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const { body: { admin, goal } } = req
    let { params: { user } } = req
    user = Math.abs(user)
    if (!user) return next(boom.badRequest('Wrong user'))

    const [userDetails] = await userService.getEmpresaByUserId(user)
    const [adminDetails] = await userService.getEmpresaByUserId(admin)
    if (!userDetails || !adminDetails) return next(boom.notFound('User not found'))
    const { emp_id: userCompanyID } = userDetails
    const { emp_id: adminCompanyID } = adminDetails
    const [isAdminDetails] = await companiesService.getCompanyAdmin(adminCompanyID)
    if (admin !== isAdminDetails.id) return next(boom.unauthorized('Must be admin'))
    if (userCompanyID !== adminCompanyID) return next(boom.badRequest('Admin must be work in the same company as user'))

    // Is there a goal for this user already?
    const currentGoal = await statisticService.getCurrentGoal(user)
    if (!currentGoal) return next(boom.notFound('Goal not found'))

    const updated = await statisticService.updateGoalForUser(user, goal)
    res.json({
      error: false,
      results: {
        updated
      }
    })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  getStatisticsByCompany,
  getStatisticsByUser,
  getStatisticsForHomepage,
  getNumbersByUser,
  createGoalForUser,
  updateGoalForUser
}
