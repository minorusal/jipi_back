'use strict'

const express = require('express')
const router = express.Router()

const certificationController = require('../../controllers/api/certification')
const multerGuardarPDF = require('../../utils/multerPdf')
const authMiddleware = require('../../utils/middlewares/authMiddleware') 

const { createCertification, payCertification, certificateMyCompanyForTest } = require('../../utils/schemas/certification')
const validation = require('../../utils/middlewares/validationHandler')
const decryptMiddleware = require('../../utils/middlewares/cipherMiddleware')

router.post('/', decryptMiddleware, authMiddleware, certificationController.postCertification)
router.post('/documentosCertificacion',decryptMiddleware, authMiddleware, certificationController.uploadDocuments)
router.get('/infoCertificacion/:idEmpresa/:idSeccion', authMiddleware, certificationController.getCertificationByCompany)
router.get('/data', certificationController.getCertificationContries)

router.post('/payment', decryptMiddleware, authMiddleware, validation(payCertification), certificationController.payCertification)

// TODO: Eliminar estas rutas de prueba
router.post('/certificar', authMiddleware, validation(certificateMyCompanyForTest), certificationController.certificateMyCompanyForTest)

router.post('/certificar-reset', authMiddleware, certificationController.resetCertificationsForTest)

// Certificacion V3
/**
 * @swagger
 * /api/certification/iniciaCertificacion:
 *   post:
 *     summary: Iniciar Certificación
 *     description: Inicia el proceso de certificación para una empresa cliente.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id_empresa:
 *                 type: integer
 *                 example: 453
 *               id_usuario:
 *                 type: string
 *                 example: "478"
 *               id_pais:
 *                 type: integer
 *                 example: 15
 *               id_estado:
 *                 type: integer
 *                 example: 1
 *               tipo_direccion:
 *                 type: integer
 *                 example: 3
 *               razon_social:
 *                 type: string
 *                 example: "Floricultores"
 *               denominacion:
 *                 type: integer
 *                 example: 103
 *               rfc:
 *                 type: string
 *                 example: "FLUD831130FH7"
 *               nrp:
 *                 type: string
 *                 example: "123456789"
 *               direccion_fiscal:
 *                 type: object
 *                 properties:
 *                   calle:
 *                     type: string
 *                     example: "Calle Bugambilia"
 *                   numero:
 *                     type: string
 *                     example: "84350"
 *                   ciudad:
 *                     type: string
 *                     example: "Obregon"
 *                   estado:
 *                     type: string
 *                     example: "Tamaulipas"
 *                   codigo_postal:
 *                     type: string
 *                     example: "74856"
 *                   pais:
 *                     type: string
 *                     example: "11"
 *               industria_id:
 *                 type: integer
 *                 example: 27
 *               id_cat_sector_riesgo_sectorial:
 *                 type: integer
 *                 example: 41
 *               id_cat_sector_clientes_finales:
 *                 type: integer
 *                 example: 5
 *               plantilla_laboral:
 *                 type: integer
 *                 example: 777
 *               gobierno:
 *                 type: string
 *                 example: "no"
 *               pagina_web:
 *                 type: string
 *                 example: "https://qa.credibusiness.io/"
 *               id_cat_tiempo_actividad_comercial:
 *                 type: integer
 *                 example: 1
 *               accionistas:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     razon_social:
 *                       type: string
 *                       example: "Tierra Fertil"
 *                     denominacion:
 *                       type: integer
 *                       example: 101
 *                     rfc:
 *                       type: string
 *                       example: "TIF123456789"
 *                     controlante:
 *                       type: integer
 *                       description: |
 *                         Indica si el accionista es la empresa controlante.
 *                         Valores posibles:
 *                         • 1 = es la controlante
 *                         • 0 = no lo es
 *                       example: 1
 *                     conteo_error_rfc:
 *                       type: integer
 *                       description: Conteo de intentos fallidos de validación de RFC del accionista controlante
 *                       example: 0
 *               empresas:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     razon_social:
 *                       type: string
 *                       example: "Floricultores S.A. de C.V."
 *                     pais:
 *                       type: string
 *                       example: "México"
 *               incidencias_legales:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     tipo:
 *                       type: string
 *                       example: "Ninguna"
 *                     fecha:
 *                       type: string
 *                       format: date
 *                       example: "2024-01-01"
 *                     demandante:
 *                       type: string
 *                       example: "N/A"
 *                     comentarios:
 *                       type: string
 *                       example: "No hay incidencias legales registradas."
 *               _69b:
 *                 type: string
 *                 example: "some_value"
 *               representante_legal:
 *                 type: string
 *                 example: "Juan Pérez"
 *               denominacion_social:
 *                 type: integer
 *                 example: 103
 *               empresas_relacionadas:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     razon_social:
 *                       type: string
 *                       example: "Empresa Relacionada S.A. de C.V."
 *                     pais:
 *                       type: string
 *                       example: "México"
 *               principales_directores:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     nombre:
 *                       type: string
 *                       example: "María López"
 *                     denominacion:
 *                       type: string
 *                       example: "DP"
 *                     puesto:
 *                       type: integer
 *                       example: 1
 *                     poder:
 *                       type: integer
 *                       example: 1
 *               estructura_personal:
 *                 type: object
 *                 properties:
 *                   personal_operativo:
 *                     type: string
 *                     example: "200"
 *                   personal_administrativo:
 *                     type: string
 *                     example: "50"
 *                   personal_directivo:
 *                     type: string
 *                     example: "10"
 *               equipo_transporte:
 *                 type: object
 *                 properties:
 *                   flotilla_transporte_carga_transporte_especializado:
 *                     type: string
 *                     example: "5"
 *                   flotilla_otros_vehiculos:
 *                     type: string
 *                     example: "10"
 *               seguros:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     nombre_aseguradora:
 *                       type: string
 *                       example: "Aseguradora XYZ"
 *                     bien_asegurado:
 *                       type: integer
 *                       example: 1
 *     responses:
 *       200:
 *         description: Certificación iniciada correctamente.
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
 *                     created:
 *                       type: boolean
 *                       example: true
 *                     certification:
 *                       type: object
 *                       properties:
 *                         id_certification:
 *                           type: integer
 *                           example: 1540
 *                         # ... include other properties as needed
 */
