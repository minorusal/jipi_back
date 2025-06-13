// routes/api_arcsa_v2/index.js

const express = require('express');
const router = express.Router();

// Importa las rutas individuales
const portalRoutes = require('./portal');
// Importa otros archivos de ruta si es necesario

// Usa las rutas importadas
router.use('/portal', portalRoutes);
// Agrega más rutas si es necesario

module.exports = router;
