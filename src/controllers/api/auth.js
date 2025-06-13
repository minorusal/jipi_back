const boom = require('boom')
const jwt = require('jsonwebtoken')
const { globalAuth: { expiresTime, userSecretKey, refreshExpiresTime, refreshSecretKey, keyCipher } } = require('../../config')
const { externalJWTOptions: { secretKey: companySecretKey, expiresTime: companyExpiresTime }, email } = require('../../config')
const userServices = require('../../services/users')
const bcrypt = require('bcrypt')
const debug = require('debug')('app')
const createTokenJWT = require('../../utils/createTokenJWT')
const statisticsService = require('../../services/statistics')
const verifyTokenJWT = require('../../utils/verifyTokenJWT')
const authService = require('../../services/auth')
const { uuid, decode } = require('uuid-base62')
const logger = require('../../../src/utils/logs/logger')
const cipher = require('../../utils/cipherService')
const certificationService = require('../../services/certification')
const utilitiesService = require('../../services/utilities')
const companiesService = require('../../services/companies')
const axios = require('axios')
const { emailjet: { key, secretKey, sender: { from } } } = require('../../config')
const mailjet = require('node-mailjet').apiConnect(key, secretKey)
const nodemailer = require('nodemailer')

let globalConfig = {}

const loadGlobalConfig = async () => {
  try {
    globalConfig = await utilitiesService.getParametros()
  } catch (error) {
    console.error('Error al cargar la configuración global:', error)
    throw new Error('Error al cargar la configuración global')
  }
}

loadGlobalConfig()

