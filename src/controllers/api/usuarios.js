'use strict'

const debug = require('debug')('old-api:user-controller')
const boom = require('boom')
const { globalAuth: { expiresTime, userSecretKey, refreshExpiresTime, refreshSecretKey }, email } = require('../../config')
const { externalJWTOptions: { secretKey: companySecretKey,  } } = require('../../config')
const jwt = require('jsonwebtoken')
const userService = require('../../services/users')
const companiesService = require('../../services/companies')
const followersService = require('../../services/followers')
const statisticsService = require('../../services/statistics')
const authService = require('../../services/auth')
const friendService = require('../../services/friends')
const { compare, encryptPassword } = require('../../utils/encryptPassword')
const sendgrid = require('../../lib/sendgrid')
const emailsTemplates = require('../../utils/templates/emails')
const { verifyToken } = require('../../utils/jwt')
const uploadImageS3 = require('../../utils/uploadImageS3')
const sns = require('../../utils/sns')
const { uuid } = require('uuid-base62')
const createTokenJWT = require('../../utils/createTokenJWT')
const cipher = require('../../utils/cipherService')
const utilitiesService = require('../../services/utilities')
const axios = require('axios')
const logger = require('../../utils/logs/logger')

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

exports.getUsers = async (req, res, next) => {
  const { query } = req

  try {
    const usuarios = await userService.get(query)
    res.status(200).json({
      error: false,
      results: usuarios
    })
  } catch (err) {
    next(err)
  }
}

exports.getLastUpdate = async (req, res, next) => {
  const { userId } = req.params
  try {
    let update = false;
    const [usuario] = await userService.getById(userId)
    if (!usuario) return next(boom.badRequest('No existe usuario con este ID'))

    if (usuario.usu_update == null) {
      update = true
    } else {
      const fecha = new Date(usuario.usu_update);
      const fechaActual = new Date();
      const diffMeses = (fechaActual.getFullYear() - fecha.getFullYear()) * 12 + fechaActual.getMonth() - fecha.getMonth();
      if (diffMeses >= 6) { // Aqui hay que manejar este valor como parametrizable a traves de un dashboard
        update = true
      } else {
        update = false
      }
    }

    res.status(200).json({
      error: false,
      update: update
    })

  } catch (error) {
    next(error)
  }
}

exports.getUserById = async (req, res, next) => {
  const { userId } = req.params
  try {
    const [usuario] = await userService.getById(userId)
    if (!usuario) return next(boom.badRequest('No existe usuario con este ID'))

    // Obtener detalle de empresa
    const [empresaUsuario] = await userService.getEmpresaByUserId(userId)
    const { emp_id: empresaId } = empresaUsuario
    const [empresa] = await companiesService.getEmpresa(empresaId)

    // Obtener amistades
    const amigos = await friendService.getFriends(userId)
    // Obtener seguidos
    const seguidos = await followersService.getFollowing(userId)
    // Obtener seguidores
    const seguidores = await followersService.getFollowers(userId)
    // Obtener mensajes no vistos
    const notSeen = await userService.getChatCompanyNotSeenMessages(userId)

    // Añadir información
    usuario.amigos = amigos
    usuario.seguidos = seguidos
    usuario.seguidores = seguidores
    usuario.empresa = empresa
    usuario.mensajes = {
      total: notSeen.length || 0,
      payload: notSeen
    }
    res.status(200).json({
      error: false,
      results: usuario
    })
  } catch (err) {
    next(err)
  }
}

