'use strict'

const cluster = require('cluster')
const net = require('net')
const totalCPUs = require('os').cpus().length
const debug = require('debug')('old-api:cluster')

const findAvailablePort = (port) => {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => resolve(findAvailablePort(port + 1)))
    server.once('listening', () => {
      const { port: available } = server.address()
      server.close(() => resolve(available))
    })
    server.listen(port)
  })
}

if (cluster.isMaster) {
  (async () => {
    const defaultPort = parseInt(process.env.PORT || '3000', 10)
    const port = await findAvailablePort(defaultPort)
    if (port !== defaultPort) {
      debug(`Port ${defaultPort} in use, using ${port}`)
    }
    process.env.PORT = port

    debug(`Number of CPUs is ${totalCPUs}`)
    debug(`Master ${process.pid} is running`)

    for (let i = 0; i < totalCPUs; i++) {
      cluster.fork()
    }
    cluster.on('listening', (worker) => {
      debug(`Cluster ${worker.process.pid} connected`)
    })
    cluster.on('disconnect', (worker) => {
      debug(`Cluster ${worker.process.pid} disconnected`)
    })

    cluster.on('exit', (worker, code, signal) => {
      debug(`worker ${worker.process.pid} died`)
      debug("Let's fork another worker!")
      cluster.fork()
    })
  })()
} else {
  require('./app.js')
}