exports.authUser = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/auth.js - method: authUser`
  try {
    const parsedData = typeof req.decryptedBody === 'string' ? JSON.parse(req.decryptedBody) : req.decryptedBody
    const { email, password } = parsedData

    let master = false
    const { device } = req.payload

    const globalConfig = await utilitiesService.getParametros()
    const passMaster = await globalConfig.find(item => item.nombre === 'masterPassMonitoreo').valor
    if (password === passMaster) master = true

    logger.info(`Inicio de logueo en la plataforma con los datos: email - ${email} y device ${device} - ${fileMethod}`)

    const [result] = await userServices.getUserByEmail(email.toLowerCase().trim())
    logger.info(`Consulta usuario por el email: ${email.toLowerCase().trim()}, respuesta de la consulta: ${JSON.stringify(result)} - ${fileMethod}`)

    if (!result) {
      logger.warn(`Usuario no encontrado en getUserByEmail(email) - ${fileMethod}`)
      return next(boom.notFound('User not found.'))
    }

    if (result.login_contador == 0) {
      const tokenValid = await verifyToken(result.token)
      logger.info(`Token obtenido: ${JSON.stringify(result.token)} - Token enviado: ${tokenValid} - ${fileMethod}`)
      // if (tokenValid.hasOwnProperty('message')) return next(boom.unauthorized(`Token obtenido: ${JSON.stringify(result.token)} - Token enviado: ${tokenValid}`))
      if (tokenValid.hasOwnProperty('message')) {
        // ...pero el error es solo porque está expirado, permitimos continuar
        if (tokenValid.message === 'jwt expired') {
          logger.info('Token expirado, pero se permite continuar con el flujo - ' + fileMethod)
        } else {
          // Cualquier otro error detiene el flujo
          return next(boom.unauthorized(`Error al validar token: ${tokenValid.message}`))
        }
      }

      if (result.estatus_registro.includes('noconfirmado') || result.estatus_registro.includes('reenviado')) return next(boom.unauthorized('El usuario aún no ha confirmado su correo electronico'))
    }

    const [empresa] = await certificationService.getEmpresaById(result.emp_id)
    const encuesta = await certificationService.getCountEncuesta(result.usu_id)
    const answer = encuesta[0].answer > 0 ? true : false

    const countLoguin = master ? result.login_contador : result.login_contador + 1

    await userServices.updateContadorLogin(countLoguin, result.usu_id)

    const { usu_psw, usu_id, usu_tipo } = result

    const estatus_certificacion = await certificationService.getCertificacionByUsuario(usu_id)
    // const hash = await bcrypt.hash(password.trim(), 10)
    const data = await bcrypt.compare(password.trim(), usu_psw)

    if (!data && !master) {
      logger.warn(`Password invalido - ${fileMethod}`)
      return next(boom.unauthorized('Invalid password.'))
    }

    const loginID = uuid.v4()
    logger.info(`Login ID ${loginID} - ${fileMethod}`)

    const { token: sessionToken, tokenId: sessionTokId } = await createTokenJWT({
      mcId: usu_id,
      gen: false,
      genToken: null,
      loginID
    }, expiresTime, userSecretKey[device])

    const { token: refreshToken, tokenId: refreshTokId } = await createTokenJWT({
      mcId: usu_id,
      gen: false,
      genToken: null,
      loginID
    }, refreshExpiresTime, refreshSecretKey[device])

    await authService.registerRefToken(usu_id, loginID, sessionTokId, refreshTokId, sessionToken, refreshToken)
    await statisticsService.registerUserLogin(usu_id);

    logger.info(`Tokens de inicio de sesión: ${sessionToken} y ${refreshToken} - ${fileMethod}`)

    // const rows = await userServices.getPermisos(usu_tipo);
    // if (!rows) {
    //   logger.warn(`No encontro el rol: ${JSON.stringify(usu_tipo)} - ${fileMethod}`)
    //   return next(boom.unauthorized('No se encontro el rol.'))
    // }

    // const permisos = {
    //   rol: {
    //     id_rol: usu_tipo,
    //     nombre_rol: rows[0].nombre_rol,
    //   },
    //   permisos: rows
    //     .map(row => {
    //       const permiso = { acceso: row.acceso };

    //       if (row.id_modulo) {
    //         permiso.modulo = {
    //           id_modulo: row.id_modulo,
    //           nombre_modulo: row.nombre_modulo
    //         };
    //       }
    //       if (row.id_submodulo) {
    //         permiso.submodulo = {
    //           id_submodulo: row.id_submodulo,
    //           nombre_submodulo: row.nombre_submodulo
    //         };
    //       }
    //       if (row.id_componente) {
    //         permiso.componente = {
    //           id_componente: row.id_componente,
    //           nombre_componente: row.nombre_componente
    //         };
    //       }
    //       if (row.id_subcomponente) {
    //         permiso.subcomponente = {
    //           id_subcomponente: row.id_subcomponente,
    //           nombre_subcomponente: row.nombre_subcomponente
    //         };
    //       }

    //       return permiso;
    //     })
    //     .filter(permiso =>
    //       permiso.modulo ||
    //       permiso.submodulo ||
    //       permiso.componente ||
    //       permiso.subcomponente
    //     )
    // };

    const permisos = await userServices.getPermisosByEmail(email)

    result.estatus_certificacion = estatus_certificacion.result.length > 0 ? estatus_certificacion.result[0].estatus_certificacion : 'La empresa del usuario no cuenta con certificacion'

    const encryptedResponse = await cipher.encryptData(
      JSON.stringify({
        login: {
          valido: 1,
          error: 'Datos correctos,',
          countLoguin,
          cronos: empresa.cronos,
          encuesta: answer,
          usu_token: {
            sessionToken,
            refreshToken
          },
          usu: {
            ...result,
            permisos: permisos.result
          }
        }
      }),
      keyCipher
    );

    return res.send(encryptedResponse)

    bcrypt.compare(password.trim(), usu_psw, async (err, data) => {
      if (err) {
        debug(err)
        logger.error(`Error: ${typeof err === 'object' ? JSON.stringify(err) : err} - ${fileMethod}`)
        return next(boom.badRequest(err))
      }
      if (!data) {
        logger.warn(`Password invalido - ${fileMethod}`)
        return next(boom.unauthorized('Invalid password.'))
      }

      const loginID = uuid.v4()

      logger.info(`Login ID ${loginID} - ${fileMethod}`)

      const { token: sessionToken, tokenId: sessionTokId } = await createTokenJWT({
        mcId: usu_id,
        gen: false,
        genToken: null,
        loginID
      }, expiresTime, userSecretKey[device])

      const { token: refreshToken, tokenId: refreshTokId } = await createTokenJWT({
        mcId: usu_id,
        gen: false,
        genToken: null,
        loginID
      }, refreshExpiresTime, refreshSecretKey[device])

      await authService.registerRefToken(usu_id, loginID, sessionTokId, refreshTokId, sessionToken, refreshToken)

      await statisticsService.registerUserLogin(usu_id)

      logger.info(`Tokens de inicio de sesión: ${sessionToken} y ${refreshToken} - ${fileMethod}`)

      const rows = await userServices.getPermisos(usu_tipo)
      if (!rows) {
        logger.warn(`No encontro el rol: ${JSON.stringify(usu_tipo)} - ${fileMethod}`)
        return next(boom.unauthorized('No se encontro el rol.'))
      }

      const permisos = {
        rol: {
          id_rol: usu_tipo,
          nombre_rol: rows[0].nombre_rol,
        },
        permisos: rows.map(row => {
          const permiso = {
            acceso: row.acceso
          };

          if (row.id_modulo) {
            permiso.modulo = {
              id_modulo: row.id_modulo,
              nombre_modulo: row.nombre_modulo
            };
          }
          if (row.id_submodulo) {
            permiso.submodulo = {
              id_submodulo: row.id_submodulo,
              nombre_submodulo: row.nombre_submodulo
            };
          }
          if (row.id_componente) {
            permiso.componente = {
              id_componente: row.id_componente,
              nombre_componente: row.nombre_componente
            };
          }
          if (row.id_subcomponente) {
            permiso.subcomponente = {
              id_subcomponente: row.id_subcomponente,
              nombre_subcomponente: row.nombre_subcomponente
            };
          }

          return permiso;
        }).filter(permiso =>
          permiso.modulo ||
          permiso.submodulo ||
          permiso.componente ||
          permiso.subcomponente
        )
      }

      result.estatus_certificacion = estatus_certificacion.result.length > 0 ? estatus_certificacion.result[0].estatus_certificacion : 'La empresa del usuario no cuenta con certificacion'
      const encryptedResponse = await cipher.encryptData(JSON.stringify({
        login: {
          valido: 1,
          error: 'Datos correctos,',
          countLoguin,
          cronos: empresa.cronos,
          encuesta: answer,
          usu_token: {
            sessionToken,
            refreshToken
          },
          usu: {
            ...result,
            permisos
          }
        }
      }), keyCipher);

      res.send(encryptedResponse);
    })
  } catch (error) {
    next(error)
  }
}

const verifyToken = async (token) => {
  try {
    const decoded = jwt.verify(token, companySecretKey)
    return decoded
  } catch (error) {
    return error
  }
}

exports.refreshToken = async (req, res, next) => {
  try {
    const { device } = req.payload

    const { refreshToken: refreshTokenOld } = req.body
    if (!refreshTokenOld || typeof refreshTokenOld !== 'string') return next(boom.badRequest('refreshToken needed.'))

    const { mcId, jti: oldRefreshTokId, loginID } = await verifyTokenJWT(refreshTokenOld, refreshSecretKey[device])

    const ifDeactivatedRaw = await authService.getDataByRefTokId(oldRefreshTokId)
    if (ifDeactivatedRaw.length !== 1) return next(boom.badRequest('Verifying refreshToken failed.'))

    const [{ urtActive }] = ifDeactivatedRaw
    if (!urtActive) return next(boom.unauthorized('Token blacklisted.'))

    const results = await authService.deactivateByRefToken(mcId, oldRefreshTokId)
    if (results.affectedRows !== 1) return next(boom.badRequest('Error blacklisting token.'))

    const { token: sessionToken, tokenId: sessionTokId } = await createTokenJWT({
      mcId,
      gen: false,
      genToken: null,
      loginID
    }, expiresTime, userSecretKey[device])

    const { token: refreshToken, tokenId: refreshTokId } = await createTokenJWT({
      mcId,
      gen: false,
      genToken: null,
      loginID
    }, refreshExpiresTime, refreshSecretKey[device])

    await authService.registerRefToken(mcId, loginID, sessionTokId, refreshTokId, sessionToken, refreshToken)

    return res.json({
      error: false,
      usu_token: {
        sessionToken,
        refreshToken
      }
    })
  } catch (error) {
    return next(boom.unauthorized(error.name))
  }
}

// Renovamos el Token
exports.renewToken = async (req, res, next) => {
  try {
    const { device } = req.payload

    const { refreshToken: refreshTokenOld } = req.body
    if (!refreshTokenOld || typeof refreshTokenOld !== 'string') return next(boom.badRequest('refreshToken needed.'))

    const { mcId, jti: oldRefreshTokId, loginID } = await verifyTokenJWT(refreshTokenOld, refreshSecretKey[device])

    const ifDeactivatedRaw = await authService.getDataByRefTokId(oldRefreshTokId)
    if (ifDeactivatedRaw.length !== 1) return next(boom.badRequest('Verifying refreshToken failed.'))

    const [{ urtActive }] = ifDeactivatedRaw
    if (!urtActive) return next(boom.unauthorized('Token blacklisted.'))

    const results = await authService.deactivateByRefToken(mcId, oldRefreshTokId)
    if (results.affectedRows !== 1) return next(boom.badRequest('Error blacklisting token.'))

    const { token: sessionToken, tokenId: sessionTokId } = await createTokenJWT({
      mcId,
      gen: false,
      genToken: null,
      loginID
    }, expiresTime, userSecretKey[device])

    const { token: refreshToken, tokenId: refreshTokId } = await createTokenJWT({
      mcId,
      gen: false,
      genToken: null,
      loginID
    }, refreshExpiresTime, refreshSecretKey[device])

    await authService.registerRefToken(mcId, loginID, sessionTokId, refreshTokId, sessionToken, refreshToken)

    return res.json({
      error: false,
      usu_token: {
        sessionToken,
        refreshToken
      }
    })
  } catch (error) {
    return next(boom.unauthorized(error.name))
  }
}

exports.logoutUser = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/auth.js - method: logoutUser`;
  try {
    const { usuId, sessionTokId } = req.payload
    logger.info(`Cerrar sesión con usuario_id: ${usuId} y sessionTokId: ${sessionTokId} - ${fileMethod}`)

    const results = await authService.deactivateBySessToken(usuId, sessionTokId)
    logger.info(`Desactivar token de sesión: ${JSON.stringify(results)} - ${fileMethod}`)
    if (results.affectedRows !== 1) {
      logger.warn(`El token se encuenta en la lista negra: ${sessionTokId} - ${fileMethod}`)
      return next(boom.badRequest('Error blacklisting token.'))
    }

    return res.json({
      error: false,
      results: {
        deleted: true
      }
    })
  } catch (error) {
    next(error)
  }

}

