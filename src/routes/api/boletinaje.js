'use strict'

const express = require('express')
const router = express.Router()
const Joi = require('joi')
const boletinajeController = require('../../controllers/api/boletinaje')
const { globalAuthMiddleware } = require('../../utils/middlewares/globalAuth')
const validationHandler = require('../../utils/middlewares/validationHandler')
const boletinajeSchema = require('../../utils/schemas/boletinaje')
const idSchema = require('../../utils/schemas/id')
const createReporteImpagoSchema = require('../../utils/schemas/createReporteImpago')
const updateReporteImpagoSchema = require('../../utils/schemas/updateReporteImpago')

const idParamsSchema = Joi.object({ id: Joi.number().integer().positive().required() })
const paginationQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).optional()
});

// --- Swagger Schemas ---
/**
 * @openapi
 * components:
 *   schemas:
 *     ReporteImpagoListItem:
 *       type: object
 *       properties:
 *         id_boletinaje_reporte_impago:
 *           type: integer
 *           example: 101
 *         nombre_empresa_deudora:
 *           type: string
 *           example: "Deudores Crónicos S.A. de C.V."
 *         rfc_deudor:
 *           type: string
 *           example: "DCR010101ABC"
 *         monto_adeudo:
 *           type: number
 *           format: double
 *           example: 12500.50
 *         fecha_creacion:
 *           type: string
 *           format: date-time
 *           example: "2024-05-20T15:00:00.000Z"
 *         estatus:
 *           type: object
 *           properties:
 *             nombre:
 *               type: string
 *               example: "En proceso"
 *         grupo:
 *           type: object
 *           properties:
 *             empresa_proveedor:
 *               type: object
 *               properties:
 *                 emp_nombre:
 *                   type: string
 *                   example: "Mi Empresa Proveedora"
 *                 emp_rfc:
 *                   type: string
 *                   example: "MEP010101XYZ"
 *             empresa_cliente:
 *               type: object
 *               properties:
 *                 emp_nombre:
 *                   type: string
 *                   example: "Deudores Crónicos S.A. de C.V."
 *                 emp_rfc:
 *                   type: string
 *                   example: "DCR010101ABC"
 *     PaginatedReportesImpago:
 *       type: object
 *       properties:
 *         total_items:
 *           type: integer
 *           example: 42
 *         total_pages:
 *           type: integer
 *           example: 5
 *         current_page:
 *           type: integer
 *           example: 1
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ReporteImpagoListItem'
 */

/**
 * @swagger
 * /api/boletinaje/cuestionario:
 *   get:
 *     tags:
 *       - Boletinaje
 *     summary: Obtiene las preguntas para el cuestionario de boletinaje.
 *     description: Retorna una lista de las preguntas activas que el usuario debe responder para iniciar un proceso de boletinaje.
 *     responses:
 *       '200':
 *         description: Lista de preguntas obtenida exitosamente.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     example: 1
 *                   texto_pregunta:
 *                     type: string
 *                     example: "¿Considera que ha agotado todas las acciones amigables de cobro?"
 *                   orden:
 *                     type: integer
 *                     example: 1
 *                   activa:
 *                     type: boolean
 *                     example: true
 *       '500':
 *         description: Error interno del servidor.
 */
router.get('/cuestionario', boletinajeController.getPreguntas)

