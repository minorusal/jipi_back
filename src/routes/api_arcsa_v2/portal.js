// routes/api_arcsa_v2/portal.js

const express = require('express');
const router = express.Router();

/**
 * @swagger
 * /api_arcsa_v2/portal/nueva-ruta:
 *   post:
 *     summary: Ejemplo de ruta nueva
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: Respuesta exitosa
 */

router.post('/nueva-ruta', (req, res) => {
  const { title, content } = req.body;
  res.json({ success: true, message: 'nueva ruta a api', data: { title, content } });
});

module.exports = router;
