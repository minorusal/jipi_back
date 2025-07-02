'use strict'

// Fijar zona horaria para todas las operaciones con fecha
process.env.TZ = 'America/Mexico_City'

const { server: { port } } = require('./config')
const net = require('net')
const logger = require('../src/utils/logs/logger')
const { startCronJobs } = require('./controllers/api/cron')
const express = require('express')
const swaggerUi = require('swagger-ui-express')
const generateOpenApi = require('./utils/generateOpenApi')
const routes = require('./routes')// Aquí se importan las rutas desarrolladas en Arcsa, es decir, lo "nuevo" [apiRoutes] y las desarrolladas por la consultora [legacyRoutes]
const helmet = require('helmet')
const cors = require('cors')
const compression = require('compression')
const multer = require('multer');
const handleErrMidleware = require('./utils/middlewares/handleErr')
const app = express()

startCronJobs()

app.use(cors())
app.use(helmet())
app.use(express.urlencoded({ extended: true, limit: '100mb' })) // Aumentar el límite de tamaño de solicitud
app.use(express.json({ limit: '100mb' }))
app.use(compression({ level: 9 }))

const upload = multer();  // Instancia de multer (no hay almacenamiento, solo procesamiento)
 //app.use(upload.none());


async function checkPort (p) {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => server.close(() => resolve(true)))
    server.listen(p)
  })
}

async function findAvailablePort (start) {
  let current = start
  // eslint-disable-next-line no-await-in-loop
  while (!(await checkPort(current))) {
    current += 1
  }
  return current
}

(async () => {
  const basePort = port || 3000
  const finalPort = await findAvailablePort(basePort)
  if (finalPort !== basePort) {
    logger.info(`Puerto ${basePort} en uso, se usará ${finalPort}`)
  }

  const swaggerDocs = generateOpenApi(finalPort)
  // Servir la documentación de Swagger en la ruta /api-docs
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs))

  app.use('/', routes)

  app.use(handleErrMidleware())

  app.listen(finalPort, () => {
    logger.info(`Api levantada en el puerto: ${finalPort}`)
    console.log('Running server on port: ', finalPort)
  })
})()

module.exports = app