router.post('/iniciaCertificacion', /*decryptMiddleware, authMiddleware,*/ certificationController.iniciaCertificacion)

/**
 * @swagger
 * /api/certification/guardaPartidasFinancieras:
 *   post:
 *     summary: Guarda Partidas Financieras
 *     description: Guarda las partidas financieras relacionadas a una certificación.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id_certification:
 *                 type: integer
 *                 example: 1452
 *               compartir:
 *                 type: string
 *                 example: "si"
 *               id_tipo_cifra:
 *                 type: integer
 *                 example: 1
 *               periodo_actual:
 *                 type: string
 *                 example: "2024"
 *               periodo_anterior:
 *                 type: string
 *                 example: "2023"
 *               periodo_previo_anterior:
 *                 type: string
 *                 example: "2022"
 *               partida_estado_balance_periodo_contable_anterior:
 *                 type: object
 *                 properties:
 *                   caja_bancos:
 *                     type: number
 *                     example: 2500000.00
 *                   saldo_cliente_cuenta_x_cobrar:
 *                     type: number
 *                     example: 3000000.00
 *                   saldo_inventarios:
 *                     type: number
 *                     example: 4000000.00
 *                   deuda_corto_plazo:
 *                     type: number
 *                     example: 1500000.00
 *                   deuda_total:
 *                     type: number
 *                     example: 3000000.00
 *                   capital_contable:
 *                     type: number
 *                     example: 5000000.00
 *                   deudores_diversos:
 *                     type: number
 *                     example: 1000000.00
 *                   otros_activos:
 *                     type: number
 *                     example: 800000.00
 *                   total_activo_circulante:
 *                     type: number
 *                     example: 9500000.00
 *                   total_activo_fijo:
 *                     type: number
 *                     example: 10000000.00
 *                   activo_intangible:
 *                     type: number
 *                     example: 2000000.00
 *                   activo_diferido:
 *                     type: number
 *                     example: 1500000.00
 *                   total_otros_activos:
 *                     type: number
 *                     example: 3500000.00
 *                   activo_total:
 *                     type: number
 *                     example: 19500000.00
 *                   proveedores:
 *                     type: number
 *                     example: 1200000.00
 *                   acreedores:
 *                     type: number
 *                     example: 1000000.00
 *                   impuestos_x_pagar:
 *                     type: number
 *                     example: 800000.00
 *                   otros_pasivos:
 *                     type: number
 *                     example: 500000.00
 *                   total_pasivo_largo_plazo:
 *                     type: number
 *                     example: 2500000.00
 *                   pasivo_diferido:
 *                     type: number
 *                     example: 600000.00
 *                   capital_social:
 *                     type: number
 *                     example: 3000000.00
 *                   resultado_ejercicios_anteriores:
 *                     type: number
 *                     example: 1000000.00
 *                   resultado_ejercicios:
 *                     type: number
 *                     example: 800000.00
 *                   otro_capital:
 *                     type: number
 *                     example: 700000.00
 *               partida_estado_balance_periodo_contable_previo_anterior:
 *                 type: object
 *                 properties:
 *                   caja_bancos:
 *                     type: number
 *                     example: 2000000.00
 *                   saldo_cliente_cuenta_x_cobrar:
 *                     type: number
 *                     example: 2800000.00
 *                   saldo_inventarios:
 *                     type: number
 *                     example: 3800000.00
 *                   deuda_corto_plazo:
 *                     type: number
 *                     example: 1300000.00
 *                   deuda_total:
 *                     type: number
 *                     example: 2900000.00
 *                   capital_contable:
 *                     type: number
 *                     example: 4800000.00
 *                   deudores_diversos:
 *                     type: number
 *                     example: 900000.00
 *                   otros_activos:
 *                     type: number
 *                     example: 750000.00
 *                   total_activo_circulante:
 *                     type: number
 *                     example: 9100000.00
 *                   total_activo_fijo:
 *                     type: number
 *                     example: 9500000.00
 *                   activo_intangible:
 *                     type: number
 *                     example: 1800000.00
 *                   activo_diferido:
 *                     type: number
 *                     example: 1400000.00
 *                   total_otros_activos:
 *                     type: number
 *                     example: 3500000.00
 *                   activo_total:
 *                     type: number
 *                     example: 19500000.00
 *                   proveedores:
 *                     type: number
 *                     example: 1100000.00
 *                   acreedores:
 *                     type: number
 *                     example: 950000.00
 *                   impuestos_x_pagar:
 *                     type: number
 *                     example: 750000.00
 *                   otros_pasivos:
 *                     type: number
 *                     example: 600000.00
 *                   total_pasivo_largo_plazo:
 *                     type: number
 *                     example: 2400000.00
 *                   pasivo_diferido:
 *                     type: number
 *                     example: 500000.00
 *                   capital_social:
 *                     type: number
 *                     example: 2900000.00
 *                   resultado_ejercicios_anteriores:
 *                     type: number
 *                     example: 900000.00
 *                   resultado_ejercicios:
 *                     type: number
 *                     example: 750000.00
 *                   otro_capital:
 *                     type: number
 *                     example: 600000.00
 *               partida_estado_resultado_periodo_contable_previo_anterior:
 *                 type: object
 *                 properties:
 *                   ventas_anuales:
 *                     type: number
 *                     example: 15000000.00
 *                   costo_ventas_anuales:
 *                     type: number
 *                     example: 8000000.00
 *                   utilidad_operativa:
 *                     type: number
 *                     example: 5000000.00
 *                   utilidad_bruta:
 *                     type: number
 *                     example: 7000000.00
 *                   gastos_administracion:
 *                     type: number
 *                     example: 2000000.00
 *                   gastos_productos_financieros:
 *                     type: number
 *                     example: 500000.00
 *                   depreciacion_amortizacion:
 *                     type: number
 *                     example: 1000000.00
 *                   otros_ingresos:
 *                     type: number
 *                     example: 300000.00
 *                   otros_egresos:
 *                     type: number
 *                     example: 200000.00
 *                   otros_gastos:
 *                     type: number
 *                     example: 400000.00
 *                   utilidad_neta:
 *                     type: number
 *                     example: 3500000.00
 *               partida_estado_resultado_periodo_contable_anterior:
 *                 type: object
 *                 properties:
 *                   ventas_anuales:
 *                     type: number
 *                     example: 14000000.00
 *                   costo_ventas_anuales:
 *                     type: number
 *                     example: 7000000.00
 *                   utilidad_operativa:
 *                     type: number
 *                     example: 4800000.00
 *                   utilidad_bruta:
 *                     type: number
 *                     example: 7200000.00
 *                   gastos_administracion:
 *                     type: number
 *                     example: 1900000.00
 *                   gastos_productos_financieros:
 *                     type: number
 *                     example: 400000.00
 *                   depreciacion_amortizacion:
 *                     type: number
 *                     example: 900000.00
 *                   otros_ingresos:
 *                     type: number
 *                     example: 250000.00
 *                   otros_egresos:
 *                     type: number
 *                     example: 150000.00
 *                   otros_gastos:
 *                     type: number
 *                     example: 350000.00
 *                   utilidad_neta:
 *                     type: number
 *                     example: 3200000.00
 *             required:
 *               - id_certification
 *               - compartir
 *               - id_tipo_cifra
 *               - periodo_actual
 *               - periodo_anterior
 *               - periodo_previo_anterior
 *               - partida_estado_balance_periodo_contable_anterior
 *               - partida_estado_balance_periodo_contable_previo_anterior
 *               - partida_estado_resultado_periodo_contable_previo_anterior
 *               - partida_estado_resultado_periodo_contable_anterior
 *     responses:
 *       '200':
 *         description: Partidas Financieras guardadas exitosamente
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
 *                     created:
 *                       type: boolean
 *                       example: true
 *                     partidasFinancieras:
 *                       type: object
 *                       properties:
 *                         id_certification:
 *                           type: integer
 *                           example: 1452
 *                         compartir:
 *                           type: string
 *                           example: "si"
 *                         id_tipo_cifra:
 *                           type: integer
 *                           example: 1
 *                         periodo_actual:
 *                           type: string
 *                           example: "2024"
 *                         periodo_anterior:
 *                           type: string
 *                           example: "2023"
 *                         periodo_previo_anterior:
 *                           type: string
 *                           example: "2022"
 *                         # ... (Incluir aquí las mismas propiedades que en el payload de respuesta)
 */
