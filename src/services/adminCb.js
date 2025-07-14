'use strict'

const path = require('path')
const fs = require('fs')
const Boom = require('@hapi/boom')
const mysqldump = require('mysqldump')
const config = require('../config')

class AdminCbService {
  async backupDatabaseStructure () {
    const backupDir = path.join(__dirname, '..', '..', 'temp', 'backups')
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupFile = path.join(backupDir, `mc-api-structure-backup-${timestamp}.sql`)

    try {
      await mysqldump({
        connection: {
          host: config.mysql.host,
          user: config.mysql.user,
          password: config.mysql.password,
          database: config.mysql.database,
          port: config.mysql.port
        },
        dump: {
          schema: {
            tables: true,
            views: true,
            triggers: true,
            routines: true,
            events: true
          },
          data: false // Asegura que solo se exporte la estructura
        },
        dumpToFile: backupFile
      })
      return { message: `Database structure backup created successfully at ${backupFile}` }
    } catch (error) {
      console.error(`Error creating backup: ${error}`)
      throw Boom.internal('Failed to create database backup.')
    }
  }

  async backupDatabaseFull () {
    const backupDir = path.join(__dirname, '..', '..', 'temp', 'backups')
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupFile = path.join(backupDir, `mc-api-full-backup-${timestamp}.sql`)

    try {
      await mysqldump({
        connection: {
          host: config.mysql.host,
          user: config.mysql.user,
          password: config.mysql.password,
          database: config.mysql.database,
          port: config.mysql.port
        },
        dump: {
          schema: {
            tables: true,
            views: true,
            triggers: true,
            routines: true,
            events: true
          },
          data: {} // Asegura que se exporte la estructura Y los datos
        },
        dumpToFile: backupFile
      })
      return { message: `Full database backup created successfully at ${backupFile}` }
    } catch (error) {
      console.error(`Error creating full backup: ${error}`)
      throw Boom.internal('Failed to create full database backup.')
    }
  }
}

module.exports = AdminCbService 