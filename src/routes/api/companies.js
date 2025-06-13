'use strict'

const express = require('express')
const { createOrRemoveFavorite, createCompany } = require('../../utils/schemas/companies')
const validation = require('../../utils/middlewares/validationHandler')
const router = express.Router()
const companiesController = require('../../controllers/api/companies')
const multerVideos = require('../../utils/multerVideos')
const authMiddleware = require('../../utils/middlewares/authMiddleware')
const decryptMiddleware = require('../../utils/middlewares/cipherMiddleware')

const { enviarInvitacionSimple } = require('../../controllers/api/solicitud-credito')

router.get('/actualizaListaContactos/', companiesController.actualizaListaContactos)
router.get('/getEval:id', companiesController.getEvalById)

router.get('/', companiesController.getCompanies)
router.post('/', companiesController.createCompany)
router.get('/favorites', companiesController.getFavoriteCompanies)
/**
 * @swagger
 * /api/companies/{id}:
 *   get:
 *     summary: Obtener información de una empresa por ID
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID de la empresa a consultar
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Información de la empresa obtenida con éxito
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: boolean
 *                   example: false
 *                 empresa:
 *                   type: object
 *                   properties:
 *                     emp_id:
 *                       type: integer
 *                       example: 66
 *                     cin_id:
 *                       type: integer
 *                       example: 1
 *                     emp_nombre:
 *                       type: string
 *                       example: "NIKE"
 *                     emp_razon_social:
 *                       type: string
 *                       example: "Petandmore"
 *                     denominacion:
 *                       type: string
 *                       example: "2"
 *                     emp_rfc:
 *                       type: string
 *                       example: "SA24751213"
 *                     emp_website:
 *                       type: string
 *                       example: "https://petmore.com"
 *                     emp_phone:
 *                       type: string
 *                       nullable: true
 *                       example: null
 *                     emp_logo:
 *                       type: string
 *                       example: "https://mycredibusinessbucketapp.s3.amazonaws.com/logoEmpresa/1zKsjM5kNHnXNnbSjfRtWq2nOcUEjCL0RCrPlCpppG1F.png"
 *                     emp_banner:
 *                       type: string
 *                       example: "https://mycredibusinessbucketapp.s3.amazonaws.com/bannerEmpresa/7Bs4AxRO6BRkr4ZK4SEQFg4hmKIgG4HJd3caAAwlnVtd.png"
 *                     emp_video:
 *                       type: string
 *                       example: "https://www.youtube.com/embed/DWQbLJXlSS4?si=S7CU1_EKHsJkBiNk"
 *                     emp_ventas_gob:
 *                       type: integer
 *                       example: 1
 *                     emp_ventas_credito:
 *                       type: integer
 *                       example: 1
 *                     emp_ventas_contado:
 *                       type: integer
 *                       example: 1
 *                     emp_loc:
 *                       type: integer
 *                       example: 1
 *                     emp_nac:
 *                       type: integer
 *                       example: 1
 *                     emp_int:
 *                       type: integer
 *                       example: 1
 *                     emp_exportacion:
 *                       type: integer
 *                       example: 1
 *                     emp_credito:
 *                       type: integer
 *                       example: 1
 *                     emp_certificada:
 *                       type: integer
 *                       example: 0
 *                     emp_empleados:
 *                       type: integer
 *                       example: 100
 *                     emp_status:
 *                       type: integer
 *                       example: 0
 *                     emp_fecha_fundacion:
 *                       type: string
 *                       nullable: true
 *                       example: null
 *                     emp_fecha_creacion:
 *                       type: string
 *                       format: date-time
 *                       example: "2020-10-22T22:49:25.000Z"
 *                     emp_update:
 *                       type: string
 *                       nullable: true
 *                       example: null
 *                     emp_marcas:
 *                       type: string
 *                       example: ""
 *                     valores:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           emp_id:
 *                             type: integer
 *                             example: 66
 *                           idioma_id:
 *                             type: integer
 *                             example: 1
 *                           emp_desc:
 *                             type: string
 *                             example: ""
 *                           emp_lema:
 *                             type: string
 *                             example: "Somos los mejores en limpieza"
 *                           emp_mision:
 *                             type: string
 *                             example: ""
 *                           emp_vision:
 *                             type: string
 *                             example: ""
 *                     anios_experiencia:
 *                       type: string
 *                       example: "2"
 *                     reg_active:
 *                       type: object
 *                       properties:
 *                         type:
 *                           type: string
 *                           example: "Buffer"
 *                         data:
 *                           type: array
 *                           items:
 *                             type: integer
 *                           example: [1]
 *                     proposito:
 *                       type: string
 *                       example: "tesr"
 *                     tipo:
 *                       type: string
 *                       example: "2"
 *                     cronos:
 *                       type: string
 *                       example: "true"
 *                     emp_valores:
 *                       type: string
 *                       example: "aaaaasas"
 *                     redes_sociales:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           nombre:
 *                             type: string
 *                             example: "Facebook"
 *                           enlace:
 *                             type: string
 *                             example: "http://facebook.com/ejemplo66"
 *                           icono:
 *                             type: string
 *                             example: "http://bucketparaiconoface.png"
 *                     direcciones:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           domicilio_id:
 *                             type: integer
 *                             example: 133
 *                           emp_id:
 *                             type: integer
 *                             example: 66
 *                           estado_id:
 *                             type: integer
 *                             example: 1
 *                           domicilio_tipo:
 *                             type: integer
 *                             example: 1
 *                           nombre:
 *                             type: string
 *                             example: "Prueba Narvarte"
 *                           direccion:
 *                             type: string
 *                             example: "Av. Principal #123"
 *                           google_id:
 *                             type: string
 *                             example: "123"
 *                           fecha_creacion:
 *                             type: string
 *                             format: date-time
 *                             example: "2024-03-12T18:53:55.000Z"
 *                           fecha_actualizacion:
 *                             type: string
 *                             nullable: true
 *                             example: "2024-07-04T19:42:59.000Z"
 *                           pais_id:
 *                             type: integer
 *                             example: 1
 *                           telefonos:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 telefono_id:
 *                                   type: integer
 *                                   example: 77
 *                                 domicilio_id:
 *                                   type: integer
 *                                   example: 133
 *                                 numero:
 *                                   type: string
 *                                   example: "7777777777"
 *                                 fecha_creacion:
 *                                   type: string
 *                                   format: date-time
 *                                   example: "2024-03-12T18:53:55.000Z"
 *                                 fecha_actualizacion:
 *                                   type: string
 *                                   nullable: true
 *                                   example: "2024-07-04T19:42:59.000Z"
 *                     horario:
 *                       type: object
 *                       properties:
 *                         horario_id:
 *                           type: integer
 *                           example: 15
 *                         emp_id:
 *                           type: integer
 *                           example: 66
 *                         lunes_apertura:
 *                           type: string
 *                           example: "09:00"
 *                         lunes_cierre:
 *                           type: string
 *                           example: "18:00"
 *                         martes_apertura:
 *                           type: string
 *                           example: "09:00"
 *                         martes_cierre:
 *                           type: string
 *                           example: "18:00"
 *                         miercoles_apertura:
 *                           type: string
 *                           example: "09:00"
 *                         miercoles_cierre:
 *                           type: string
 *                           example: "18:00"
 *                         jueves_apertura:
 *                           type: string
 *                           example: "09:00"
 *                         jueves_cierre:
 *                           type: string
 *                           example: "18:00"
 *                         viernes_apertura:
 *                           type: string
 *                           example: "09:00"
 *                         viernes_cierre:
 *                           type: string
 *                           example: "18:00"
 *                         sabado_apertura:
 *                           type: string
 *                           nullable: true
 *                           example: null
 *                         sabado_cierre:
 *                           type: string
 *                           nullable: true
 *                           example: null
 *                         domingo_apertura:
 *                           type: string
 *                           nullable: true
 *                           example: null
 *                         domingo_cierre:
 *                           type: string
 *                           nullable: true
 *                           example: null
 *                     fotos:
 *                       type: array
 *                       items:
 *                         type: object
 *                     empleados:
 *                       type: object
 *                       properties:
 *                         vendedores:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               usu_id:
 *                                 type: integer
 *                                 example: 170
 *                               usu_nombre:
 *                                 type: string
 *                                 example: "Abnner"
 *                               usu_app:
 *                                 type: string
 *                                 example: "Lira"
 *                               usu_puesto:
 *                                 type: string
 *                                 example: "Marketing Champion"
 *                               usu_email:
 *                                 type: string
 *                                 example: "abnner@puntocommerce.com"
 *                               usu_foto:
 *                                 type: string
 *                                 nullable: true
 *                                 example: null
 *                               usu_tipo:
 *                                 type: integer
 *                                 example: 1
 *                               usu_status:
 *                                 type: integer
 *                                 example: 1
 *                               usu_verificado:
 *                                 type: integer
 *                                 example: 1
 *                               ventasTotales:
 *                                 type: integer
 *                                 nullable: true
 *                                 example: null
 *                               posiblesVentas:
 *                                 type: integer
 *                                 nullable: true
 *                                 example: null
 *                         compradores:
 *                           type: array
 *                           items:
 *                             type: object
 *                         administradores:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               usu_id:
 *                                 type: integer
 *                                 example: 84
 *                               usu_nombre:
 *                                 type: string
 *                                 example: "Gabriel"
 *                               usu_app:
 *                                 type: string
 *                                 example: "Aguirre"
 *                               usu_email:
 *                                 type: string
 *                                 example: "gabriel@example.com"
 *                               usu_foto:
 *                                 type: string
 *                                 nullable: true
 *                                 example: null
 *                               usu_tipo:
 *                                 type: integer
 *                                 example: 2
 *                               usu_status:
 *                                 type: integer
 *                                 example: 1
 *                               usu_verificado:
 *                                 type: integer
 *                                 example: 1
 */