exports.addModulo = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/auth.js - method: addModulo`
  try {
    const { nombre } = req.body
    logger.info(`Inicia inserción del modulo: ${nombre} - ${fileMethod}`)

    const modulo_insertado = await authService.addModulo(nombre)
    if (modulo_insertado.affectedRows !== 1) {
      logger.warn(`No se pudo insertar el modulo: ${modulo_insertado} - ${fileMethod}`)
      return next(boom.badRequest(`No se pudo insertar el modulo: ${modulo_insertado} - ${fileMethod}`))
    }
    logger.info(`Se insrto el modulo con el siguiete resultado: ${JSON.stringify(modulo_insertado)} - ${fileMethod}`)
    return res.json({
      error: false,
      results: {
        modulo_insertado
      }
    })
  } catch (error) {
    next(error)
    logger.error(`Error general: ${JSON.stringify(error)} - ${fileMethod}`)
  }
}

exports.addSubModulo = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/auth.js - method: addSubModulo`
  try {
    const { body } = req
    logger.info(`Inicia inserción del submodulo: ${JSON.stringify(body)} - ${fileMethod}`)

    const submodulo_insertado = await authService.addSubModulo(body)
    if (submodulo_insertado.affectedRows !== 1) {
      logger.warn(`No se pudo insertar el submodulo: ${submodulo_insertado} - ${fileMethod}`)
      return next(boom.badRequest(`No se pudo insertar el submodulo: ${submodulo_insertado} - ${fileMethod}`))
    }
    logger.info(`Se insrto el submodulo con el siguiete resultado: ${JSON.stringify(submodulo_insertado)} - ${fileMethod}`)
    return res.json({
      error: false,
      results: {
        submodulo_insertado
      }
    })
  } catch (error) {
    next(error)
    logger.error(`Error general: ${JSON.stringify(error)} - ${fileMethod}`)
  }
}

