const express = require('express')
const router = express.Router()

const authMiddleware = require('../../utils/middlewares/authMiddleware')

const criptMiddleware = require('../../utils/middlewares/cipherMiddleware')

const {
    asignarCodigos,
    getCodigos,
    consultarCreditos,
    agregarCreditos,
    actualizarCreditos,
    reintegrarCredito,
    restarCreditos,
    consultarListaEnviadas,
    consultarListaRecibidas,
    enviarInvitacion,
    enviarInvitacionSimple,
    reenviarSolicitudCredito,
    reenviarSolicitudCreditoInterna
} = require('../../controllers/api/solicitud-credito')

// router.post('/', consultarCreditos )

router.get('/saldo/:idEmpresa', consultarCreditos)
router.post('/agregar', agregarCreditos)
router.post('/actualizar', actualizarCreditos)
router.post('/reintegrar', reintegrarCredito)
router.post('/restar', restarCreditos)

/**
 * @swagger
 * tags:
 *   - name: Promociones
 *     description: API para gestión de códigos de promociones
 * 
 * /api/solicitud-credito/getCodigos/{idEmpresa}:
 *   get:
 *     summary: Obtener los códigos de promoción asociados a una empresa - Cifrado => [true]
 *     description: Este endpoint devuelve todos los códigos de promociones para una empresa específica utilizando el `idEmpresa` proporcionado.
 *     tags:
 *       - Promociones
 *     parameters:
 *       - name: idEmpresa
 *         in: path
 *         description: ID de la empresa para la cual se obtendrán los códigos de promoción
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Respuesta exitosa con los códigos de promoción
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: boolean
 *                   example: false
 *                 codigos_promociones:
 *                   type: object
 *                   properties:
 *                     result:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id_codigo:
 *                             type: integer
 *                             example: 1
 *                           codigo:
 *                             type: string
 *                             example: "XEPELIN2025"
 *                           id_empresa:
 *                             type: integer
 *                             example: 530
 *                           valor:
 *                             type: integer
 *                             example: 10
 *                           valor_vigente:
 *                             type: integer
 *                             example: 8
 *                           fecha_asignacion:
 *                             type: string
 *                             format: date-time
 *                             example: "2025-01-12T00:38:45.000Z"
 *                           vigencia_inicial:
 *                             type: string
 *                             format: date-time
 *                             example: "2025-01-11T00:00:00.000Z"
 *                           vigencia_final:
 *                             type: string
 *                             format: date-time
 *                             example: "2025-02-15T00:00:00.000Z"
 *                           dias_vigencia:
 *                             type: integer
 *                             example: 15
 *                           dias_restantes:
 *                             type: integer
 *                             example: 11
 *                           estatus:
 *                             type: string
 *                             example: "activo"
 *       400:
 *         description: Solicitud incorrecta, falta parámetros necesarios
 *       404:
 *         description: Empresa no encontrada o no existen códigos de promoción asociados
 *       500:
 *         description: Error en el servidor
 */
router.get('/getCodigos/:idEmpresa', getCodigos)

/**
 * @swagger
 * tags:
 *   - name: Promociones
 *     description: API para gestión de códigos de promociones
 * 
 * /api/solicitud-credito/asignar_codigo:
 *   post:
 *     summary: Asignar un código de promoción a una empresa - Cifrado => [true]
 *     description: Este endpoint permite asignar un código de promoción a una empresa específica para un producto determinado.
 *     tags:
 *       - Promociones
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id_empresa:
 *                 type: integer
 *                 description: ID de la empresa a la que se asignará el código de promoción
 *                 example: 530
 *               id_producto:
 *                 type: integer
 *                 description: ID del producto asociado con el código de promoción
 *                 example: 1
 *               codigo_promocion:
 *                 type: string
 *                 description: El código de promoción a asignar
 *                 example: "PRUEBANUEVO"
 *     responses:
 *       200:
 *         description: Registro exitoso del código de promoción para la empresa y producto
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Registro correcto"
 *       400:
 *         description: Solicitud incorrecta, faltan parámetros o valores inválidos
 *       404:
 *         description: Empresa o producto no encontrado
 *       500:
 *         description: Error en el servidor
 */
router.post('/asignar_codigo', criptMiddleware, asignarCodigos)

router.get('/enviadas/:idEmpresa/', consultarListaEnviadas)
router.get('/recibidas/:idEmpresa', consultarListaRecibidas)

router.post('/invitacion', enviarInvitacion)
router.post('/reenviar-solicitud', reenviarSolicitudCredito)
router.post('/reenviar-solicitud-interna', reenviarSolicitudCreditoInterna);


module.exports = router