router.post('/guardaPartidasFinancieras', /*decryptMiddleware, authMiddleware,*/ certificationController.guardaPartidasFinancieras)

/**
 * @swagger
 * /api/certificacion/guardaMercadoObjetivo:
 *   post:
 *     summary: Guardar Mercado Objetivo
 *     description: Guarda la información relacionada con el mercado objetivo de una certificación.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id_certification:
 *                 type: integer
 *                 example: 1452
 *               principales_clientes:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     razon_social:
 *                       type: string
 *                       example: "razon social ejemplo"
 *                     denominacion:
 *                       type: string
 *                       example: "sa de cv"
 *                     anios_relacion:
 *                       type: integer
 *                       example: 5
 *                     pais:
 *                       type: integer
 *                       example: 1
 *                     sector:
 *                       type: integer
 *                       example: 2
 *               estructuras_ventas:
 *                 type: object
 *                 properties:
 *                   porcentaje_credito_total_ventas:
 *                     type: integer
 *                     example: 30
 *                   porcentaje_contado_total_ventas:
 *                     type: integer
 *                     example: 30
 *                   porcentaje_ventas_gobierno:
 *                     type: integer
 *                     example: 40
 *               importaciones:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     pais:
 *                       type: integer
 *                       example: 1
 *                     porcentaje:
 *                       type: integer
 *                       example: 100
 *               exportaciones:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     pais:
 *                       type: integer
 *                       example: 1
 *                     porcentaje:
 *                       type: integer
 *                       example: 100
 *             required:
 *               - id_certification
 *               - principales_clientes
 *               - estructuras_ventas
 *               - importaciones
 *               - exportaciones
 *     responses:
 *       '200':
 *         description: Información del mercado objetivo guardada exitosamente.
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
 *                     created:
 *                       type: boolean
 *                       example: true
 *                     mercadoObjetivo:
 *                       type: object
 *                       properties:
 *                         id_certification:
 *                           type: integer
 *                           example: 1452
 *                         principales_clientes:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               razon_social:
 *                                 type: string
 *                                 example: "razon social ejemplo"
 *                               denominacion:
 *                                 type: string
 *                                 example: "sa de cv"
 *                               anios_relacion:
 *                                 type: integer
 *                                 example: 5
 *                               pais:
 *                                 type: integer
 *                                 example: 1
 *                               sector:
 *                                 type: integer
 *                                 example: 2
 *                         estructuras_ventas:
 *                           type: object
 *                           properties:
 *                             porcentaje_credito_total_ventas:
 *                               type: integer
 *                               example: 30
 *                             porcentaje_contado_total_ventas:
 *                               type: integer
 *                               example: 30
 *                             porcentaje_ventas_gobierno:
 *                               type: integer
 *                               example: 40
 *                         importaciones:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               pais:
 *                                 type: integer
 *                                 example: 1
 *                               porcentaje:
 *                                 type: integer
 *                                 example: 100
 *                         exportaciones:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               pais:
 *                                 type: integer
 *                                 example: 1
 *                               porcentaje:
 *                                 type: integer
 *                                 example: 100
 */
