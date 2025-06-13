'use strict'

const ejs = require('ejs')
const pdf = require('html-pdf')
const path = require('path')
const appRoot = require('app-root-path')
const debug = require('debug')('old-api:pdf-utils-generatePDF')
const newName = require('./names')

const generatePDF = (data) => {
  return new Promise((resolve, reject) => {
    debug('Entrando a generate...')
    ejs.renderFile(path.join(__dirname, './templates/quote-details.ejs'), {
      data: data
    }, (err, data) => {
      if (err) {
        debug(err)
        reject(new Error('No se pudo crear PDF'))
      } else {
        const options = {
          height: '11.25in',
          width: '8.5in',
          header: {
            height: '20mm'
          },
          footer: {
            height: '20mm'
          }
        }
        const fileName = newName()
        pdf.create(data, options).toFile(`${appRoot}/media/pdf/${fileName}`, function (err, data) {
          debug('Creando en ')
          debug(`${appRoot}/media/pdf/${fileName}`)
          if (err) {
            reject(new Error('No se pudo crear PDF'))
          } else {
            resolve({
              message: 'Creado',
              fileName
            })
          }
        })
      }
    })
  })
}

module.exports = generatePDF