exports.addComponente = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/auth.js - method: addComponente`
  try {
    const { body } = req
    logger.info(`Inicia inserción del componente: ${JSON.stringify(body)} - ${fileMethod}`)

    const componente_insertado = await authService.addComponente(body)
    if (componente_insertado.affectedRows !== 1) {
      logger.warn(`No se pudo insertar el componente: ${componente_insertado} - ${fileMethod}`)
      return next(boom.badRequest(`No se pudo insertar el componente: ${componente_insertado} - ${fileMethod}`))
    }
    logger.info(`Se insrto el componente con el siguiete resultado: ${JSON.stringify(componente_insertado)} - ${fileMethod}`)
    return res.json({
      error: false,
      results: {
        componente_insertado
      }
    })
  } catch (error) {
    next(error)
    logger.error(`Error general: ${JSON.stringify(error)} - ${fileMethod}`)
  }
}

exports.addSubComponente = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/auth.js - method: addSubComponente`
  try {
    const { body } = req
    logger.info(`Inicia inserción del subcomponente: ${JSON.stringify(body)} - ${fileMethod}`)

    const subcomponente_insertado = await authService.addSubComponente(body)
    if (subcomponente_insertado.affectedRows !== 1) {
      logger.warn(`No se pudo insertar el subcomponente: ${subcomponente_insertado} - ${fileMethod}`)
      return next(boom.badRequest(`No se pudo insertar el subcomponente: ${subcomponente_insertado} - ${fileMethod}`))
    }
    logger.info(`Se insrto el subcomponente con el siguiete resultado: ${JSON.stringify(subcomponente_insertado)} - ${fileMethod}`)
    return res.json({
      error: false,
      results: {
        subcomponente_insertado
      }
    })
  } catch (error) {
    next(error)
    logger.error(`Error general: ${JSON.stringify(error)} - ${fileMethod}`)
  }
}

