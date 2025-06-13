'use strict'

const express = require('express')
const router = express.Router()
const loginCtrl = require('../../controllers/api/auth')
const { notAllowUserToken, notAllowGenericToken } = require('../../utils/middlewares/globalAuth')
const decryptMiddleware = require('../../utils/middlewares/cipherMiddleware')

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Autenticación de Usuario - Cifrado => [true]
 *     description: Autentica a un usuario y devuelve un token de sesión junto con la información del usuario.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: test@test.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: 123456
 *             required:
 *               - email
 *               - password
 *     responses:
 *       200:
 *         description: Autenticación exitosa, se devuelve el token y la información del usuario.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 login:
 *                   type: object
 *                   properties:
 *                     valido:
 *                       type: integer
 *                       example: 1
 *                     error:
 *                       type: string
 *                       example: Datos correctos,
 *                     countLoguin:
 *                       type: integer
 *                       example: 7
 *                     cronos:
 *                       type: string
 *                       example: false
 *                     encuesta:
 *                       type: integer
 *                       example: 0
 *                     usu_token:
 *                       type: object
 *                       properties:
 *                         sessionToken:
 *                           type: string
 *                           example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJtY0lkIjozOTUsImdlbiI6ZmFsc2UsImdlblRva2VuIjpudWxsLCJsb2dpbklEIjoiNjBkMjBmMWMtYjM1NS00MzRhLWJkYmYtMWFlMDY3MzFkNzI3IiwiaWF0IjoxNzI2MTgzNjc3LCJleHAiOjE3MjYxODcyNzcsImlzcyI6Ind3dy5tYXJrZXRjaG9pY2ViMmIuY29tIiwianRpIjoiZTE3NGVhZWUtZDUxNS00MGQ3LWEyYTMtZTFlYzAyMjdiMDBkIn0.oFMh_m2hIrTz_MGN7iHU-_oadV0dG49zOrf_HGQivV8
 *                         refreshToken:
 *                           type: string
 *                           example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJtY0lkIjozOTUsImdlbiI6ZmFsc2UsImdlblRva2VuIjpudWxsLCJsb2dpbklEIjoiNjBkMjBmMWMtYjM1NS00MzRhLWJkYmYtMWFlMDY3MzFkNzI3IiwiaWF0IjoxNzI2MTgzNjc3LCJleHAiOjE3MjYyNzAwNzcsImlzcyI6Ind3dy5tYXJrZXRjaG9pY2ViMmIuY29tIiwianRpIjoiYTI5ZTUyNWQtMTgyYS00YTFiLWEyOGItNWVmNGNjNzA0ODE5In0.Tl0-l_DK410tAogFvqBCbUCViZ202CXlp_5wNP8Ka-M
 *                     usu:
 *                       type: object
 *                       properties:
 *                         tipo:
 *                           type: integer
 *                           example: 1
 *                         emp_id:
 *                           type: integer
 *                           example: 369
 *                         emp_certificada:
 *                           type: integer
 *                           example: 0
 *                         usu_id:
 *                           type: integer
 *                           example: 395
 *                         usu_nombre:
 *                           type: string
 *                           example: AABB801010111
 *                         usu_app:
 *                           type: string
 *                           example: .
 *                         usu_puesto:
 *                           type: string
 *                           nullable: true
 *                           example: null
 *                         usu_email:
 *                           type: string
 *                           format: email
 *                           example: test@test.com
 *                         usu_psw:
 *                           type: string
 *                           example: $2b$10$84TYrHePxuNBaxZOpPUiBOrKnTlcE4Sh2ROiTOtd4zUqptrpH4HRe
 *                         usu_boletin:
 *                           type: integer
 *                           example: 1
 *                         usu_verificado:
 *                           type: integer
 *                           example: 0
 *                         usu_idioma:
 *                           type: integer
 *                           example: 1
 *                         usu_foto:
 *                           type: string
 *                           nullable: true
 *                           example: null
 *                         usu_card:
 *                           type: string
 *                           nullable: true
 *                           example: null
 *                         usu_tipo:
 *                           type: integer
 *                           example: 4
 *                         usu_status:
 *                           type: integer
 *                           example: 1
 *                         usu_update:
 *                           type: string
 *                           nullable: true
 *                           example: null
 *                         token:
 *                           type: string
 *                           example: 758616
 *                         login_contador:
 *                           type: integer
 *                           example: 6
 *                         estatus_registro:
 *                           type: string
 *                           example: noconfirmado
 *                         reg_active:
 *                           type: object
 *                           properties:
 *                             type:
 *                               type: string
 *                               example: Buffer
 *                             data:
 *                               type: array
 *                               items:
 *                                 type: integer
 *                               example: [1]
 *                         created_at:
 *                           type: string
 *                           format: date-time
 *                           example: 2024-06-05T00:52:03.000Z
 *                         estatus_certificacion:
 *                           type: string
 *                           example: La empresa del usuario no cuenta con certificacion
 *                         permisos:
 *                           type: array
 *                           items:
 *                             type: string
 *                           example: []
 *       400:
 *         description: Error en la solicitud
 *       401:
 *         description: Credenciales inválidas
 *       500:
 *         description: Error interno del servidor
 */