router.post('/guardaMercadoObjetivo', /*decryptMiddleware, authMiddleware,*/ certificationController.guardaMercadoObjetivo)

/**
 * @swagger
 * /api/certificacion/guardaReferenciasComerciales:
 *   post:
 *     summary: Guarda Referencias Comerciales
 *     description: Permite guardar las referencias comerciales asociadas a una certificación.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id_certification:
 *                 type: integer
 *                 example: 1540
 *               id_empresa:
 *                 type: integer
 *                 example: 68
 *               referencias_comerciales:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     razon_social:
 *                       type: string
 *                       example: "Comercializadora XYZ S.A. de C.V."
 *                     denominacion:
 *                       type: string
 *                       example: "201"
 *                     rfc:
 *                       type: string
 *                       example: "CXY123456789"
 *                     codigo_postal:
 *                       type: string
 *                       example: "01234"
 *                     id_pais:
 *                       type: integer
 *                       example: 1
 *                     contactos:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           nombre_contacto:
 *                             type: string
 *                             example: "Juan Pérez"
 *                           correo_contacto:
 *                             type: string
 *                             example: "minorusal@hotmail.com"
 *                           telefono_contacto:
 *                             type: string
 *                             example: "5551234567"
 *                     empresa_cliente:
 *                       type: object
 *                       properties:
 *                         calificacion_referencia:
 *                           type: string
 *                           example: "AA"
 *                         porcentaje_deuda:
 *                           type: integer
 *                           example: 15
 *                         dias_atraso:
 *                           type: integer
 *                           example: 5
 *                         linea_credito:
 *                           type: number
 *                           format: double
 *                           example: 500000
 *                         plazo:
 *                           type: integer
 *                           example: 30
 *             required:
 *               - id_certification
 *               - id_empresa
 *               - referencias_comerciales
 *     responses:
 *       '200':
 *         description: Referencias comerciales guardadas exitosamente.
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
 *                     created:
 *                       type: boolean
 *                       example: true
 *                     partidasFinancieras:
 *                       type: object
 *                       properties:
 *                         id_certification:
 *                           type: integer
 *                           example: 1540
 *                         id_empresa:
 *                           type: integer
 *                           example: 68
 *                         referencias_comerciales:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               razon_social:
 *                                 type: string
 *                                 example: "Comercializadora XYZ S.A. de C.V."
 *                               denominacion:
 *                                 type: string
 *                                 example: "201"
 *                               rfc:
 *                                 type: string
 *                                 example: "CXY123456789"
 *                               codigo_postal:
 *                                 type: string
 *                                 example: "01234"
 *                               id_pais:
 *                                 type: integer
 *                                 example: 1
 *                               contactos:
 *                                 type: array
 *                                 items:
 *                                   type: object
 *                                   properties:
 *                                     nombre_contacto:
 *                                       type: string
 *                                       example: "Juan Pérez"
 *                                     correo_contacto:
 *                                       type: string
 *                                       example: "minorusal@hotmail.com"
 *                                     telefono_contacto:
 *                                       type: string
 *                                       example: "5551234567"
 *                               empresa_cliente:
 *                                 type: object
 *                                 properties:
 *                                   calificacion_referencia:
 *                                     type: string
 *                                     example: "AA"
 *                                   porcentaje_deuda:
 *                                     type: integer
 *                                     example: 15
 *                                   dias_atraso:
 *                                     type: integer
 *                                     example: 5
 *                                   linea_credito:
 *                                     type: number
 *                                     format: double
 *                                     example: 500000
 *                                   plazo:
 *                                     type: integer
 *                                     example: 30
 */
router.post('/guardaReferenciasComerciales', /*decryptMiddleware, authMiddleware,*/ certificationController.guardaReferenciasComerciales);

/**
 * @swagger
 * /api/companies/getReferenciaComercialForm/{id_certification}:
 *   get:
 *     summary: "Obtener referencia comercial por ID de certificación"
 *     description: "Recupera los detalles de una referencia comercial asociada a un ID de certificación específico."
 *     parameters:
 *       - name: id_certification
 *         in: path
 *         required: true
 *         description: "ID de certificación de la referencia comercial"
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: "Detalles de la referencia comercial"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id_certification:
 *                   type: string
 *                   example: "1540"
 *                 referencias_comerciales:
 *                   type: object
 *                   properties:
 *                     id_certification_referencia_comercial:
 *                       type: integer
 *                       example: 8785
 *                     razon_social:
 *                       type: string
 *                       example: "refe dos"
 *                     denominacion:
 *                       type: integer
 *                       example: 1
 *                     rfc:
 *                       type: string
 *                       example: "yetryvkbln"
 *                     codigo_postal:
 *                       type: string
 *                       example: "74856"
 *                     contactos:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id_certification_contacto:
 *                             type: integer
 *                             example: 9165
 *                           id_certification_referencia_comercial:
 *                             type: integer
 *                             example: 8785
 *                           nombre_contacto:
 *                             type: string
 *                             example: "Carlos Gómez"
 *                           correo_contacto:
 *                             type: string
 *                             example: "carlos.gomez@abc.com"
 *                           telefono_contacto:
 *                             type: string
 *                             example: "5556543210"
 *                           estatus:
 *                             type: string
 *                             example: "enviado"
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *                             example: "2024-10-04T17:39:24.000Z"
 *                           updated_at:
 *                             type: string
 *                             format: date-time
 *                             example: "2024-10-04T17:39:24.000Z"
 *                     empresa_cliente:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id_empresa_cliente_contacto:
 *                             type: integer
 *                             example: 2
 *                           id_referencia_comercial:
 *                             type: integer
 *                             example: 8785
 *                           razon_social:
 *                             type: string
 *                             example: "urytvubhn"
 *                           denominacion:
 *                             type: integer
 *                             example: 1
 *                           rfc:
 *                             type: string
 *                             example: "yetryvkbln"
 *                           calificacion_referencia:
 *                             type: string
 *                             example: "bueno"
 *                           moneda:
 *                             type: string
 *                             example: "1"
 *                           porcentaje_deuda:
 *                             type: integer
 *                             example: 15
 *                           dias_atraso:
 *                             type: integer
 *                             example: 0
 *                           linea_credito:
 *                             type: string
 *                             example: "1000000.00"
 *                           plazo:
 *                             type: integer
 *                             example: 120
 *                           fecha_otorgamiento_linea_credito:
 *                             type: string
 *                             format: date
 *                             example: "2020-10-10"
 *                           monto_saldo_vigente_linea_credito:
 *                             type: string
 *                             example: "99999.99"
 *                           monto_saldo_vencido_linea_credito:
 *                             type: string
 *                             example: "0.00"
 *                           antiguedad_relacion:
 *                             type: string
 *                             example: "23"
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *                             example: "2024-10-04T19:03:25.000Z"
 *                           updated_at:
 *                             type: string
 *                             format: date-time
 *                             example: "2024-10-04T19:11:21.000Z"
 *       '400':
 *         description: "Solicitud inválida"
 *       '404':
 *         description: "Certificación no encontrada"
 *       '500':
 *         description: "Error interno del servidor"
 */