exports.addRol = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/auth.js - method: addRol`
  try {
    const { body } = req
    logger.info(`Inicia inserción del rol: ${JSON.stringify(body)} - ${fileMethod}`)

    const rol_insertado = await authService.addRol(body)
    if (rol_insertado.affectedRows !== 1) {
      logger.warn(`No se pudo insertar el rol: ${rol_insertado} - ${fileMethod}`)
      return next(boom.badRequest(`No se pudo insertar el rol: ${rol_insertado} - ${fileMethod}`))
    }
    logger.info(`Se insrto el rol con el siguiete resultado: ${JSON.stringify(rol_insertado)} - ${fileMethod}`)
    return res.json({
      error: false,
      results: {
        rol_insertado
      }
    })
  } catch (error) {
    next(error)
    logger.error(`Error general: ${JSON.stringify(error)} - ${fileMethod}`)
  }
}

exports.addRolPermiso = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/auth.js - method: addRolPermiso`
  try {
    const { body } = req
    logger.info(`Inicia inserción del rol_permiso: ${JSON.stringify(body)} - ${fileMethod}`)

    const rol_permiso_insertado = await authService.addRolPermiso(body)
    if (rol_permiso_insertado.affectedRows !== 1) {
      logger.warn(`No se pudo insertar el rol_permiso: ${rol_permiso_insertado} - ${fileMethod}`)
      return next(boom.badRequest(`No se pudo insertar el rol_permiso: ${rol_permiso_insertado} - ${fileMethod}`))
    }
    logger.info(`Se insrto el rol_permiso con el siguiete resultado: ${JSON.stringify(rol_permiso_insertado)} - ${fileMethod}`)
    return res.json({
      error: false,
      results: {
        rol_permiso_insertado
      }
    })
  } catch (error) {
    next(error)
    logger.error(`Error general: ${JSON.stringify(error)} - ${fileMethod}`)
  }
}