/**
 * @swagger
 * /api/boletinaje/cuestionario:
 *   post:
 *     summary: Guarda las respuestas de un cuestionario de boletinaje.
 *     tags:
 *       - Boletinaje
 *     description: Recibe el ID de la empresa cliente, el ID del proveedor y un array de respuestas. Guarda la información en la base de datos y responde si se puede proceder o no.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id_empresa_cliente:
 *                 type: integer
 *                 description: ID de la empresa cliente que está siendo boletinada.
 *                 example: 123
 *               id_proveedor:
 *                 type: integer
 *                 description: ID de la empresa proveedora que realiza el boletinaje.
 *                 example: 456
 *               respuestas:
 *                 type: array
 *                 description: Array con las respuestas al cuestionario.
 *                 items:
 *                   type: object
 *                   properties:
 *                     id_pregunta:
 *                       type: integer
 *                       example: 1
 *                     respuesta:
 *                       type: boolean
 *                       example: true
 *     responses:
 *       '201':
 *         description: Cuestionario guardado exitosamente.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id_boletinaje_grupo:
 *                   type: string
 *                   format: uuid
 *                   description: El UUID que agrupa todas las respuestas de este cuestionario.
 *                   example: "f47ac10b-58cc-4372-a567-0e02b2c3d479"
 *                 puede_continuar:
 *                   type: boolean
 *                   description: Indica si el proceso puede continuar. Es `true` si hay 3 o más respuestas afirmativas.
 *                   example: true
 *       '400':
 *         description: Error de validación en los datos de entrada.
 *       '500':
 *         description: Error interno del servidor.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 statusCode:
 *                   type: integer
 *                   example: 500
 *                 error:
 *                   type: string
 *                   example: "Internal Server Error"
 *                 message:
 *                   type: string
 *                   example: "An internal server error occurred"
 */
router.post('/cuestionario', validationHandler(boletinajeSchema.guardarCuestionarioSchema), boletinajeController.guardarCuestionario)

/**
 * @swagger
 * /api/boletinaje/impago:
 *   post:
 *     tags:
 *       - Boletinaje
 *     summary: Guarda un nuevo reporte de impago.
 *     description: Recibe los detalles de un formulario de impago y los guarda en la base de datos, incluyendo los contactos del deudor.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id_boletinaje_grupo:
 *                 type: integer
 *                 description: "ID del grupo de boletinaje, obtenido del primer paso (cuestionario)."
 *                 example: 1
 *               nombre_empresa_deudora:
 *                 type: string
 *                 description: "Nombre o razón social de la empresa deudora."
 *                 example: "Deudores S.A. de C.V."
 *               rfc_deudor:
 *                 type: string
 *                 description: "RFC de la empresa deudora (opcional)."
 *                 example: "DEU880808DE8"
 *               nombre_representante_legal:
 *                 type: string
 *                 description: "Nombre del representante legal del deudor (opcional)."
 *                 example: "Juan Paga Tarde"
 *               monto_adeudo:
 *                 type: number
 *                 format: double
 *                 description: "Monto total del adeudo."
 *                 example: 50000.50
 *               id_cat_boletinaje_tipo_moneda:
 *                 type: integer
 *                 description: "ID del tipo de moneda (ej. 1: MXN, 2: USD)."
 *                 example: 1
 *               fecha_factura:
 *                 type: string
 *                 format: date
 *                 description: "Fecha de la factura principal en formato ISO 8601 (YYYY-MM-DD)."
 *                 example: "2024-04-01"
 *               folio_factura:
 *                 type: string
 *                 description: "Folio o número de la factura (opcional)."
 *                 example: "F-12345"
 *               id_cat_boletinaje_motivo_impago:
 *                 type: integer
 *                 description: "ID del motivo del impago."
 *                 example: 5
 *               comentarios_adicionales:
 *                 type: string
 *                 description: "Cualquier comentario adicional sobre el adeudo (opcional)."
 *                 example: "El cliente menciona que no tiene flujo para pagar."
 *               contactos_deudor:
 *                 type: array
 *                 description: "Lista de personas de contacto de la empresa deudora (opcional)."
 *                 items:
 *                   type: object
 *                   properties:
 *                     nombre_contacto:
 *                       type: string
 *                       example: "Ana Lisa"
 *                     cargo:
 *                       type: string
 *                       example: "Gerente de Finanzas"
 *                     telefono:
 *                       type: string
 *                       example: "5512345678"
 *                     correo_electronico:
 *                       type: string
 *                       format: email
 *                       example: "analisa@deudores.com"
 *     responses:
 *       201:
 *         description: Reporte de impago creado exitosamente.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     id_boletinaje_reporte_impago:
 *                       type: integer
 *                       description: "ID del nuevo reporte de impago creado."
 *                       example: 1
 *       400:
 *         description: Datos de entrada inválidos.
 *       500:
 *         description: Error interno del servidor.
 */