exports.registerWithInvitation = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/usuarios.js - method: registerWithInvitation`
  try {
    const parsedData = typeof req.decryptedBody === 'string' ? JSON.parse(req.decryptedBody) : req.decryptedBody
    logger.info(`${fileMethod} | Datos recibidos: ${JSON.stringify(parsedData)}`)
    const { email, id_usuario, id_empresa, id_rol, nombre_usuario, apellido_usuario, perfil } = parsedData
    let usuario = {}

    const [existeEmpresa] = await companiesService.getEmpresaById(id_empresa)
    if (!existeEmpresa) return next(boom.badRequest('No existe empresa'))

    const [existeEmail] = await userService.getByEmail(email)
    if (existeEmail) return next(boom.badRequest('Email taken'))

    const [getUsuarioEnvia] = await userService.getUserById(id_usuario)

    const upperCase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const lowerCase = 'abcdefghijklmnopqrstuvwxyz'
    const digits = '0123456789'
    const specialChars = '!@#$%^&*()_+[]{};:,.<>?'
    const allChars = upperCase + lowerCase + digits + specialChars
    const passwordLength = Math.floor(Math.random() * 3) + 6
    let password = ''
    let hasSpecialChar = false

    while (!hasSpecialChar) {
      password = ''
      hasSpecialChar = false
      for (let i = 0; i < passwordLength; i++) {
        const randomChar = allChars.charAt(Math.floor(Math.random() * allChars.length))
        password += randomChar

        if (specialChars.includes(randomChar)) {
          hasSpecialChar = true
        }
      }
    }
    logger.info(`${fileMethod} | Password generado: ${password}`)

    const passCipher = await encryptPassword(password)
    usuario.nombre = nombre_usuario,
    usuario.apellido = apellido_usuario
    usuario.email = email
    usuario.telefono = ''
    usuario.password = passCipher
    usuario.tipo = id_rol
    const token = await jwt.sign(usuario, companySecretKey, { expiresIn: '30d' })
    usuario.token = token

    const nuevoUsuario = await userService.createUser(usuario, Number(perfil))
    logger.info(`${fileMethod} | Usuario creado con id: ${nuevoUsuario.insertId}`)
    await userService.confirmUser(nuevoUsuario.insertId)
    await companiesService.addUserToCompany(id_empresa, nuevoUsuario.insertId, id_rol)

    const request = {
      Name: `${nombre_usuario} ${apellido_usuario}`,
      Properties: {
        pasword_dinamico: password,
        nombre_quienenvia:  `${getUsuarioEnvia.usu_nombre} ${getUsuarioEnvia.usu_app }`,
        nombre_quienrecibe: `${nombre_usuario} ${apellido_usuario}`,
        empresa_quieninvita: existeEmpresa.empresa_nombre,
        correo_nombredeusuario: email
      },
      Action: 'addforce',
      Email: email
    }

    const secretKeyMailjet = await globalConfig.find(item => item.nombre === 'secretKeyMailjet').valor
    // const plantilla_invitacion_multiusuario = await globalConfig.find(item => item.nombre === 'plantilla_invitacion_multiusuario').valor
    const contactListMailjetMultiusers = await globalConfig.find(item => item.nombre === 'contactListMailjetMultiusers').valor
    const mailjetHeaders = { headers: { "Content-Type": "application/json", "Authorization": `Basic ${secretKeyMailjet}` } }
    const envioEmail = await axios.post(`https://api.mailjet.com/v3/REST/contactslist/${contactListMailjetMultiusers}/managecontact`, request, mailjetHeaders)
    logger.info(`${fileMethod} | Envío de email de invitación: ${envioEmail.status}`)

    const getUsuario = await userService.getUserById(nuevoUsuario.insertId)

    const encryptedResponse = await cipher.encryptData(JSON.stringify({
      error: false,
      results: {
        usuario: getUsuario
      }
    }))

    return res.status(200).send(encryptedResponse)

  } catch (error) {
    logger.error(`${fileMethod} | Error: ${typeof error === 'object' ? JSON.stringify(error) : error}`)
    next(error)
  }
}

exports.createUser = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const { body: { empresa, usuario } } = req

    const [existeEmpresa] = await companiesService.getEmpresa(empresa.rfc)
    if (!existeEmpresa) return next(boom.badRequest('No existe empresa'))

    const [existeEmail] = await userService.getByEmail(usuario.email)
    if (existeEmail) return next(boom.badRequest('Email taken'))

    const password = await encryptPassword(usuario.password)
    const token = Math.floor(100000 + Math.random() * 900000)
    usuario.password = password
    usuario.token = token

    const nuevoUsuario = await userService.createUser(usuario)
    let userType = 2
    if (usuario.tipo === 3) {
      userType = 1
    }

    userType = 4
    await companiesService.addUserToCompany(empresa.id, nuevoUsuario.insertId, userType)
    await companiesService.deleteCompanyInvitations(empresa.id, usuario.email)

    const name = `${usuario.nombre.trim()} ${usuario.apellido.trim()}`
    const msg = {
      to: `${name} <${usuario.email}>`,
      from: `${email.sender.name} <${email.sender.email}>`,
      replyTo: email.sender.replyTo,
      subject: 'Código de verificación',
      text: 'Recibe tu código de verificación de Market Choice B2B',
      html: emailsTemplates.validationCodeTemplate(token, usuario.nombre)
    }
    //await sendgrid(msg)
    const usuarioGenerado = Object.assign({}, usuario)
    delete usuarioGenerado.password
    delete usuarioGenerado.token

    res.status(200).json({
      error: false,
      results: {
        usuario: usuarioGenerado
      }
    })
  } catch (err) {
    next(err)
  }
}