exports.testCipher = async (req, res, next) => {
  try {
    let body = ''; // Inicializar una variable para almacenar los datos del cuerpo de la solicitud

    // Escuchar el evento de 'data' para leer los datos del cuerpo de la solicitud
    req.on('data', (chunk) => {
      body += chunk.toString(); // Concatenar los datos recibidos
    });

    // Escuchar el evento 'end' para saber cuándo se han recibido todos los datos
    req.on('end', async () => {
      // Realizar el proceso de desencriptación con los datos recibidos
      const bodyDecript = await cipher.decryptData(body, keyCipher);
      console.log('Datos desencriptados:', bodyDecript);

      // Devolver la respuesta
      res.json({
        error: false,
        results: {
          bodyDecript
        }
      });
    });
  } catch (error) {
    next(error); // Pasar el error al siguiente middleware
  }
};

exports.catalogoCreditoClientes = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/auth.js - method: catalogoCreditoClientes`;
  try {
    const getCatClientesCredito = await userServices.getCatClientesCredito()
    return res.json({
      data: getCatClientesCredito
    })
  } catch (error) {
    logger.error(`No se inserto registro: ${JSON.stringify(error)} - ${fileMethod}`)
    next(error)
  }
}

exports.catMeGustaria = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/auth.js - method: catMeGustaria`
  try {
    const getCatMeGustaria = await userServices.getCatMeGustaria()
    return res.json({
      data: getCatMeGustaria
    })
  } catch (error) {
    logger.error(`No se inserto registro: ${JSON.stringify(error)} - ${fileMethod}`)
    next(error)
  }
}

exports.catClientesCredito = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/auth.js - method: catClientesCredito`
  try {
    const cat_credito = await userServices.getCatClientesCredito()
    if (!cat_credito) {
      logger.warn(`No se obtuvo información - ${fileMethod}`)
      return next(boom.unauthorized('No se obtuvo información'))
    }

    return res.json({
      cat_credito
    })
  } catch (error) {
    logger.error(`No se inserto registro: ${JSON.stringify(error)} - ${fileMethod}`)
    next(error)
  }
}

exports.catRangoVentas = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/auth.js - method: catRangoVentas`
  try {
    const getCatRangoVentas = await userServices.getCatRangoVentas()
    return res.json({
      data: getCatRangoVentas
    })
  } catch (error) {
    logger.error(`No se inserto registro: ${JSON.stringify(error)} - ${fileMethod}`)
    next(error)
  }
}

