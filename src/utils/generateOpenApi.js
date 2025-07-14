const swaggerJSDoc = require('swagger-jsdoc')
const path = require('path')

module.exports = function generateOpenApi (port) {
  const swaggerDefinition = {
    openapi: '3.0.0',
    info: {
      title: 'Credibusiness API',
      version: '1.0.0',
      description: 'Documentación para la API de Credibusiness'
    },
    servers: [
      {
        url: `http://localhost:${port || 3000}`,
        description: 'Servidor de desarrollo'
      }
    ]
  }

  const options = {
    swaggerDefinition,
    // Paths to files containing OpenAPI definitions
    apis: [path.join(__dirname, '../routes/api/*.js')]
  }

  return swaggerJSDoc(options)
}
