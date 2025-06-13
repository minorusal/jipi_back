'use strict'

const debug = require('debug')('old-api:credit-report-controller')
const boom = require('boom')
const creditReportService = require('../../services/credit-report')
const quoteService = require('../../services/quotes')
const paymentsService = require('../../services/payments')
const companiesService = require('../../services/companies')
const hadesService = require('../../services/hades')
const cronosTypes = { certification: 'Certification', report: 'Report' }
Object.freeze(cronosTypes)

const stripe = require('../../lib/stripe')

const askForCertification = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const { body: { quote, origin, destiny } } = req
    // La cotización debe existir con este ID, y con las mismas empresas. De no existir 404
    const quoteDetails = await creditReportService.getCompaniesByQuoteId(quote, origin, destiny)
    if (!quoteDetails) return next(boom.notFound('Quote not found'))
    // Conseguir cotización padre, esta será asignada a la solicitud del reporte
    const quoteFatherID = await quoteService.getFatherQuoteId(quote)
    // Crear reporte
    await creditReportService.createReport(quoteFatherID, origin, destiny)
    return res.status(201).json({
      error: false,
      results: {
        created: true
      }
    })
  } catch (err) {
    next(err)
  }
}

const editCertificationSolicitude = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const { body: { status, company } } = req
    let { params: { reportID } } = req
    reportID = Math.abs(reportID) || 0
    // ¿Existe el reporte? Si no, 404
    const existeReporte = await creditReportService.getReportSolicitudeByIdAndDestiny(reportID, company)
    if (!existeReporte) return next(boom.notFound('Report not found'))
    // Solo el destino del reporte lo puede editar
    const edited = await creditReportService.editReportSolicitude(reportID, status, company)
    return res.json({
      error: false,
      results: {
        edited
      }
    })
  } catch (err) {
    next(err)
  }
}

const getCreditReport = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    let { params: { reportID }, query: { petitioner, destiny } } = req
    reportID = Math.abs(reportID) || 0
    petitioner = Math.abs(petitioner) || 0
    destiny = Math.abs(destiny) || 0
    const reportAvailable = await creditReportService.getCreditReport(reportID, petitioner, destiny)
    if (!reportAvailable) return next(boom.badRequest('Report not found'))
    return res.json({
      error: false,
      results: {
        report: {},
        message: 'Report available',
        payload: reportAvailable
      }
    })
  } catch (err) {
    next(err)
  }
}

const payCreditReport = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const { body: { quote, origin, destiny, payment: paymentMethod } } = req
    // La cotización debe existir con este ID, y con las mismas empresas. De no existir 404
    const quoteDetails = await creditReportService.getCompaniesByQuoteId(quote, origin, destiny)
    if (!quoteDetails) return next(boom.notFound('Quote not found'))
    // Conseguir cotización padre, esta será asignada a la solicitud del reporte
    const quoteFatherID = await quoteService.getFatherQuoteId(quote)

    // Puente entre Arcsa: conseguir datos
    const companyID = destiny
    const userAdminDetails = await creditReportService.getUserDetails(companyID)
    if (!userAdminDetails) return next(boom.badRequest('It needs an address'))

    // Crear reporte
    const reportID = await creditReportService.payForCreditReport(quoteFatherID, origin, destiny, paymentMethod)

    // Generar y guardar pago
    const [userIDRaw] = await companiesService.getCompanyAdmin(origin)
    const { id: userID } = userIDRaw
    const creditReportPrice = await creditReportService.getCreditReportPrice()
    const { precio, moneda } = creditReportPrice

    const [customerIDRaw] = await paymentsService.getCustomerStripeID(userID)
    if (!customerIDRaw) return next(boom.notFound('User does not have customerID'))
    const { customerID } = customerIDRaw
    const payment = await stripe.createPayment(precio, moneda, customerID, paymentMethod) // .catch(err => next(boom.badRequest(`Error making payment: ${err}`)))

    if (payment.statusCode) return next(boom.badRequest(`Error in payment: ${payment.type}`))

    await paymentsService.savePayment(userID, precio, 'CreditReport', moneda)

    // Puente entre Arcsa: mandar datos
    const dataToSend = {
      basica: {
        ...userAdminDetails,
        id: reportID
      }
    }
    await hadesService.sendDataToCronos(cronosTypes.report, dataToSend)

    return res.status(201).json({
      error: false,
      results: {
        created: true
      }
    })
  } catch (err) {
    next(err)
  }
}


const getPaymentType = async (req, res, next) => {
  try {
    const opcionesPago = await creditReportService.getPaymentType()
    return res.status(201).json({
      error: false,
      results: {
        opcionesPago
      }
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  askForCertification,
  editCertificationSolicitude,
  getCreditReport,
  payCreditReport,
  getPaymentType
}