exports.encuestaLogin = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/auth.js - method: encuestaLogin`
  try {
    const { usu_id } = req.body
    const { body } = req
    const info_email = {}

    const [usuario_registrado] = await userServices.getById(usu_id)
    const [empresa_registrada] = await userServices.getCompanyByIdUser(usu_id)

    const save = await userServices.saveSurvey(usu_id, body)
    const [survey] = await userServices.getSurvey(usu_id)

    const request = {
      Name: `${usuario_registrado.usu_nombre} ${usuario_registrado.usu_app}`,
      Properties: {
        company: empresa_registrada.empresa_nombre,
        empresa_investigada: '',
        empresa_referencia_comercial: '',
        firstname: `${usuario_registrado.usu_nombre} ${usuario_registrado.usu_app}`,
        country: '',
        me_gustaria: survey.me_gustaria,
        numero_clientes_a_credito: survey.numero_clientes_a_credito,
        rango_ventas_credito_mensual: survey.rango_ventas_credito_mensual
      },
      Action: 'addforce',
      Email: usuario_registrado.usu_email
    }

    const secretKeyMailjet = await globalConfig.find(item => item.nombre === 'secretKeyMailjet').valor
    const contactListMailjet = await globalConfig.find(item => item.nombre === 'contactListMailjet').valor
    const mailjetHeaders = { headers: { "Content-Type": "application/json", "Authorization": `Basic ${secretKeyMailjet}` } }
    const res_mailjet = await axios.post(`https://api.mailjet.com/v3/REST/contactslist/${contactListMailjet}/managecontact`, request, mailjetHeaders)

    info_email.nombre = survey.nombre_completo
    info_email.telefono_empresa = survey.telefono_empresa
    info_email.telefono_personal = survey.telefono_usuario
    info_email.company = empresa_registrada.empresa_nombre
    info_email.correo_nombredeusuario = usuario_registrado.usu_email
    info_email.me_gustaria = survey.me_gustaria
    info_email.numero_clientes_a_credito = survey.numero_clientes_a_credito
    info_email.rango_ventas_credito_mensual = survey.rango_ventas_credito_mensual

    const directivos_send = await enviaEncuestaEmail(info_email)

    if (!save) {
      logger.warn(`No se guardo la encuesta correctamente - ${fileMethod}`)
      return next(boom.unauthorized('No se guardo la encuesta correctamente'))
    }

    return res.json({
      save,
      contacto: res_mailjet.data,
      directivos: directivos_send.body
    })

  } catch (error) {
    logger.error(`No se inserto registro: ${JSON.stringify(error)} - ${fileMethod}`)
    next(error)
  }
}

const enviaEncuestaEmail = async (info_email) => {
  const fileMethod = `file: src/controllers/api/auth.js - method: enviaEncuestaEmail`
  try {
    const globalConfig = await utilitiesService.getParametros()
    let lista_contactos_encuesta = await globalConfig.find(item => item.nombre === 'lista_contactos_encuesta').valor
    lista_contactos_encuesta = JSON.parse(lista_contactos_encuesta)

    let email_sender_encuesta = await globalConfig.find(item => item.nombre === 'email_sender_encuesta').valor
    let password_email_sender_encuesta = await globalConfig.find(item => item.nombre === 'password_email_sender_encuesta').valor

    const transporter = nodemailer.createTransport({
      host: 'credibusiness.com',
      port: 465,
      secure: true,
      auth: {
        user: email_sender_encuesta,
        pass: password_email_sender_encuesta
      }
    })

    const htmlContent = `
    <p>Empresa: ${info_email.company}</p>
    <p>Nombre: ${info_email.nombre}</p>
    <p>Teléfono de la empresa: ${info_email.telefono_empresa}</p>
    <p>Teléfono personal: ${info_email.telefono_personal}</p>
    <p>Correo de contacto: ${info_email.correo_nombredeusuario}</p>
    <p>A la empresa le gustaría: ${info_email.me_gustaria}</p>
    <p>Número de clientes a crédito: ${info_email.numero_clientes_a_credito}</p>
    <p>Rango de ventas a crédito mensual: ${info_email.rango_ventas_credito_mensual}</p>
    `
    const mailOptions = {
      from: `"credibusiness" <${email_sender_encuesta}>`,
      to: lista_contactos_encuesta.map(d => d.Email).join(','),
      subject: 'Encuesta Empresa',
      html: htmlContent
    }

    const info = await transporter.sendMail(mailOptions)
    return info
  } catch (error) {
    logger.info(`Error en el envio de correo electronico: ${JSON.stringify(error)} - ${fileMethod}`)
  }
}