router.get('/getReferenciaComercialForm/:id_certification', certificationController.getReferenciaComercialForm)

// Certification catalogos
router.get('/getIndustria', /*authMiddleware,*/ certificationController.getIndustria)
router.get('/getPaisAlgoritmo', /*authMiddleware,*/ certificationController.getPaisAlgoritmo)
router.get('/getSectorRiesgoSectorialAlgoritmo', /*authMiddleware,*/ certificationController.getSectorRiesgoSectorialAlgoritmo)
router.get('/getSectorClientesFinalesAlgoritmo', /*authMiddleware,*/ certificationController.getSectorClientesFinalesAlgoritmo)
router.get('/getTiempoActividadComercialAlgoritmo', /*authMiddleware,*/ certificationController.getTiempoActividadComercialAlgoritmo)

// Certification partidas financieras catalogos
router.get('/getTipoCifrasAlgoritmo', /*authMiddleware,*/ certificationController.getTipoCifrasAlgoritmo)
router.post('/getResultAlgoritmo', /*decryptMiddleware, authMiddleware,*/ certificationController.getAlgoritmoResult)
router.post('/generaReporteInformativoCredito', /*decryptMiddleware, authMiddleware,*/ certificationController.generaReporteInformativoCredito)

/**
 * @swagger
 * /api/certification/validacionBloc:
 *   post:
 *     tags:
 *       - Certificación
 *     summary: Realiza la validación de un bloque basado en nombre, apellido y RFC.
 *     description: Este endpoint permite validar la existencia de incidencias para un RFC, retornando la información relacionada.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *                 description: El nombre de la entidad o persona.
 *                 example: "A& J EXPORTACIONES SADECV"
 *               apellido:
 *                 type: string
 *                 description: El apellido de la entidad o persona (puede estar vacío).
 *                 example: ""
 *               rfc:
 *                 type: string
 *                 description: El RFC que se valida.
 *                 example: "AAA100303L51"
 *     responses:
 *       200:
 *         description: Respuesta exitosa con el resultado de la validación.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sin_incidencias:
 *                   type: boolean
 *                   description: Indica si no se encontraron incidencias.
 *                   example: false
 *                 message:
 *                   type: string
 *                   description: Mensaje de la respuesta.
 *                   example: "RFC con problemas"
 *                 asunto:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       importadoresExportadores:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             rfc:
 *                               type: string
 *                               description: El RFC relacionado a la incidencia.
 *                               example: "&JE040614N51"
 *                             nombre:
 *                               type: string
 *                               description: El nombre asociado a la incidencia.
 *                               example: "A& J EXPORTACIONES SADECV"
 *       400:
 *         description: Error de validación en el RFC o en los datos proporcionados.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   description: Descripción del error.
 *                   example: "Faltan campos obligatorios o formato incorrecto."
 */
router.post('/validacionBloc', /*decryptMiddleware, authMiddleware,*/ certificationController.validacionBloc)

/**
 * @swagger
 * /api/certification/consultaBlocEmpresaControlante:
 *   get:
 *     tags:
 *       - Certificación
 *     summary: Consulta BLOC para empresa controlante
 *     description: Actúa como proxy hacia los servicios de BLOC para obtener información de SAT 69-B, OFAC, concursos mercantiles y proveedores/contratistas boletinados por gobierno.
 *     parameters:
 *       - in: query
 *         name: nombre
 *         required: true
 *         schema:
 *           type: string
 *         description: Nombre de la empresa controlante
 *       - in: query
 *         name: apellido
 *         required: false
 *         schema:
 *           type: string
 *         description: Apellido o denominación complementaria
 *     responses:
 *       200:
 *         description: Respuesta con la información de los servicios BLOC
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 bloc_sat69b:
 *                   type: object
 *                 bloc_ofac:
 *                   type: object
 *                 bloc_concursos_mercantiles:
 *                   type: object
 *                 bloc_proveedores_contratistas:
 *                   type: object
 */
router.get('/consultaBlocEmpresaControlante', /*decryptMiddleware, authMiddleware,*/ certificationController.consultaBlocEmpresaControlante)