router.post('/login', notAllowUserToken(), decryptMiddleware, loginCtrl.authUser)

router.post('/refresh', notAllowUserToken(), loginCtrl.refreshToken)

router.post('/renewToken', notAllowUserToken(), loginCtrl.renewToken)

router.delete('/logout', notAllowGenericToken(), loginCtrl.logoutUser)

/**
 * @swagger
 * /api/auth/addModulo:
 *   post:
 *     summary: Agrega un nuevo módulo
 *     description: Este endpoint permite agregar un nuevo módulo a la base de datos.
 *     tags:
 *       - Permisos
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *                 description: Nombre del módulo que se desea agregar.
 *                 example: "Gestión de Usuarios"
 *     responses:
 *       200:
 *         description: Módulo agregado exitosamente.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: boolean
 *                   description: Indica si hubo un error en la operación.
 *                   example: false
 *                 results:
 *                   type: object
 *                   properties:
 *                     modulo_insertado:
 *                       type: object
 *                       properties:
 *                         insertId:
 *                           type: integer
 *                           description: ID del módulo insertado.
 *                           example: 16
 *                         affectedRows:
 *                           type: integer
 *                           description: Número de filas afectadas por la operación.
 *                           example: 1
 *       400:
 *         description: Solicitud inválida.
 *       500:
 *         description: Error interno del servidor.
 */
router.post('/addModulo', loginCtrl.addModulo)

/**
 * @swagger
 * /api/auth/addSubModulo:
 *   post:
 *     summary: Agrega un nuevo submódulo
 *     description: Este endpoint permite agregar un nuevo submódulo a un módulo existente en la base de datos.
 *     tags:
 *       - Permisos
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *                 description: Nombre del submódulo que se desea agregar.
 *                 example: "Agregar Usuario"
 *               id_modulo:
 *                 type: integer
 *                 description: ID del módulo al que pertenece el submódulo.
 *                 example: 1
 *     responses:
 *       200:
 *         description: Submódulo agregado exitosamente.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: boolean
 *                   description: Indica si hubo un error en la operación.
 *                   example: false
 *                 results:
 *                   type: object
 *                   properties:
 *                     submodulo_insertado:
 *                       type: object
 *                       properties:
 *                         insertId:
 *                           type: integer
 *                           description: ID del submódulo insertado.
 *                           example: 1
 *                         affectedRows:
 *                           type: integer
 *                           description: Número de filas afectadas por la operación.
 *                           example: 1
 *       400:
 *         description: Solicitud inválida.
 *       500:
 *         description: Error interno del servidor.
 */
