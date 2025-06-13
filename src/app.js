'use strict'

const { server: { port } } = require('./config')
const logger = require('../src/utils/logs/logger')
const { startCronJobs } = require('./controllers/api/cron')
const express = require('express')
const swaggerUi = require('swagger-ui-express')
const swaggerJsdoc = require('swagger-jsdoc')
const routes = require('./routes')// Aquí se importan las rutas desarrolladas en Arcsa, es decir, lo "nuevo" [apiRoutes] y las desarrolladas por la consultora [legacyRoutes]
const helmet = require('helmet')
const cors = require('cors')
const compression = require('compression')
const multer = require('multer');
const handleErrMidleware = require('./utils/middlewares/handleErr')
const app = express()

startCronJobs()

// Configuración de Swagger
const swaggerOptions = {
  definition: {
      openapi: '3.0.0',
      info: {
          title: 'Credibusiness',
          version: '1.0.0',
          description: 'Descripción de mi API',
      },
      servers: [
          {
              url: `http://localhost:${port || 3000}`,
              description: 'Servidor local',
          },
      ],
  },
  apis: ['./src/routes/api/*.js'],
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);

// Servir la documentación de Swagger en la ruta /api-docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

app.use(cors())
app.use(helmet())
app.use(express.urlencoded({ extended: true, limit: '100mb' })) // Aumentar el límite de tamaño de solicitud
app.use(express.json({ limit: '100mb' }))
app.use(compression({ level: 9 }))

const upload = multer();  // Instancia de multer (no hay almacenamiento, solo procesamiento)
 //app.use(upload.none()); 

app.use('/', routes)

app.use(handleErrMidleware())

app.listen(port || 3000, () => {
  logger.info(`Api levantada en el puerto: ${port}`);
  console.log('Running server on port: ', port)
})

module.exports = app