/**
 * @swagger
 * /api/certification/consultaBloc/{idEmpresa}:
 *   get:
 *     tags:
 *       - Certificación
 *     summary: Consultar bloques relacionados con la certificación de una empresa
 *     description: Obtiene los datos de diferentes bloques asociados a una certificación de empresa.
 *     parameters:
 *       - in: path
 *         name: idEmpresa
 *         required: true
 *         description: ID de la empresa para la cual se va a consultar la certificación.
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Datos obtenidos exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Data fetched successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     bloc_concursos_mercantiles:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                             example: 1
 *                           id_certificacion:
 *                             type: integer
 *                             example: 1
 *                           dato:
 *                             type: string
 *                             example: "Distribuidora de Impresos, S. de R. L. de C. V."
 *                           comerciante:
 *                             type: string
 *                             example: "Distribuidora de Impresos, S. de R. L. de C. V."
 *                           solicitante:
 *                             type: string
 *                             example: "Mismo"
 *                           iniciativa:
 *                             type: string
 *                             example: "Solicitud"
 *                           expediente:
 *                             type: string
 *                             example: "316/2014"
 *                           juzgado:
 *                             type: string
 *                             example: "Juzgado 9° de Distrito en Materia Civil en la Ciudad de México"
 *                           circuito:
 *                             type: string
 *                             example: "0"
 *                           localidad:
 *                             type: string
 *                             example: "Ciudad de México"
 *                           status_mer:
 *                             type: string
 *                             example: "Quiebra"
 *                           especialista:
 *                             type: string
 *                             example: "Estrella Menéndez Enrique"
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *                             example: "2025-02-19T00:55:52.000Z"
 *                           updated_at:
 *                             type: string
 *                             format: date-time
 *                             example: "2025-02-19T00:55:52.000Z"
 *                     bloc_importadores_exportadores:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                             example: 1
 *                           id_certificacion:
 *                             type: integer
 *                             example: 1
 *                           rfc:
 *                             type: string
 *                             example: "&JE040614N51"
 *                           nombre:
 *                             type: string
 *                             example: "A& J EXPORTACIONES SADECV"
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *                             example: "2025-02-19T01:29:46.000Z"
 *                           updated_at:
 *                             type: string
 *                             format: date-time
 *                             example: "2025-02-19T01:29:46.000Z"
 *                     bloc_lista_69_incumplidos:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                             example: 1
 *                           id_certificacion:
 *                             type: integer
 *                             example: 1
 *                           rfc:
 *                             type: string
 *                             example: "AAJA860917G86"
 *                           razon_social:
 *                             type: string
 *                             example: "AARON ADAN ALANIS JIMENEZ"
 *                           tipo_persona:
 *                             type: string
 *                             example: "FÍSICA"
 *                           posicion:
 *                             type: string
 *                             example: "CANCELADOS POR INCOSTEABILIDAD"
 *                           fecha_publicaion:
 *                             type: string
 *                             example: "30/06/2023"
 *                           monto:
 *                             type: string
 *                             example: "$426"
 *                           fecha_monto:
 *                             type: string
 *                             example: "20/07/2023"
 *                           estado:
 *                             type: string
 *                             example: "MEXICO"
 *                           motivo:
 *                             type: string
 *                             example: ""
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *                             example: "2025-02-19T01:22:40.000Z"
 *                           updated_at:
 *                             type: string
 *                             format: date-time
 *                             example: "2025-02-19T01:22:40.000Z"
 *                     bloc_ofac:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                             example: 1
 *                           id_certificacion:
 *                             type: integer
 *                             example: 1
 *                           nombre:
 *                             type: string
 *                             example: "SECOND ACADEMY OF NATURAL SCIENCES; Type: ; Program: NPWMD; ; ; ; ; ; ; ; Secondary sanctions risk: North Korea Sanctions Regulations, sections 510.201 and 510.210; Transactions Prohibited For Persons Owned or Controlled By U.S. Financial Institutions: North Korea Sanctions Regulations section 510.214."
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *                             example: "2025-02-19T00:47:45.000Z"
 *                           updated_at:
 *                             type: string
 *                             format: date-time
 *                             example: "2025-02-19T00:47:45.000Z"
 *                     bloc_proveedores_contratistas:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                             example: 1
 *                           id_certificacion:
 *                             type: integer
 *                             example: 1
 *                           provedor_contratista:
 *                             type: string
 *                             example: "A Y M CONSTRUCTORA, S.A. DE C.V."
 *                           multa:
 *                             type: string
 *                             example: "72,540.00"
 *                           expediente:
 *                             type: string
 *                             example: "0121/2006"
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *                             example: "2025-02-19T01:07:10.000Z"
 *                           updated_at:
 *                             type: string
 *                             format: date-time
 *                             example: "2025-02-19T01:07:10.000Z"
 *                     bloc_sat69b:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                             example: 1
 *                           id_certification:
 *                             type: integer
 *                             example: 1
 *                           rfc:
 *                             type: string
 *                             example: "AAA100303L51"
 *                           contribuyente:
 *                             type: string
 *                             example: "INGENIOS SANTOS, S.A. DE C.V."
 *                           situacion:
 *                             type: string
 *                             example: "Desvirtuado"
 *                           num_fecha_og_presuncion:
 *                             type: string
 *                             example: "500-05-2017-38736 de fecha 01 de diciembre de 2017"
 *                           publicacion_presuntos:
 *                             type: string
 *                             example: "01/12/2017"
 *                           dof_presuntos:
 *                             type: string
 *                             example: "500-05-2017-38736 de fecha 01 de diciembre de 2017"
 *                           publicacion_desvirtuados:
 *                             type: string
 *                             example: "26/09/2018"
 *                           num_fecha_og_desvirtuados:
 *                             type: string
 *                             example: "500-05-2018-27096 de fecha 25 de septiembre de 2018"
 *                           dof_desvirtuados:
 *                             type: string
 *                             example: "500-05-2018-27096 de fecha 25 de septiembre de 2018"
 *                           num_fecha_og_definitivos:
 *                             type: string
 *                             example: ""
 *                           publicacion_definitivos:
 *                             type: string
 *                             example: null
 *                           dof_definitivos:
 *                             type: string
 *                             example: ""
 *                           num_fecha_og_sentenciafavorable:
 *                             type: string
 *                             example: ""
 *                           publicacion_sentenciafavorable:
 *                             type: string
 *                             example: null
 *                           dof_sentenciafavorable:
 *                             type: string
 *                             example: ""
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *                             example: "2025-02-19T00:36:38.000Z"
 *                           updated_at:
 *                             type: string
 *                             format: date-time
 *                             example: "2025-02-19T00:36:38.000Z"
 *       400:
 *         description: Parámetro no válido o error en la consulta
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Bad request"
 */