router.post('/addSubModulo', loginCtrl.addSubModulo)

 /**
 * @swagger
 * /api/auth/addComponente:
 *   post:
 *     summary: Agrega un nuevo componente
 *     description: Este endpoint permite agregar un nuevo componente a la base de datos.
 *     tags:
 *       - Permisos
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *                 description: Nombre del componente que se desea agregar.
 *                 example: "Campo de Nombre"
 *               id_submodulo:
 *                 type: integer
 *                 description: ID del submódulo al que pertenece el nuevo componente.
 *                 example: 44
 *     responses:
 *       200:
 *         description: Componente agregado exitosamente.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: boolean
 *                   description: Indica si hubo un error en la operación.
 *                   example: false
 *                 results:
 *                   type: object
 *                   properties:
 *                     componente_insertado:
 *                       type: object
 *                       properties:
 *                         insertId:
 *                           type: integer
 *                           description: ID del componente insertado.
 *                           example: 1
 *                         affectedRows:
 *                           type: integer
 *                           description: Número de filas afectadas por la operación.
 *                           example: 1
 *       400:
 *         description: Solicitud inválida.
 *       500:
 *         description: Error interno del servidor.
 */
router.post('/addComponente', loginCtrl.addComponente)

/**
 * @swagger
 * /api/auth/addSubComponente:
 *   post:
 *     summary: Agrega un nuevo subcomponente
 *     description: Este endpoint permite agregar un nuevo subcomponente a la base de datos.
 *     tags:
 *       - Permisos
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *                 description: Nombre del subcomponente que se desea agregar.
 *                 example: "Campo de Nombre"
 *               id_componente:
 *                 type: integer
 *                 description: ID del componente al que pertenece el nuevo subcomponente.
 *                 example: 45
 *     responses:
 *       200:
 *         description: Subcomponente agregado exitosamente.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: boolean
 *                   description: Indica si hubo un error en la operación.
 *                   example: false
 *                 results:
 *                   type: object
 *                   properties:
 *                     subcomponente_insertado:
 *                       type: object
 *                       properties:
 *                         insertId:
 *                           type: integer
 *                           description: ID del subcomponente insertado.
 *                           example: 1
 *                         affectedRows:
 *                           type: integer
 *                           description: Número de filas afectadas por la operación.
 *                           example: 1
 *       400:
 *         description: Solicitud inválida.
 *       500:
 *         description: Error interno del servidor.
 */
router.post('/addSubComponente', loginCtrl.addSubComponente)

/**
 * @swagger
 * /api/auth/addRol:
 *   post:
 *     summary: Agrega un nuevo rol
 *     description: Este endpoint permite agregar un nuevo rol a la base de datos.
 *     tags:
 *       - Permisos
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *                 description: Nombre del rol que se desea agregar.
 *                 example: "Administrador"
 *     responses:
 *       200:
 *         description: Rol agregado exitosamente.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: boolean
 *                   description: Indica si hubo un error en la operación.
 *                   example: false
 *                 results:
 *                   type: object
 *                   properties:
 *                     rol_insertado:
 *                       type: object
 *                       properties:
 *                         insertId:
 *                           type: integer
 *                           description: ID del rol insertado.
 *                           example: 4
 *                         affectedRows:
 *                           type: integer
 *                           description: Número de filas afectadas por la operación.
 *                           example: 1
 *       400:
 *         description: Solicitud inválida.
 *       500:
 *         description: Error interno del servidor.
 */
router.post('/addRol', loginCtrl.addRol)

