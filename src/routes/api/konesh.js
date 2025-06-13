'use strict'

const express = require('express')
const router = express.Router()
const konesh = require('../../controllers/api/konesh')
const { notAllowUserToken, notAllowGenericToken } = require('../../utils/middlewares/globalAuth')
const decryptMiddleware = require('../../utils/middlewares/cipherMiddleware')

/**
 * @swagger
 * /api/konesh/ValidaListaService:
 *   post:
 *     summary: Valida un RFC en el servicio Konesh - Cifrado => [true]
 *     description: Este endpoint recibe un RFC y valida su existencia en el servicio Konesh.
 *     tags:
 *       - Konesh
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rfc:
 *                 type: string
 *                 example: "SAMA8406259C7"
 *               razon_social:
 *                 type: string
 *                 example: "ALAIN SALZGEBER MONTAÑO"
 *               idEmpresa:
 *                 type: integer
 *                 example: 629
 *               tipo:
 *                 type: string
 *                 enum: [fisico, moral]
 *                 example: "moral"
 *     responses:
 *       200:
 *         description: Validación exitosa con los datos asociados al RFC o error de razón social
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       emp_id:
 *                         type: integer
 *                         example: 72
 *                       konesh_valid:
 *                         type: string
 *                         example: "true"
 *                       tax_id:
 *                         type: string
 *                         example: "SAMA8406259C7"
 *                       name:
 *                         type: string
 *                         example: "ALAIN SALZGEBER MONTAÑO"
 *                       postal_code:
 *                         type: string
 *                         example: "10200"
 *                       transaction_id:
 *                         type: string
 *                         example: "anaheim-v2-2025121-147282"
 *                       transaction_date:
 *                         type: string
 *                         format: date-time
 *                         example: "2025-02-21T15:12:03"
 *                       node:
 *                         type: string
 *                         example: "anaheim-v2"
 *                       empresa_nombre:
 *                         type: string
 *                         example: "PERSONA FÍSICA"
 *                 - type: object
 *                   properties:
 *                     error:
 *                       type: boolean
 *                       example: true
 *                     message:
 *                       type: string
 *                       example: "Ha alcanzado el limite de intentos para validar el RFC"
 *                 - type: object
 *                   properties:
 *                     transactionResponse01:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           data01:
 *                             type: string
 *                             example: "SAMA8406259C7"
 *                           data02:
 *                             type: string
 *                             example: "true"
 *                           data03:
 *                             type: string
 *                             example: null
 *                           data04:
 *                             type: string
 *                             example: "ALAIN SALZGEBER MONTAÑO"
 *                           data05:
 *                             type: string
 *                             example: "10200"
 *                     transactionResponse02:
 *                       type: string
 *                       example: "anaheim-v2-2025121-147282"
 *                     transactionResponse03:
 *                       type: string
 *                       example: "2025-02-21 15:12:03"
 *                     transactionResponse04:
 *                       type: string
 *                       example: "anaheim-v2"
 *                     error:
 *                       type: boolean
 *                       example: true
 *                     message:
 *                       type: string
 *                       example: "El RFC es incorrecto"
 *       400:
 *         description: Petición incorrecta o mal formada
 *       500:
 *         description: Error en el servidor al procesar la solicitud
 */
router.post('/ValidaListaService', decryptMiddleware,  konesh.validaListaService)

/**
 * @swagger
 * /api/konesh/consultaEstatusKonesh/{rfc}:
 *   get:
 *     summary: Consulta el estatus de un RFC en el servicio Konesh - Cifrado => [true]
 *     description: Este endpoint consulta el estatus de un RFC en el servicio Konesh del módulo konesh sin realizar modificaciones.
 *     operationId: consultaEstatusKonesh
 *     tags:
 *       - Konesh
 *     parameters:
 *       - in: path
 *         name: rfc
 *         required: true
 *         schema:
 *           type: string
 *           example: "SAMA8406259C7"
 *     responses:
 *       200:
 *         description: Consulta exitosa con los datos asociados al RFC
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   emp_id:
 *                     type: integer
 *                     example: 72
 *                   konesh_valid:
 *                     type: string
 *                     example: "true"
 *                   tax_id:
 *                     type: string
 *                     example: "SAMA8406259C7"
 *                   name:
 *                     type: string
 *                     example: "ALAIN SALZGEBER MONTAÑO"
 *                   postal_code:
 *                     type: string
 *                     example: "10200"
 *                   transaction_id:
 *                     type: string
 *                     example: "atlantic-v2-2025029-734026"
 *                   transaction_date:
 *                     type: string
 *                     format: date-time
 *                     example: "2025-01-29T11:44:09.000Z"
 *                   node:
 *                     type: string
 *                     example: "atlantic-v2"
 *                   empresa_nombre:
 *                     type: string
 *                     example: "PERSONA FÍSICA"
 *       400:
 *         description: Petición incorrecta o mal formada
 *       500:
 *         description: Error en el servidor al procesar la solicitud
 *     x-modulo: konesh
 */
router.get('/consultaEstatusKonesh/:rfc', konesh.consultaEstatusKonesh)

router.post('/descifra', konesh.descifra)
router.post('/cifra', konesh.cifra)


module.exports = router
