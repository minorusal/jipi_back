'use strict'

const AdminCbService = require('../../services/adminCb')
const adminCbService = new AdminCbService()

const backupDatabaseStructure = async (req, res, next) => {
  try {
    const result = await adminCbService.backupDatabaseStructure()
    res.status(200).json(result)
  } catch (error) {
    next(error)
  }
}

const backupDatabaseFull = async (req, res, next) => {
  try {
    const result = await adminCbService.backupDatabaseFull()
    res.status(200).json(result)
  } catch (error) {
    next(error)
  }
}

module.exports = {
  backupDatabaseStructure,
  backupDatabaseFull
} 