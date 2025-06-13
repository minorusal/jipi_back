'use strict'

const { mysql: { host, port, user, password, database } } = require('../config')
const { Sequelize } = require('sequelize')
const debug = require('debug')('old-api:mysql-lib')
const { exec } = require('child_process')  // Importamos exec para ejecutar comandos del sistema

class MySequelize {
  constructor () {
    if (MySequelize.instance == null) {
      this.sequelize = new Sequelize(
        database,
        user,
        password, {
          host,
          port,
          dialect: 'mysql',
          operatorAliases: false,
          pool: {
            max: 5,
            min: 1,
            idle: 10 * 1000,
            evict: 10 * 1000
          },
          logging: false
        })

      MySequelize.instance = this
    }
    return MySequelize.instance
  }

  // Nueva función para ejecutar flush-hosts
  flushHosts() {
    return new Promise((resolve, reject) => {
      exec(`mysqladmin flush-hosts -u ${user} -p${password} -h ${host}`, (error, stdout, stderr) => {
        if (error) {
          debug(`Error ejecutando mysqladmin flush-hosts: ${error.message}`);
          reject(error);
        }
        if (stderr) {
          debug(`stderr: ${stderr}`);
          reject(stderr);
        }
        debug(`stdout: ${stdout}`);
        resolve(stdout);
      });
    });
  }

  normalizeQueryResult (query, result) {
    const [isInsert] = query.trim().toLowerCase().split(' ')
    let res = null
    if (isInsert === 'insert') {
      const [insertId, affectedRows] = result
      res = { insertId, affectedRows }
    } else res = result[0]
    return res
  }

  normalizeLegacyQuery (query, dataObj) {
    if (!dataObj) return query
    return query.replace(/\@(\w+)/g, (txt, key) => {
      if (dataObj.hasOwnProperty(key)) return this.sequelize.escape(dataObj[key])

      return txt
    })
  }

  query (queryStr) {
    return new Promise((resolve, reject) => {
      this.sequelize.query(queryStr)
        .then(res => {
          const result = this.normalizeQueryResult(queryStr, res)

          resolve({ result })
        })
        .catch(err => {
          if (err.message.includes('Host blocked')) {
            // Si hay un error de bloqueo de host, intentamos limpiar los hosts
            this.flushHosts()
              .then(() => {
                debug('Hosts desbloqueados correctamente');
                // Reintentar la conexión después de limpiar
                return this.sequelize.query(queryStr);
              })
              .then(res => {
                const result = this.normalizeQueryResult(queryStr, res)
                resolve({ result });
              })
              .catch(flushErr => {
                debug('Error al limpiar los hosts', flushErr);
                reject(flushErr);
              });
          } else {
            reject(err);
          }
        });
    });
  }

  mysqlQuery (tipo, queryString, dataObj = null) {
    return new Promise((resolve, reject) => {
      const nuevoQ = this.normalizeLegacyQuery(queryString, dataObj)

      this.sequelize.query(nuevoQ)
        .then(res => {
          if (tipo == 'GET') {
            const result = this.normalizeQueryResult(nuevoQ, res)

            resolve({ err: false, result })
          } else resolve({ err: false })
        })
        .catch(error => {
          debug('Error al ejecutar query. Función de legacy code...')

          resolve({ err: true, description: error })
        })
    })
  }

  escape (str) {
    return this.sequelize.escape(str)
  }
}

module.exports = Object.freeze(new MySequelize())