/**
 * @swagger
 * /api/auth/addRolPermiso:
 *   post:
 *     summary: Asigna permisos a un rol
 *     description: Este endpoint permite asignar permisos específicos a un rol en la aplicación.
 *     tags:
 *       - Permisos
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id_rol:
 *                 type: integer
 *                 description: ID del rol al que se le asignarán los permisos.
 *                 example: 1
 *               id_modulo:
 *                 type: integer
 *                 description: ID del módulo al que se asigna el permiso.
 *                 example: 1
 *               id_submodulo:
 *                 type: integer
 *                 nullable: true
 *                 description: ID del submódulo al que se asigna el permiso (puede ser nulo).
 *                 example: null
 *               id_componente:
 *                 type: integer
 *                 nullable: true
 *                 description: ID del componente al que se asigna el permiso (puede ser nulo).
 *                 example: null
 *               id_subcomponente:
 *                 type: integer
 *                 nullable: true
 *                 description: ID del subcomponente al que se asigna el permiso (puede ser nulo).
 *                 example: null
 *               acceso:
 *                 type: string
 *                 description: Indica si el rol tiene acceso ('si' o 'no').
 *                 example: "si"
 *     responses:
 *       200:
 *         description: Permiso asignado exitosamente.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: boolean
 *                   description: Indica si hubo un error en la operación.
 *                   example: false
 *                 results:
 *                   type: object
 *                   properties:
 *                     rol_permiso_insertado:
 *                       type: object
 *                       properties:
 *                         insertId:
 *                           type: integer
 *                           description: ID del permiso insertado.
 *                           example: 1
 *                         affectedRows:
 *                           type: integer
 *                           description: Número de filas afectadas por la operación.
 *                           example: 1
 *       400:
 *         description: Solicitud inválida.
 *       500:
 *         description: Error interno del servidor.
 */
router.post('/addRolPermiso', loginCtrl.addRolPermiso)

/**
 * @swagger
 * /api/auth/getPermisos/{id_rol}:
 *   get:
 *     summary: "Obtener permisos de un rol"
 *     description: "Este endpoint devuelve los permisos asociados a un rol específico."
 *     tags:
 *       - Permisos
 *     parameters:
 *       - name: id_rol
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: "ID del rol para el cual se desean obtener los permisos."
 *     responses:
 *       200:
 *         description: "Permisos obtenidos correctamente."
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
 *                     rol:
 *                       type: object
 *                       properties:
 *                         id_rol:
 *                           type: string
 *                           example: "1"
 *                         nombre_rol:
 *                           type: string
 *                           example: "Administrador"
 *                     permisos:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           acceso:
 *                             type: string
 *                             example: "si"
 *                           componente:
 *                             type: object
 *                             properties:
 *                               id_componente:
 *                                 type: integer
 *                                 example: 1
 *                               nombre_componente:
 *                                 type: string
 *                                 example: "Idioma"
 *                           # Asegúrate de repetir la estructura de permisos para otros ejemplos
 *       404:
 *         description: "Rol no encontrado."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "No se encontró el rol."
 *       500:
 *         description: "Error interno del servidor."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Error al obtener permisos."
 */
router.get('/getPermisos/:id_rol', loginCtrl.getPermisos)

router.post('/encuestaLogin', loginCtrl.encuestaLogin)

router.get('/catMeGustaria', loginCtrl.catMeGustaria)
router.get('/catClientesCredito', loginCtrl.catClientesCredito)
router.get('/catRangoVentas', loginCtrl.catRangoVentas)

router.put('/setTrueCronos/:id_empresa', loginCtrl.setTrueCronos)

router.get('/catalogoCreditoClientes', loginCtrl.catalogoCreditoClientes)

router.post('/testCipher', loginCtrl.testCipher)

router.post('/caso1', async (req, res, next) => res.json({ msg: 'Soy un caso 1 y el Lalo se la come. Acepto tokens genericos y de sesion.' }))
router.post('/caso2', notAllowGenericToken(), async (req, res, next) => res.json({ msg: 'Soy un caso 2 y el Joel se la come. Acepto tokens de sesión unicamente.' }))
router.post('/caso3', notAllowUserToken(), async (req, res, next) => res.json({ msg: 'Soy un caso 3 y el Martín se la come. Acepto tokens genericos unicamente.' }))

module.exports = router