router.get('/:id', companiesController.getCompanyByID)


/**
 * Nuevo endpoit para consultar compañias
 */
router.get('/getCompanyById/:id', companiesController.getCompanyByIDV2)

// FIXME: Se debe eliminar el endpoint de abajo
// router.put('/:id', decryptMiddleware, /*authMiddleware,*/ companiesController.editCompany)
/**
 * @swagger
 * /api/companies/{id}:
 *   put:
 *     summary: Editar una empresa - Cifrado => [true]
 *     description: Actualiza la información de una empresa existente.
 *     tags:
 *      - Companies  
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID de la empresa a actualizar.
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id_usuario:
 *                 type: integer
 *                 example: 95
 *               industria:
 *                 type: integer
 *                 example: 1
 *               giro:
 *                 type: string
 *                 example: "ejemplo giro"
 *               nombre:
 *                 type: string
 *                 example: "Plataformas Digitales Punto Commerces"
 *               rfc:
 *                 type: string
 *                 example: "PLI830hfy6rcytrv517184"
 *               razon_social:
 *                 type: string
 *                 example: "S.A. DE C.V."
 *               denominacion:
 *                 type: string
 *                 example: "5"
 *               website:
 *                 type: string
 *                 example: "http://www.sabormex.com.mx/"
 *               banner:
 *                 type: string
 *                 example: "https://mycredibusinessbucketapp.s3.amazonaws.com/bannerEmpresa/7Bs4AxRO6BRkr4ZK4SEQFg4hmKIgG4HJd3caAAwlnVtd.png"
 *               ventas_gobierno:
 *                 type: integer
 *                 example: 1
 *               ventas_credito:
 *                 type: integer
 *                 example: 1
 *               ventas_contado:
 *                 type: integer
 *                 example: 1
 *               local:
 *                 type: integer
 *                 example: 1
 *               nacional:
 *                 type: integer
 *                 example: 1
 *               internacional:
 *                 type: integer
 *                 example: 1
 *               exportacion:
 *                 type: integer
 *                 example: 1
 *               credito:
 *                 type: integer
 *                 example: 1
 *               empleados:
 *                 type: integer
 *                 example: 1
 *               fundacion:
 *                 type: string
 *                 example: "2021-12-10 00:00:00"
 *               descripcion:
 *                 type: string
 *                 example: "Somos una agencia Full Commerce.\nPlaneamos y desarrollamos plataformas de venta onmicanal (Tienda online y Aplicaciones)\nAdemás de elaboración y ejecución de estrategias de Marketing Digital."
 *               lema:
 *                 type: string
 *                 example: ""
 *               mision:
 *                 type: string
 *                 example: "Acelerar a México en la economía digital"
 *               vision:
 *                 type: string
 *                 example: "Acelerar a México en la economía digital"
 *               marcas:
 *                 type: string
 *                 example: "macbook"
 *               tipo:
 *                 type: string
 *                 example: "1"
 *               proposito:
 *                 type: string
 *                 example: "Prpósito de la empresa"
 *     responses:
 *       200:
 *         description: Actualización exitosa de la empresa.
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
 *                     fieldCount:
 *                       type: integer
 *                       example: 0
 *                     affectedRows:
 *                       type: integer
 *                       example: 0
 *                     insertId:
 *                       type: integer
 *                       example: 0
 *                     info:
 *                       type: string
 *                       example: "Rows matched: 1  Changed: 0  Warnings: 1"
 *                     serverStatus:
 *                       type: integer
 *                       example: 2
 *                     warningStatus:
 *                       type: integer
 *                       example: 1
 *                     changedRows:
 *                       type: integer
 *                       example: 0
 *       404:
 *         description: Empresa no encontrada.
 *       400:
 *         description: Solicitud incorrecta.
 */
