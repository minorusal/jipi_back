'use strict'

const express = require('express')
const validation = require('../../utils/middlewares/validationHandler')
const { updateUserSchema, requestChangePassword, changePassword, requestCodeResend } = require('../../utils/schemas/users')
const multerStorage = require('../../utils/multerStorage')
const userController = require('../../controllers/api/usuarios')
const authMiddleware = require('../../utils/middlewares/authMiddleware')
const decryptMiddleware = require('../../utils/middlewares/cipherMiddleware')
const router = express.Router()

router.get('/', /*authMiddleware,*/ userController.getUsers)
router.get('/:userId', /*authMiddleware,*/ userController.getUserById)
router.get('/verificarActualizacion/:userId', /*authMiddleware,*/ userController.getLastUpdate)
router.post('/', /*authMiddleware,*/ userController.createUser)
router.post('/verificar/reenviar', /*authMiddleware,*/ validation(requestCodeResend), userController.verifyReSend)
router.post('/verificar', /*authMiddleware,*/ userController.verify)
router.put('/:userID', /*authMiddleware,*/ /*validation(updateUserSchema), multerStorage('usu_foto'),*/ userController.updateUser)
router.post('/registro-caducidad', /*authMiddleware,*/ userController.verifyInvitation)
router.post('/request-password', /*authMiddleware,*/ validation(requestChangePassword), userController.requestChangePassword)
router.post('/change-password/:token', /*authMiddleware,*/ /*validation(changePassword),*/ userController.changePassword)
router.put('/admins/:usrId', /*authMiddleware,*/ userController.usr2Admin)
router.get('/byId/:userId', /*authMiddleware,*/ userController.getOneUserById)

/**
 * @swagger
 * /api/usuarios/registerWithInvitation:
 *   post:
 *     summary: Registra un usuario y envía una invitación por correo electrónico - Cifrado => [true]
 *     description: Este endpoint permite registrar un usuario y enviar una invitación por correo electrónico.
 *     operationId: registerWithInvitation
 *     tags:
 *       - Multiusuarios
 *     consumes:
 *       - application/json
 *     parameters:
 *       - in: body
 *         name: body
 *         description: Datos del usuario a registrar y enviar invitación.
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             nombre_usuario:
 *               type: string
 *               example: "Minoru"
 *             apellido_usuario:
 *               type: string
 *               example: "Minoru"
 *             email:
 *               type: string
 *               example: "minoru.salazar@gmail.com"
 *             id_usuario:
 *               type: integer
 *               example: 123
 *             id_empresa:
 *               type: integer
 *               example: 83
 *             id_rol:
 *               type: integer
 *               example: 2
 *     responses:
 *       200:
 *         description: Usuario registrado exitosamente y correo de invitación enviado.
 *         schema:
 *           type: object
 *           properties:
 *             error:
 *               type: boolean
 *               example: false
 *             results:
 *               type: object
 *               properties:
 *                 usuario:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       usu_id:
 *                         type: integer
 *                         example: 551
 *                       usu_nombre:
 *                         type: string
 *                         example: ""
 *                       usu_app:
 *                         type: string
 *                         example: ""
 *                       usu_email:
 *                         type: string
 *                         example: "minoru.salazar@gmail.com"
 *                       usu_foto:
 *                         type: string
 *                         nullable: true
 *                         example: null
 *                       usu_tipo:
 *                         type: integer
 *                         example: 2
 *                       nombre_rol:
 *                         type: string
 *                         example: "Proveedor"
 *       400:
 *         description: Solicitud inválida. Los parámetros proporcionados no son válidos.
 *       500:
 *         escription: Error en el servidor al procesar la solicitud.
 */

router.post('/registerWithInvitation', decryptMiddleware, userController.registerWithInvitation);


/**
 * @swagger
 * /api/usuarios/byIdCompanie/{id_companie}:
 *   get:
 *     summary: Obtener usuarios por ID de compañía - Cifrado => [true]
 *     description: Retorna una lista de usuarios pertenecientes a una compañía específica identificada por su ID.
 *     tags:
 *       - Multiusuarios   # Aquí asignamos la ruta al módulo "Multiusuarios"
 *     parameters:
 *       - name: id_companie
 *         in: path
 *         description: ID de la compañía para la cual se desea obtener los usuarios.
 *         required: true
 *         schema:
 *           type: integer
 *           example: 83
 *     responses:
 *       200:
 *         description: Lista de usuarios en la compañía con el ID proporcionado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: boolean
 *                   description: Indica si hubo un error o no en la consulta.
 *                   example: false
 *                 results:
 *                   type: object
 *                   properties:
 *                     usuarios:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           usu_id:
 *                             type: integer
 *                             description: ID del usuario.
 *                             example: 101
 *                           usu_nombre:
 *                             type: string
 *                             description: Nombre del usuario.
 *                             example: "Daniela"
 *                           usu_app:
 *                             type: string
 *                             description: Apellido del usuario.
 *                             example: "Ochoa"
 *                           usu_email:
 *                             type: string
 *                             description: Correo electrónico del usuario.
 *                             example: "qa_usu1@credibusiness.com"
 *                           usu_foto:
 *                             type: string
 *                             description: URL de la foto del usuario. Puede ser nula.
 *                             example: "https://mycredibusinessbucketapp.s3.amazonaws.com/userImage/5GvSYzhdyL2QjUYozbBVJ23hxbpuZ5gmdrO6V10slKxk.png"
 *                           usu_tipo:
 *                             type: integer
 *                             description: Tipo del usuario (1=Administrador, 2=Proveedor, 3=Cliente, etc.).
 *                             example: 1
 *                           nombre_rol:
 *                             type: string
 *                             description: Nombre del rol del usuario. Puede ser nulo si no se asigna rol.
 *                             example: "Administrador"
 *         400:
 *           description: Solicitud incorrecta. Verifique el formato o los parámetros.
 *         404:
 *           description: No se encontraron usuarios para la compañía especificada.
 *         500:
 *           description: Error interno del servidor.
 */
router.get('/byIdCompanie/:id_companie', /*authMiddleware,*/ userController.getUsersByIdCompanie)

router.get('/getPermisos/:userId', /*authMiddleware,*/ userController.getPermisosByUserId);
router.get('/catalogo/getPermisos', /*authMiddleware,*/ userController.getPermisos);
router.post('/createPerfilPermisos', /*authMiddleware,*/ userController.createPerfilPermisos);
router.get('/getPerfilesPermisosByEmpresa/:emp_id', /*authMiddleware,*/ userController.getPerfilesPermisosByEmpresa);
router.put('/updatePermisos/:userId', /*authMiddleware,*/ userController.updatePermisos);
router.put('/updatePerfilPermisos/:id', /*authMiddleware,*/ userController.updatePerfilPermisos);

module.exports = router
