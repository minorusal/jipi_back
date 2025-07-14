'use strict'

const express = require('express')
const router = express.Router()
const adminCbController = require('../../controllers/api/adminCb')

/**
 * @openapi
 * /api/admin-cb/backup-structure:
 *   post:
 *     tags:
 *       - AdminCb
 *     summary: Create a database structure backup
 *     description: Triggers a process to back up the database schema without any data.
 *     responses:
 *       '200':
 *         description: Backup created successfully.
 *       '500':
 *         description: Internal Server Error.
 */
router.post('/backup-structure', adminCbController.backupDatabaseStructure)

/**
 * @openapi
 * /api/admin-cb/backup-full:
 *   post:
 *     tags:
 *       - AdminCb
 *     summary: Create a full database backup (structure and data)
 *     description: Triggers a process to back up the entire database, including schema and all data.
 *     responses:
 *       '200':
 *         description: Backup created successfully.
 *       '500':
 *         description: Internal Server Error.
 */
router.post('/backup-full', adminCbController.backupDatabaseFull)

module.exports = router 