router.put('/:id', decryptMiddleware, companiesController.editCompany)


router.put('/:id', decryptMiddleware, /*authMiddleware,*/ companiesController.editCompany)
router.post('/:id/schedules', /*authMiddleware,*/ companiesController.createSchedule)
router.put('/:id/schedules', /*authMiddleware,*/ companiesController.editSchedule)
router.post('/:id/addresses', authMiddleware, companiesController.createAddress)
router.put('/:id/addresses/:address', authMiddleware, companiesController.editAddress)
router.delete('/:id/addresses', authMiddleware, companiesController.deleteAddress)
router.put('/:id/addresses/:address/corporate', authMiddleware, companiesController.setAddressAsMain)
router.post('/:id/addresses/:address/phones', authMiddleware, companiesController.createPhone)
router.delete('/:id/addresses/:address/phones', authMiddleware, companiesController.deletePhone)
router.put('/:id/addresses/:address/phones/:phone', authMiddleware, companiesController.editPhone)
router.get('/:id/users', authMiddleware, companiesController.getCompanyUsers)
router.post('/:id/users', authMiddleware, companiesController.sendInvitations)
router.put('/:id/users', authMiddleware, companiesController.setCompanyUsers)
router.get('/:id/users-invitations', authMiddleware, companiesController.getCompanyInvitations)
router.post('/:id/users-invitations', authMiddleware, companiesController.createCompanyInvitation)
router.delete('/:id/users-invitations', authMiddleware, companiesController.deleteCompanyInvitation)
router.put('/:id/users-invitations', authMiddleware, companiesController.editCompanyInvitation)
router.put('/:id/users-details', authMiddleware, companiesController.editCompanyUser)
router.get('/:id/products', authMiddleware, companiesController.getCompanyProducts)
router.get('/:companyID/events', authMiddleware, companiesController.getCompanyEvents)
router.post('/favorites', authMiddleware, validation(createOrRemoveFavorite), companiesController.createOrRemoveFavorite)
router.get('/:companyID/ratings', authMiddleware, companiesController.getCompanyRatings)
router.post('/:companyID/videos', /*authMiddleware,*/ companiesController.postCompanyVideo)
router.post('/addresses/createandupdate', authMiddleware, companiesController.createAndUpdateAdresses)

// Invitacion sin relación
router.post('/invitacion', enviarInvitacionSimple)

module.exports = router
