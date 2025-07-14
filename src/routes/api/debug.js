'use strict';

const express = require('express');
const debugToolsController = require('../../controllers/api/debugTools');

const router = express.Router();

/**
 * @openapi
 * /api/debug/cipher-tool:
 *   get:
 *     summary: Obtiene una interfaz HTML para cifrar y descifrar texto.
 *     description: Devuelve una página web simple que permite interactuar con los endpoints de cifrado y descifrado de forma segura, requiriendo la contraseña maestra.
 *     tags:
 *       - Debug Tools
 *     responses:
 *       200:
 *         description: Interfaz HTML de la herramienta.
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 */
router.get('/cipher-tool', debugToolsController.getCipherToolInterface);

/**
 * @openapi
 * /api/debug/encrypt:
 *   post:
 *     summary: Cifra un texto proporcionado.
 *     description: Recibe un texto y la contraseña maestra, y devuelve el texto cifrado usando la clave del servidor.
 *     tags:
 *       - Debug Tools
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               masterPassword:
 *                 type: string
 *                 description: La contraseña maestra para autorizar la operación.
 *                 example: "s3cr3t_m4st3r_p4ss"
 *               data:
 *                 type: string
 *                 description: El texto a cifrar.
 *                 example: "Este es un texto secreto"
 *     responses:
 *       200:
 *         description: Cifrado exitoso.
 *       401:
 *         description: Contraseña maestra incorrecta.
 */
router.post('/encrypt', debugToolsController.handleEncrypt);

/**
 * @openapi
 * /api/debug/decrypt:
 *   post:
 *     summary: Descifra un texto cifrado.
 *     description: Recibe un texto cifrado y la contraseña maestra, y devuelve el texto original.
 *     tags:
 *       - Debug Tools
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               masterPassword:
 *                 type: string
 *                 description: La contraseña maestra para autorizar la operación.
 *                 example: "s3cr3t_m4st3r_p4ss"
 *               data:
 *                 type: string
 *                 description: El texto cifrado a descifrar.
 *                 example: "U2FsdGVkX1..."
 *     responses:
 *       200:
 *         description: Descifrado exitoso.
 *       401:
 *         description: Contraseña maestra incorrecta.
 */
router.post('/decrypt', debugToolsController.handleDecrypt);

module.exports = router;