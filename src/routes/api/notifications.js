const express = require('express')

const { createNotification, deleteNotification } = require('../../utils/schemas/notifications')
const validation = require('../../utils/middlewares/validationHandler')
const notificationsController = require('../../controllers/api/notifications')
const authMiddleware = require('../../utils/middlewares/authMiddleware')

const router = express.Router()

router.get('/', /*authMiddleware,*/ notificationsController.getNotifications)
router.get('/:user', /*authMiddleware,*/ notificationsController.getUserNotifications)

/**
 * @swagger
 * /api/notifications:
 *   post:
 *     summary: Crea una notificación
 *     description: Crea una nueva notificación en el sistema.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               IdDestino:
 *                 type: integer
 *                 example: 66
 *               TipoDestino:
 *                 type: integer
 *                 example: 2
 *               IdOrigen:
 *                 type: integer
 *                 example: 86
 *               TipoOrigen:
 *                 type: integer
 *                 example: 1
 *               IdTipoNotificacion:
 *                 type: integer
 *                 example: 1
 *             required:
 *               - IdDestino
 *               - TipoDestino
 *               - IdOrigen
 *               - TipoOrigen
 *               - IdTipoNotificacion
 *     responses:
 *       200:
 *         description: Notificación creada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: boolean
 *                   example: false
 *                 results:
 *                   type: object
 *                   properties:
 *                     notificacion:
 *                       type: object
 *                       properties:
 *                         notificacionID:
 *                           type: integer
 *                           example: 7
 *                         entidadOrigenTipo:
 *                           type: string
 *                           example: 'Usuario'
 *                         entidadOrigenId:
 *                           type: integer
 *                           example: 86
 *                         entidadDestinoTipo:
 *                           type: string
 *                           example: 'Empresa'
 *                         entidadDestinoId:
 *                           type: integer
 *                           example: 66
 *                         mensaje_notificacion:
 *                           type: string
 *                           nullable: true
 *                           example: null
 *                         Fecha:
 *                           type: string
 *                           format: date-time
 *                           example: '2024-09-11T19:54:21.000Z'
 *       400:
 *         description: Error en la solicitud
 *       500:
 *         description: Error interno del servidor
 */
router.post('/', notificationsController.createNotification)
router.delete('/:uuid', /*authMiddleware,*/ validation(deleteNotification), notificationsController.deleteNotification)
router.put('/:uuid', /*authMiddleware,*/ notificationsController.editNotification)

module.exports = router
