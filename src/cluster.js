'use strict'

const cluster = require('cluster')
const totalCPUs = require('os').cpus().length
const debug = require('debug')('old-api:cluster')

if (cluster.isMaster) {
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
} else {
  require('./app.js')
}
