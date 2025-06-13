'use strict'

const debug = require('debug')('old-api:hades-controller')
const boom = require('boom')
const hadesService = require('../../services/hades')
const certificationStatus = { accepted: 'Accepted', rejected: 'Rejected' }

const companyCertification = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const { body: { certification_id: certificationID, status } } = req

    // Does the Certification exists?
    const certification = await hadesService.doesCertificationExists(certificationID)
    if (!certification) return next(boom.badRequest('Wrong certification'))

    const { companyID } = certification

    if (status === certificationStatus.accepted) {
      const certified = await hadesService.certificateCompany(companyID)
      if (certified) {
        return res.json({
          error: false,
          results: {
            certified
          }
        })
      } else {
        return res.status(400).json({
          error: false,
          results: {
            certified
          }
        })
      }
    } else if (status === certificationStatus.rejected) {
      res.json({
        error: false,
        results: {
          certified: false
        }
      })
    }
  } catch (err) {
    next(err)
  }
}

const companyCertificationTest = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const { body: { certification_id: certificationID, status } } = req

    // Does the Certification exists?
    const certification = await hadesService.doesCertificationExists(certificationID)
    if (!certification) return next(boom.badRequest('Wrong certification'))

    const { companyID } = certification

    if (status === certificationStatus.accepted) {
      // const certified = await hadesService.certificateCompany(companyID)
      if (certified) {
        return res.json({
          error: false,
          results: {
            certified: true
          }
        })
      } else {
        return res.status(400).json({
          error: false,
          results: {
            certified: false
          }
        })
      }
    } else if (status === certificationStatus.rejected) {
      res.json({
        error: false,
        results: {
          certified: false
        }
      })
    }
  } catch (err) {
    next(err)
  }
}

const creditReport = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const { body: { credit_report_id: creditReportID, url } } = req

    const creditReport = await hadesService.getCreditReportByID(creditReportID)
    if (!creditReport) return next(boom.badRequest('Wrong credit report'))

    const posted = await hadesService.postCreditReport(creditReportID, url)

    res.json({
      error: false,
      results: {
        posted
      }
    })
  } catch (err) {
    next(err)
  }
}

const creditReportTest = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const { body: { credit_report_id: creditReportID, url } } = req

    const creditReport = await hadesService.getCreditReportByID(creditReportID)
    if (!creditReport) return next(boom.badRequest('Wrong credit report'))

    // const posted = await hadesService.postCreditReport(creditReportID, url)

    res.json({
      error: false,
      results: {
        posted: true
      }
    })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  companyCertification,
  companyCertificationTest,
  creditReport,
  creditReportTest
}