exports.verifyReSend = async (req, res, next) => {
  try {
    debug('POST /api/usuarios/verificar/reenviar')
    const { body } = req
    const { user: userID, email } = body

    if ((!userID && !email) || (userID && email)) return next(boom.badRequest('Invalid user id or email'))

    let user = null

    if (userID) {
      debug(`Aqui va userID: ${userID}`)
      const [existUser] = await userService.getById(userID)
      if (!existUser) return next(boom.badRequest('User does not exists'))
      user = existUser
    } else {
      debug(`Aqui va email: ${email}`)
      const [existUser] = await userService.getByEmail(email)
      if (!existUser) return next(boom.badRequest('User does not exists'))
      user = existUser
    }

    const { token } = user
    if (!token) return next(boom.badRequest('Already verified'))

    const randomCode = Math.floor(100000 + Math.random() * 900000)
    await userService.updateCode(user.usu_id, randomCode)

    const msg = {
      to: `${user.usu_nombre} ${user.usu_app} <${user.usu_email}>`,
      from: `${email.sender.name} <${email.sender.email}>`,
      replyTo: `${email.sender.email}`,
      subject: 'Código de verificación',
      text: 'Recibe tu código de verificación de Market Choice B2B',
      html: emailsTemplates.validationCodeTemplate(randomCode, user.usu_nombre)
    }

    const phone = await userService.getUserPhoneByUsuId(user.usu_id)

    if (phone) {
      const text = `Market Choice B2B: Tú código de verificación es ${randomCode}`
      await sns({ text, phone: phone.usu_phone }).catch(error => debug(error))
    }

    await sendgrid(msg)

    res.status(200).json({
      error: false,
      results: {
        sent: true
      }
    })
  } catch (err) {
    next(err)
  }
}

exports.verify = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { body } = req

    const [userDetails] = await userService.getById(body.usuario_id)
    if (!userDetails) return next(boom.badRequest('Wrong user'))

    const msg = {
      to: `${userDetails.usu_nombre} ${userDetails.usu_app} <${userDetails.usu_email}>`,
      from: `${email.sender.name} <${email.sender.email}>`,
      replyTo: `${email.sender.email}`,
      subject: 'Gracias por registrarte en Market Choice B2B',
      text: 'Se ha completado tu registro',
      html: emailsTemplates.afterRegisterTemplate(userDetails.usu_nombre)
    }

    await sendgrid(msg)

    const { usu_tipo: userType } = userDetails
    if (userType === 1 || userType === 2) {
      const details = await userService.getUserAndCompanyDetails(userDetails.usu_id)
      const msgNew = {
        to: `${userDetails.usu_nombre} ${userDetails.usu_app} <${userDetails.usu_email}>`,
        from: `${email.sender.name} <${email.sender.email}>`,
        replyTo: `${email.sender.email}`,
        subject: 'Gracias por registrarte en Market Choice B2B',
        text: 'Se ha completado tu registro',
        html: emailsTemplates.welcomeNewUserTemplate(userDetails.usu_nombre, details.emp_nombre, userType)
      }
      await sendgrid(msgNew)
    }

    const result = await userService.verifyCode(body.usuario_id, body.code)

    // datos de login

    const loginID = uuid.v4()
    const device = 'web'

    const { token: sessionToken, tokenId: sessionTokId } = await createTokenJWT({
      mcId: body.usuario_id,
      gen: false,
      genToken: null,
      loginID
    }, expiresTime, userSecretKey[device])

    const { token: refreshToken, tokenId: refreshTokId } = await createTokenJWT({
      mcId: body.usuario_id,
      gen: false,
      genToken: null,
      loginID
    }, refreshExpiresTime, refreshSecretKey[device])

    await authService.registerRefToken(body.usuario_id, loginID, sessionTokId, refreshTokId, sessionToken, refreshToken)

    await statisticsService.registerUserLogin(body.usuario_id)

    const [resultByEmail] = await userService.getUserByEmail(userDetails.usu_email)
    if (!resultByEmail) return next(boom.notFound('User not found.'))

    const loginData = result ? { usu_token: { sessionToken, refreshToken }, usu: { ...resultByEmail } } : null

    res.status(200).json({
      error: false,
      results: {
        verificado: result || false,
        message: result ? 'Usuario verificado...' : 'Codigo incorrecto o no existe...',
        loginData
      }
    })
  } catch (err) {
    next(err)
  }
}