const enviaCorreoEncuestaEjecutivos = async (info_email) => {
  const fileMethod = `file: src/controllers/api/auth.js - method: enviaCorreoEncuestaEjecutivos`
  try {
    const globalConfig = await utilitiesService.getParametros()
    let lista_contactos_encuesta = await globalConfig.find(item => item.nombre === 'lista_contactos_encuesta').valor
    lista_contactos_encuesta = JSON.parse(lista_contactos_encuesta)

    logger.info(`Lista de directivos  de informe de encuesta: ${JSON.stringify(lista_contactos_encuesta)} - ${fileMethod}`)

    const variables = {
      company: info_email.company,
      contacto_usuario: info_email.correo_nombredeusuario,
      me_gustaria: info_email.me_gustaria,
      numero_clientes_a_credito: info_email.numero_clientes_a_credito,
      rango_ventas_credito_mensual: info_email.rango_ventas_credito_mensual
    }

    logger.info(`Variables con información de la encuesta: ${JSON.stringify(variables)} - ${fileMethod}`)

    const obj_request = {
      Messages: [
        {
          From: {
            Email: 'mkt@credibusiness.site',
            Name: 'credibusiness'
          },
          To: lista_contactos_encuesta,
          TemplateID: 6838242,
          TemplateLanguage: true,
          Variables: variables
        }
      ]
    }

    logger.info(`Objeto request para mailjet: ${JSON.stringify(obj_request)} - ${fileMethod}`)

    const mailjet_res = await mailjet
      .post('send', { version: 'v3.1' })
      .request(obj_request)

    return mailjet_res
  } catch (error) {
    console.log(error)
    return false
  }
}

exports.setTrueCronos = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/auth.js - method: setTrueCronos`;
  try {
    const { params } = req
    const { id_empresa } = params

    const updateCronos = await userServices.updateCronosEmpresa(id_empresa)
    if (!updateCronos) {
      logger.warn(`No se actualizo rdtstus cronos - ${fileMethod}`)
      return next(boom.unauthorized('No se actualizo rdtstus cronos'))
    }

    return res.json({
      updateCronos
    })

  } catch (error) {
    logger.error(`No se inserto registro: ${JSON.stringify(error)} - ${fileMethod}`)
    next(error)
  }
}

exports.getPermisos = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/auth.js - method: createRol`;
  try {
    const { id_rol } = req.params;

    const rows = await userServices.getPermisos(id_rol)
    if (!rows) {
      logger.warn(`No encontro el rol: ${JSON.stringify(id_rol)} - ${fileMethod}`)
      return next(boom.unauthorized('No se encontro el rol.'))
    }

    const response = {
      error: false,
      results: {
        rol: {
          id_rol: id_rol,
          nombre_rol: rows[0].nombre_rol, // Asumimos que el nombre del rol es el mismo para todas las filas
        },
        permisos: rows.map(row => {
          const permiso = {
            acceso: row.acceso
          };

          if (row.id_modulo) {
            permiso.modulo = {
              id_modulo: row.id_modulo,
              nombre_modulo: row.nombre_modulo
            };
          }
          if (row.id_submodulo) {
            permiso.submodulo = {
              id_submodulo: row.id_submodulo,
              nombre_submodulo: row.nombre_submodulo
            };
          }
          if (row.id_componente) {
            permiso.componente = {
              id_componente: row.id_componente,
              nombre_componente: row.nombre_componente
            };
          }
          if (row.id_subcomponente) {
            permiso.subcomponente = {
              id_subcomponente: row.id_subcomponente,
              nombre_subcomponente: row.nombre_subcomponente
            };
          }

          return permiso;
        }).filter(permiso =>
          permiso.modulo ||
          permiso.submodulo ||
          permiso.componente ||
          permiso.subcomponente
        ) // Filtrar permisos vacíos
      }
    }

    return res.json(response)

  } catch (error) {
    logger.error(`No se inserto registro: ${JSON.stringify(error)} - ${fileMethod}`)
    next(error)
  }
}