router.get('/consultaBloc/:idEmpresa', /*decryptMiddleware, authMiddleware,*/ certificationController.consultaBloc)
router.get('/checkInfoAlgoritmo/:id_certification', /*decryptMiddleware, authMiddleware,*/ certificationController.checkInfoAlgoritmo)

router.get('/getPais/:tipo', /*authMiddleware,*/ certificationController.getPais)
router.get('/getDenominaciones', certificationController.getDenominaciones)
router.get('/getPuestos', certificationController.getPuestos)
router.get('/getPoderes', certificationController.getPoderes)
router.get('/getBienesAsegurados', certificationController.getBienesAsegurados)

// Actualización de formularios
router.put('/updateCertificacion', /*decryptMiddleware, authMiddleware,*/ certificationController.updateCertificacion)
router.put('/updatePartidasFinancieras', /*decryptMiddleware, authMiddleware,*/ certificationController.updatePartidasFinancieras)
router.put('/updateReferenciasComerciales', /*decryptMiddleware, authMiddleware,*/ certificationController.updateReferenciasComerciales)

router.get('/getCertification/:idEmpresa', /*authMiddleware,*/ certificationController.getCertification)
router.get('/getCertificationStatus/:idEmpresa', /*authMiddleware,*/ certificationController.getCertificationStatus)

router.post('/uploadDocumentoCertificacion', /*authMiddleware,*/ /*multerPublication(),*/ certificationController.uploadDocumento)
router.get('/consultaDocumento/:id_empresa', /*authMiddleware,*/ certificationController.consultaDocumento)
router.put('/updateDocumento', /*authMiddleware,*/ certificationController.updateDocumento)
router.delete('/deleteDocumento', /*authMiddleware,*/ certificationController.deleteDocumento)

router.post('/consultaCronos', /*authMiddleware,*/ /*multerPublication(),*/ certificationController.consultaCronos)
router.put('/setStatusCertification', /*authMiddleware,*/ /*multerPublication(),*/ certificationController.setStatusCertification)

// Download logs
router.post('/downloadLogs', certificationController.downloadLogs) 

router.get('/informacionContacto/:id_contacto', certificationController.getInformacionContacto)

/**
 * @swagger
 * /api/certificacion/updateInformacionContacto:
 *   put:
 *     summary: Actualiza Información de Contacto
 *     description: Permite actualizar la información de contacto de una certificación.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id_certification:
 *                 type: integer
 *                 example: 2294
 *               hash:
 *                 type: string
 *                 example: "2JOMCRD02O7VIRQ2CSOJ"
 *               recibir_emails:
 *                 type: boolean
 *                 example: true
 *               ip_cliente:
 *                 type: string
 *                 example: "127.0.0.1"
 *               datos_contacto:
 *                 type: object
 *                 properties:
 *                   id_contacto:
 *                     type: integer
 *                     example: 9451
 *                   nombre_contacto:
 *                     type: string
 *                     example: "jesus"
 *                   correo_contacto:
 *                     type: string
 *                     example: "jesus.lagunas@credibusiness.com"
 *               datos_empresa_contacto:
 *                 type: object
 *                 properties:
 *                   id_referencia:
 *                     type: integer
 *                     example: 8785
 *                   razon_social:
 *                     type: string
 *                     example: "jesus"
 *                   denominacion:
 *                     type: integer
 *                     example: 4
 *                   rfc:
 *                     type: string
 *                     example: "123422"
 *                   direccion_fiscal:
 *                     type: object
 *                     properties:
 *                       id_direccion:
 *                         type: integer
 *                         example: 2395
 *                       calle:
 *                         type: string
 *                         example: "dsfdsfsfdsfds"
 *                       numero:
 *                         type: string
 *                         example: "25"
 *                       ciudad:
 *                         type: string
 *                         example: "Toluca"
 *                       estado:
 *                         type: string
 *                         example: "Mexico"
 *                       codigo_postal:
 *                         type: string
 *                         example: "57200"
 *                       pais:
 *                         type: integer
 *                         example: 11
 *               datos_cliente:
 *                 type: object
 *                 properties:
 *                   id_empresa_cliente_contacto:
 *                     type: integer
 *                     example: 363
 *                   razon_social:
 *                     type: string
 *                     example: "Hugo"
 *                   denominacion:
 *                     type: integer
 *                     example: 11
 *                   fecha_inscripcion_sat:
 *                     type: string
 *                     format: date
 *                     example: "2023-04-01"
 *                   rfc:
 *                     type: string
 *                     example: "NWM230501"
 *                   homoclave:
 *                     type: string
 *                     example: "4W4"
 *                   moneda:
 *                     type: string
 *                     example: "MXN"
 *                   email:
 *                     type: string
 *                     example: "jesus.lagunas@credibusiness.com"
 *                   linea_credito_otorgada:
 *                     type: number
 *                     example: 50000
 *                   plazo_credito_dso:
 *                     type: number
 *                     example: 210
 *                   fecha_otorgamiento_linea_credito:
 *                     type: string
 *                     format: date
 *                     example: "2025-02-13"
 *                   saldo_vigente_linea_credito:
 *                     type: number
 *                     example: 99999
 *                   saldo_vencido_linea_credito:
 *                     type: number
 *                     example: 10000
 *                   dias_atraso:
 *                     type: number
 *                     example: 10
 *                   resultado_experiencia_pagos:
 *                     type: string
 *                     example: "buena"
 *                   antiguedad_relacion:
 *                     type: string
 *                     example: "10"
 *             required:
 *               - id_certification
 *               - hash
 *               - recibir_emails
 *               - datos_contacto
 *               - datos_empresa_contacto
 *               - datos_cliente
 *     responses:
 *       '200':
 *         description: Información de contacto actualizada exitosamente.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: boolean
 *                   example: false
 *                 result:
 *                   type: string
 *                   example: "OK"
 */