exports.updateUser = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const { body, params } = req
    let { userID } = params

    userID = Math.abs(userID) || 0

    const [user] = await userService.getUserPassword(userID)
    if (!user) return next(boom.badRequest('User does not exists'))

    const { usu_psw: usuPsw, new_pass: newPass, new_pass_confirm: newPassConfirm } = body
    if (usuPsw && newPass && newPassConfirm) {
      if (newPass !== newPassConfirm) return next(boom.badRequest('New password is incorrect'))
      const validPassword = await compare(usuPsw, user.usu_psw)
      if (validPassword) {
        body.usu_psw = await encryptPassword(newPass)
      } else {
        return next(boom.badRequest('Password incorrect'))
      }
    }

    delete body.new_pass
    delete body.new_pass_confirm
    if (body.usu_psw) body.usu_psw = await encryptPassword(newPass);

    const { usu_foto } = req.body;
    if (usu_foto) {
      const pathBucket = 'userImage'
      const url = await uploadImageS3.uploadImage2(usu_foto, pathBucket)
      body.usu_foto = url
    }
    const userUpdated = await userService.update(userID, body)
    res.status(200).json({
      error: false,
      results: userUpdated
    })
  } catch (err) {
    next(err)
  }
}

exports.verifyInvitation = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  const { body } = req

  try {
    const results = await companiesService.getCompanyInvitationsDetails(body)

    if (results.length === 1) {
      res.status(200).json({
        error: false,
        results: results[0]
      })
    } else {
      res.status(400).json({
        error: true,
        message: 'Datos incorrectos'
      })
    }
  } catch (err) {
    next(err)
  }
}

exports.requestChangePassword = async (req, res, next) => {
  try {
    const { body } = req
    const { email } = body

    const device = 'web'

    const [usuario] = await userService.getByEmail(email)
    if (!usuario) return next(boom.badRequest('Invalid email'))
    const { token } = await createTokenJWT({
      mcId: usuario.usu_id,
      gen: false,
      genToken: null,
      email: usuario.usu_email
    }, '30m', userSecretKey[device])

    const insert = await userService.saveTokenNewPass(token, usuario)

    return res.json({
      ok: true,
      results: {
        id_token: insert.insertId,
        email,
        token
      }
    })
  } catch (err) {
    next(err)
  }
}

exports.changePassword = async (req, res, next) => {
  try {
    const { body: { password }, params: { token } } = req
    const device = 'web'
    const tokenValido = jwt.verify(token, userSecretKey[device])
    if (!tokenValido) return next(boom.badRequest('Invalid token'))

    const { mcId, email } = tokenValido

    const [tokenBd] = await userService.getTokenByToken(token)
    if (tokenBd.registros != 1) return next(boom.badRequest('El token no pertenece a CB'))

    const [usuario] = await userService.getByEmail(email)
    if (!usuario) return next(boom.badRequest('Invalid email'))

    await userService.updateTokenEstatusReset(token)

    const newPassword = await encryptPassword(password)

    const { affectedRows: cambiadas } = await userService.updatePassword(mcId, newPassword)
    if (cambiadas !== 1) return next(boom.badRequest('Error updating password'))

    return res.json({
      ok: true,
      results: {
        updated: true
      }
    })
  } catch (err) {
    next(err)
  }
}