router.post('/impago', validationHandler(createReporteImpagoSchema), boletinajeController.guardarReporteImpago)

/**
 * @openapi
 * /api/boletinaje/impago/{id}:
 *   get:
 *     tags:
 *       - Boletinaje
 *     summary: Obtener un reporte de impago por ID
 *     description: Retorna los detalles de un reporte de impago específico.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: El ID del reporte de impago.
 *     responses:
 *       '200':
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/ReporteImpago'
 *       '404':
 *         description: Reporte no encontrado.
 */
router.get('/impago/:id', validationHandler(idParamsSchema, 'params'), boletinajeController.getReporteImpagoById)

/**
 * @swagger
 * /api/boletinaje/mis-reportes:
 *   get:
 *     tags:
 *       - Boletinaje
 *     summary: Obtiene los reportes de impago emitidos por mi empresa.
 *     description: Retorna una lista paginada de todos los reportes de impago que la empresa del usuario autenticado ha creado.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número de página para la paginación.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Número de resultados por página.
 *     responses:
 *       '200':
 *         description: Lista de reportes obtenida exitosamente.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedReportesImpago'
 *       '401':
 *         description: No autorizado.
 *       '500':
 *         description: Error interno del servidor.
 */
router.get(
  '/mis-reportes',
  validationHandler(paginationQuerySchema, 'query'),
  boletinajeController.getMisReportes
);

/**
 * @swagger
 * /api/boletinaje/reportes-sobre-mi:
 *   get:
 *     tags:
 *       - Boletinaje
 *     summary: Obtiene los reportes de impago emitidos sobre mi empresa.
 *     description: Retorna una lista paginada de todos los reportes de impago que otras empresas han creado sobre la empresa del usuario autenticado.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número de página para la paginación.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Número de resultados por página.
 *     responses:
 *       '200':
 *         description: Lista de reportes obtenida exitosamente.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedReportesImpago'
 *       '401':
 *         description: No autorizado.
 *       '500':
 *         description: Error interno del servidor.
 */
router.get(
  '/reportes-sobre-mi',
  validationHandler(paginationQuerySchema, 'query'),
  boletinajeController.getReportesSobreMi
);

/**
 * @openapi
 * /api/boletinaje/impago/{id}:
 *   put:
 *     tags:
 *       - Boletinaje
 *     summary: Actualizar un reporte de impago
 *     description: Actualiza parcialmente un reporte de impago. Solo se permite modificar el estatus y/o la configuración de notificaciones.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: El ID del reporte de impago a actualizar.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateReporteImpago'
 *     responses:
 *       '200':
 *         description: Reporte actualizado exitosamente.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/ReporteImpago'
 *       '400':
 *         description: Datos de entrada inválidos.
 *       '404':
 *         description: Reporte no encontrado.
 */
router.put('/impago/:id', validationHandler(idParamsSchema, 'params'), validationHandler(updateReporteImpagoSchema), boletinajeController.updateReporteImpago)

/**
 * @swagger
 * /api/boletinaje/notificacion-sin-impago:
 *   post:
 *     summary: Guarda una nueva notificación de tipo "Sin Impago".
 *     description: >
 *       Recibe los datos de una notificación que no está relacionada a una falta de pago.
 *       Se debe incluir el proveedor que notifica, el cliente notificado y un arreglo de
 *       los incidentes detectados.
 *     tags:
 *       - Boletinaje
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BoletinajeNotificacionSinImpago'
 *     responses:
 *       '201':
 *         description: Notificación guardada exitosamente.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/BoletinajeNotificacionSinImpagoDB'
 *                 message:
 *                   type: string
 *                   example: "Notificación sin impago guardada exitosamente."
 *       '400':
 *         description: Error de validación en los datos de entrada.
 *       '500':
 *         description: Error interno del servidor.
 */
router.post(
  '/notificacion-sin-impago',
  validationHandler(boletinajeSchema.notificacionSinImpago),
  boletinajeController.guardarNotificacionSinImpago
)

module.exports = router 