const express = require('express');
const router = express.Router();

// ... otras rutas
const algorithmRoutes = require('./algorithm');
const authRoutes = require('./auth.ga');
const blocRoutes = require('./bloc');
// ... (asume que las demás rutas se cargan aquí)

const boletinajeRoutes = require('./boletinaje'); // Ruta nueva

router.use('/algorithm', algorithmRoutes);
router.use('/auth', authRoutes);
router.use('/bloc', blocRoutes);
// ...

router.use('/boletinaje', boletinajeRoutes); // Usar ruta nueva

module.exports = router; 