exports.usr2Admin = async (req, res, next) => {
  try {
    const { params: { usrId: usrIdRaw } } = req
    const usrId = Math.abs(usrIdRaw) || 0

    const [usuario] = await userService.getById(usrId)
    if (!usuario) return next(boom.badRequest('User not found'))

    const { usu_tipo: usuarioType, tipo: empresaUsuarioType } = await userService.getUserTypeById(usrId)
    if (usuarioType === 3 && empresaUsuarioType === 1) return next(boom.badRequest('User is already admin.'))

    const { affectedRows } = await userService.makeUsr2Admin(usrId)
    if (affectedRows !== 2) return next(boom.badRequest('Error updating user. Check usuario or empresa_usuario tables.'))

    return res.json({
      error: false,
      results: {
        updated: true
      }
    })
  } catch (error) {
    next(error)
  }
}

exports.getOneUserById = async function (req, res, next) {
  const { userId } = req.params

  if (isNaN(userId) || !userId) return next(boom.badRequest('Invalid user id.'))

  const [usuario] = await userService.getById2(userId)
  if (!usuario) return next(boom.badRequest('User not found'))

  return res.json({
    ...usuario
  })
}

exports.getUsersByIdCompanie = async (req, res, next) => {
  const fileMethod = `file: src/controllers/usuarios.js - method: getUsersByIdCompanie`
  try {
    const { id_companie } = req.params
    if (isNaN(id_companie) || !id_companie) return next(boom.badRequest('Invalid companie id.'))

    const usuarios = await userService.getUsersByIdCompanie(id_companie)

    usuarios.forEach(usuario => {
      if(JSON.parse(usuario.array_permisos).includes('90')) {
        usuario.owner = true
      } else {
        usuario.owner = false
      }
    })

    const encryptedResponse = await cipher.encryptData(JSON.stringify({
      error: false,
      results: {
        usuarios
      }
    }))

    return res.status(200).send(encryptedResponse)
  } catch (error) {
    next(error)
  }
}

exports.getPermisos = async (req, res, next) => {
  const fileMethod = `file: src/controllers/usuarios.js - method: getPermisos`
  try {
    const modulos = await userService.getModulos()

    return res.status(200).json({
      error: false,
      results: modulos
    })
  } catch (error) {
    next(error)
  }
}

exports.createPerfilPermisos = async (req, res, next) => {
  const fileMethod = `file: src/controllers/usuarios.js - method: createPerfilPermisos`
  try {

    const { emp_id, descripcion, array_permisos, info_perfil } = req.body

    await userService.creatPermisos(emp_id, descripcion, array_permisos, info_perfil);

    return res.status(200).json({
      error: false,
      results: "Perfil creado con éxito."
    })
  } catch (error) {
    console.log(error);
    next(error)
  }
}

exports.getPerfilesPermisosByEmpresa = async (req, res, next) => {
  try {

    const { emp_id } = req.params;

    const perfiles = await userService.getPerfilesPermisosByEmpresa(emp_id);

    return res.status(200).json({
    error: false,
    results: perfiles
    })

  } catch (error) {
    console.log(error);
    next(error)
  }
}

exports.getPermisosByUserId = async (req, res, next) => {
  const fileMethod = `file: src/controllers/usuarios.js - method: getPermisosByUserId`
  try {
    const { userId } = req.params

    if (isNaN(userId) || !userId) return next(boom.badRequest('Invalid user id.'))

    const { result } = await userService.getPermisosById(userId)
    if (!result) return next(boom.badRequest('User not found'))

    return res.status(200).json({
      error: false,
      results: result
    })
  } catch (error) {
    next(error)
  }
}

exports.updatePermisos = async (req, res, next) => {
  const fileMethod = `file: src/controllers/usuarios.js - method: updatePermisos`
  try {

    const { perfil_permisos_id } = req.body
    const { userId } = req.params

    if (isNaN(userId) || !userId) return next(boom.badRequest('Invalid user id.'))

    await userService.updatePermisos(userId, perfil_permisos_id);

    return res.status(200).json({
      error: false,
      results: 'updatedUser'
    })
  } catch (error) {
    next(error)
  }
}

exports.updatePerfilPermisos = async (req, res, next) => {
  const fileMethod = `file: src/controllers/usuarios.js - method: updatePerfilPermisos`
  try {

    const { array_permisos, descripcion, info_perfil } = req.body
    const { id } = req.params

    if (isNaN(id) || !id) return next(boom.badRequest('Invalid user id.'))

    await userService.updatePerfilPermisos(id, array_permisos, descripcion, info_perfil);

    return res.status(200).json({
      error: false,
      results: 'updatedPerfil'
    })
  } catch (error) {
    next(error)
  }
}