router.put('/updateInformacionContacto', certificationController.updateInformacionContacto)

/**
 * @swagger
 * /api/certification/getInfoContactoReferido/{id_contacto}:
 *   get:
 *     summary: "Obtener información de contacto referido por ID"
 *     description: "Recupera los detalles de un contacto referido utilizando su ID."
 *     parameters:
 *       - name: id_contacto
 *         in: path
 *         required: true
 *         description: "ID del contacto referido"
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: "Información del contacto referido"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: boolean
 *                   example: false
 *                 reult:
 *                   type: object
 *                   properties:
 *                     id_certification:
 *                       type: integer
 *                       example: 1576
 *                     recibir_emails:
 *                       type: boolean
 *                       example: true
 *                     datos_contacto:
 *                       type: object
 *                       properties:
 *                         id_contacto:
 *                           type: string
 *                           example: "9187"
 *                         nombre_contacto:
 *                           type: string
 *                           example: "Nombre del representante"
 *                         correo_contacto:
 *                           type: string
 *                           example: "emailreferido@empresa.com"
 *                     datos_empresa_contacto:
 *                       type: object
 *                       properties:
 *                         id_referencia:
 *                           type: integer
 *                           example: 8806
 *                         razon_social:
 *                           type: string
 *                           example: "dsads"
 *                         denominacion:
 *                           type: integer
 *                           example: 7
 *                         rfc:
 *                           type: string
 *                           example: "sdadsad"
 *                         homoclave:
 *                           type: string
 *                           example: "23dd"
 *                         direccion_fiscal:
 *                           type: object
 *                           properties:
 *                             id_direccion:
 *                               type: integer
 *                               example: 1337
 *                             calle:
 *                               type: string
 *                               example: "Calle Bugambilia"
 *                             numero:
 *                               type: string
 *                               example: "84350"
 *                             ciudad:
 *                               type: string
 *                               example: "Obregon"
 *                             estado:
 *                               type: string
 *                               example: "Tamaulipas"
 *                             codigo_postal:
 *                               type: string
 *                               example: "74856"
 *                             pais:
 *                               type: integer
 *                               example: 11
 *                     datos_cliente:
 *                       type: object
 *                       properties:
 *                         id_empresa_cliente_contacto:
 *                           type: integer
 *                           example: 23
 *                         razon_social:
 *                           type: string
 *                           example: "asdsdadsa"
 *                         denominacion:
 *                           type: integer
 *                           example: 1
 *                         rfc:
 *                           type: string
 *                           example: ""
 *                         calificacion_referencia:
 *                           type: string
 *                           example: "bueno"
 *                         email:
 *                           type: string
 *                           example: "email@email.com"
 *                         moneda:
 *                           type: string
 *                           example: "1"
 *                         linea_credito_otorgada:
 *                           type: string
 *                           example: "23.00"
 *                         plazo_credito_dso:
 *                           type: integer
 *                           example: 1
 *                         fecha_otorgamiento_linea_credito:
 *                           type: string
 *                           format: date
 *                           example: "2024-10-22"
 *                         saldo_vigente_linea_credito:
 *                           type: string
 *                           example: "23.00"
 *                         saldo_vencido_linea_credito:
 *                           type: string
 *                           example: "23.00"
 *                         dias_atraso:
 *                           type: integer
 *                           example: 23
 *                         antiguedad_relacion:
 *                           type: string
 *                           example: "22"
 *       '400':
 *         description: "Solicitud inválida"
 *       '404':
 *         description: "Contacto no encontrado"
 *       '500':
 *         description: "Error interno del servidor"
 */
router.get('/getInfoContactoReferido/:id_contacto', certificationController.getInfoContactoReferido)

router.post('/solicitarCredito', certificationController.solicitarCredito)

/**
 * @swagger
 * /api/certification/getMontoPlazo/{id_proveedor}/{id_cliente}/{id_solicitud_credito}:
 *   get:
 *     summary: Obtiene el último monto solicitado y plazo para una relación proveedor-cliente con estatus 'aceptada'
 *     tags:
 *       - Certificación
 *     parameters:
 *       - in: path
 *         name: id_proveedor
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del proveedor
 *       - in: path
 *         name: id_cliente
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del cliente
 *       - in: path
 *         name: id_solicitud_credito
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la solicitud de crédito
 *     responses:
 *       200:
 *         description: Monto y plazo encontrados correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   monto_solicitado:
 *                     type: number
 *                     example: 50000
 *                   plazo:
 *                     type: integer
 *                     example: 12
 *       404:
 *         description: No se encontró ninguna solicitud con estatus 'aceptada'
 *       500:
 *         description: Error del servidor
 */
router.get('/getMontoPlazo/:id_proveedor/:id_cliente/:id_solicitud_credito', certificationController.getMontoPlazo)


router.put('/seteaEstatusSolicitudCredito', certificationController.seteaEstatusSolicitudCredito)

router.get('/obtenerInfoReferenciaExterna/:hash', certificationController.consultaHashReferenciaExternas)

router.put('/actualizaHashReferenciaExternas', certificationController.actualizaHashReferenciaExternas)

router.post('/consultaMailjet', certificationController.consultaMailjet)

router.post('/saveLog', certificationController.saveLog)

router.get('/getDataReporteGlobal/:id_emp', certificationController.getDataReporteGlobal)
router.get('/getDemandasBloc/:nombre', certificationController.getDemandasBloc)


module.exports = router
