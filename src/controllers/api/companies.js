'use strict'

const debug = require('debug')('old-api:companies-router')
const boom = require('boom')
const jwt = require('jsonwebtoken')
const { externalJWTOptions: { secretKey: companySecretKey, expiresTime: companyExpiresTime }, email } = require('../../config')
const { globalAuth: { keyCipher } } = require('../../config')
const companiesService = require('../../services/companies')
const userService = require('../../services/users')
const productService = require('../../services/products')
const eventsService = require('../../services/events')
const statisticService = require('../../services/statistics')
const tokensService = require('../../services/tokens')
const { validRegex } = require('../../utils/regex')
const { encryptPassword } = require('../../utils/encryptPassword')
const sendgrid = require('../../lib/sendgrid')
const validationCode = require('../../utils/templates/emails/validationCode')
const { invitationTemplate, invitationToBecomeAdminTemplate } = require('../../utils/templates/emails')
const uploadVideoS3 = require('../../utils/uploadVideoS3')
const sns = require('../../utils/sns')
const utilitiesService = require('../../services/utilities')
const axios = require('axios')
const { callKoneshApi } = require('./konesh')
const createTokenJWT = require('../../utils/createTokenJWT')
const validateEmailRegex = require('../../utils/validateEmailRegex')
const koneshService = require('../../services/konesh')
const CryptoJS = require('crypto-js')
const logger = require('../../../src/utils/logs/logger')
const bcrypt = require('bcrypt')

const cipher = require('../../utils/cipherService')

const { asignarSolicitudCreditoExterno } = require('../../controllers/api/solicitud-credito')

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

exports.getEvalById = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {

    /**
     * usuario desde --> Aquí va la fecha de su registro en la plataforma
    créditos otorgados --> Aquí será la suma de todos los créditos que este uruario ha otorgado, va ligada al historial de la cartera de clientes (se hace ala suma de todos los créditos otorgados a lo largo del tiempo desde su registro)
    operaciones realizadas --> La suma de todas sus operaciones (Cotizaciones vendidas / Cotizaciones compradas)
    plazo de crédito --> Este será el tiempo promedio que el proveedor otorga para un crédito, se calculará conforme a sus créditos otorgados. (Duración del crédito)
    tiempo de aprobación --> es el tiempo aproximado en el que se tardaa este proveedor en otorgar un crédito (Tiempo en iniciar y aprobar una línea de crédito)
    entrega a tiempo --> Porcentaje de entragas en tiempo que obtenemos del número de entregas d emercancía o producots en tiempo
    */

    // usuario_desde -> created_at de tabla usuario
    // creditos_otorgados ->  Pendiente
    // operaciones_realizadas -> validar el estatus antiguo d ela cotizacion
    // plazo_credito -> pendiente
    // tiempo_aprobacion -> pendiente
    // entrega_tiempo -> 
  } catch (error) {

  }
}

exports.getCompanies = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const results = await companiesService.getEmpresas()
    return res.json({
      error: false,
      results
    })
  } catch (err) {
    next(err)
  }
}

const tokenRegister = async (body) => {
  try {
    return jwt.sign(body, companySecretKey, { expiresIn: '30d' })
  } catch (error) {

  }
}

const cifra_konesh = async (str) => {
  try {
    logger.info(`El texto a cifrar: ${str}`)
    if (!str || typeof str !== 'string' || str.trim() === '') {
      throw new Error('La cadena de entrada es inválida o está vacía')
    }

    const globalConfig = await utilitiesService.getParametros()
    const keyCrypDecrypt = await globalConfig.find(item => item.nombre === 'konesh_keyCrypDecrypt').valor

    logger.info(`Se obtiene la llave para cifrar de la BD: ${keyCrypDecrypt}`)

    if (!keyCrypDecrypt) {
      logger.error(`No se encontró la llave de desencriptación`)
      throw new Error('No se encontró la llave de desencriptación')
    }

    const hashedKey = CryptoJS.SHA512(keyCrypDecrypt).toString(CryptoJS.enc.Hex)
    logger.info(`Se obtiene el hash de la llave ${hashedKey}`)

    const keyBytes = CryptoJS.enc.Hex.parse(hashedKey.substring(0, 64))
    logger.info(`Se convierte a bytes: ${keyBytes}`)

    const ciphertext = CryptoJS.AES.encrypt(
      str,
      keyBytes,
      { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 }
    )

    logger.info(`Cadena cifrada sin codificar: ${ciphertext}`)

    const encryptedText = ciphertext.ciphertext.toString(CryptoJS.enc.Base64)
    logger.info(`Cadena cifrada codificada: ${encryptedText}`)

    if (!encryptedText) {
      logger.info(`No se pudo cifrar el texto: ${encryptedText}`)
      throw new Error('No se pudo cifrar el texto')
    }

    return encryptedText

  } catch (error) {
    logger.info(`Ocurrio un error al ifrar cadena: ${error} -  ${fileMethod}`)
    return null
  }
}

const descifra_konesh = async (str) => {
  try {
    if (!str || typeof str !== 'string' || str.trim() === '') {
      throw new Error('La cadena de entrada es inválida o está vacía')
    }

    const globalConfig = await utilitiesService.getParametros()
    const keyCrypDecrypt = await globalConfig.find(item => item.nombre === 'konesh_keyCrypDecrypt').valor

    if (!keyCrypDecrypt) {
      throw new Error('No se encontró la llave de desencriptación');
    }

    const hashedKey = CryptoJS.SHA512(keyCrypDecrypt).toString(CryptoJS.enc.Hex)
    const keyBytes = CryptoJS.enc.Hex.parse(hashedKey.substring(0, 64))

    const encryptedBytes = CryptoJS.enc.Base64.parse(str)
    const decryptedBytes = CryptoJS.AES.decrypt(
      { ciphertext: encryptedBytes },
      keyBytes,
      { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 }
    )

    const originalText = decryptedBytes.toString(CryptoJS.enc.Utf8)

    if (!originalText) {
      throw new Error('No se pudo desencriptar el texto')
    }

    return originalText

  } catch (error) {
    return null
  }
}

exports.createCompany = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/companies.js - method: createCompany`
  try {
    const { empresa, usuario, meta, codigo_promocion } = req.body
    const { rfc } = empresa
    let codigo_estatus = true
    let message = 'Registro correcto'
    let codigo = []


    if (codigo_promocion.length) {
      // Se hace la busqueda del codigo ingresado y se validan las siguientes caracteristicas:
      //  - Codigo este vigente
      [codigo] = await companiesService.getCodigoVigente(codigo_promocion)
      if (!codigo) {
        codigo_estatus = false
        message = 'El codigo ingresado no es valido o ya ha caducado'
        return next(boom.badRequest(message))
      }

      // Si la consulta regresa resultados quiere decir que el codigo esta vigente,
      // por lo tanto el valor que regresa se puede utilizar para el siguiente proceso
    }

    usuario.email = usuario.email.trim().toLowerCase()
    const isEmailFormatValid = validateEmailRegex(usuario.email)

    if (!isEmailFormatValid) return next(boom.badRequest('Provided email is from a public service or has an invalid format.'))

    empresa.rfc = empresa.rfc.trim().toUpperCase()

    const existeEmpresa = await companiesService.findRFC(empresa.rfc)
    const existeUsuario = await userService.getByEmail(usuario.email)

    if (existeEmpresa.length !== 0) return next(boom.badRequest('RFC already exists.'))
    if (existeUsuario.length !== 0) return next(boom.badRequest('Email taken.'))

    // Valida RFC con KONESH
    const konesh_api_des = {}

    const globalConfig = await utilitiesService.getParametros()
    const konesh_url_valid_rfc = await globalConfig.find(item => item.nombre === 'konesh_url_valid_rfc').valor

    logger.info(`Se obtiene URL Konesh de BD: ${konesh_url_valid_rfc} -  ${fileMethod}`)

    const textCifrado = await cifra_konesh(rfc)
    logger.info(`Se cifra el rfc recibido: ${textCifrado} -  ${fileMethod}`)
    if (textCifrado === null) {
      return next(boom.badRequest(`Ocurrio un error al intentar cifrar el texto claro`))
    }

    const request = {
      "credentials": {
        "usuario": await globalConfig.find(item => item.nombre === 'konesh_usuario').valor,
        "token": await globalConfig.find(item => item.nombre === 'konesh_token').valor,
        "password": await globalConfig.find(item => item.nombre === 'konesh_password').valor,
        "cuenta": await globalConfig.find(item => item.nombre === 'konesh_cuenta').valor,
      },
      "issuer": {
        "rfc": await globalConfig.find(item => item.nombre === 'konesh_issuer').valor,
      },
      "list": {
        "list": [textCifrado]
      }
    }
    logger.info(`Se forma el request para consumir konesh - ${JSON.stringify(request)} - ${fileMethod}`)

    const konesh_api = await callKoneshApi(rfc, globalConfig)
    if (konesh_api.status === 200) {
      logger.info(`Respuesta Konesh: ${JSON.stringify(konesh_api.data)} - ${fileMethod}`)
      konesh_api_des.transactionResponse01 = [
        {
          data01: await descifra_konesh(konesh_api.data.transactionResponse01[0].data01),
          data02: await descifra_konesh(konesh_api.data.transactionResponse01[0].data02),
          data03: await descifra_konesh(konesh_api.data.transactionResponse01[0].data03),
          data04: await descifra_konesh(konesh_api.data.transactionResponse01[0].data04),
          data05: await descifra_konesh(konesh_api.data.transactionResponse01[0].data05)
        }
      ]
      konesh_api_des.transactionResponse02 = await descifra_konesh(konesh_api.data.transactionResponse02)
      konesh_api_des.transactionResponse03 = await descifra_konesh(konesh_api.data.transactionResponse03)
      konesh_api_des.transactionResponse04 = await descifra_konesh(konesh_api.data.transactionResponse04)

      logger.info(`Respuesta descifrada Konesh: ${JSON.stringify(konesh_api_des)} - ${fileMethod}`)

      if (await descifra_konesh(konesh_api.data.transactionResponse01[0].data02) == 'false') {
        logger.info(`Respuesta de servicio: ${JSON.stringify(konesh_api_des)} - ${fileMethod}`)
        message = 'El rfc no es valido'
        // return next(boom.badRequest(message))
      }
    }

    // usuario.password = await encryptPassword(usuario.password.trim())
    logger.info(`Pasword a cifrar: ${JSON.stringify(usuario.password.trim())} - ${fileMethod}`)

    usuario.password = await bcrypt.hash(usuario.password.trim(), 10)
    logger.info(`Pasword cifrado: ${JSON.stringify(usuario.password)} - ${fileMethod}`)

    usuario.token = await tokenRegister(req.body)
    if (!usuario.token) return next(boom.badRequest('Ocurrio un error al generar el token de registro'))

    const nuevaEmpresa = await companiesService.addEmpresa(empresa)
    const nuevoUsuario = await userService.createAdminUser(usuario)

    const admin = 1

    await companiesService.addUserToCompany(nuevaEmpresa.insertId, nuevoUsuario.insertId, admin)
    if (meta) await companiesService.insertRequestOrigin(nuevaEmpresa.insertId, meta.from, meta.id)

    const { telefono: phone } = usuario

    const [empresaDatos] = await companiesService.getEmpresa(nuevaEmpresa.insertId)
    const [usuarioDatos] = await userService.getAllDataById(nuevoUsuario.insertId)

    delete empresaDatos.reg_active

    if (empresa?.rfc && nuevaEmpresa?.insertId) asignarSolicitudCreditoExterno(empresa.rfc, nuevaEmpresa.insertId)

    if (codigo && codigo.codigo && codigo.codigo.length) {
      const valida_credito = await companiesService.validaCredito(nuevaEmpresa, codigo)
      const guarda_credito = await companiesService.saveCredito(nuevaEmpresa, codigo)
    }

    return res.json({
      message,
      empresa: empresaDatos,
      usuario: usuarioDatos,
      token: usuario.token
    })
  } catch (err) {
    console.log(err);
    next(err)
  }
}

exports.getFavoriteCompanies = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { query } = req
    let { user, number, page } = query
    user = Number(user) || 0
    number = Number(number) || 10
    page = Number(page) || 1

    const favorites = await companiesService.getFavoriteCompaniesByUser(user, number, page)

    return res.json({
      error: false,
      results: {
        page,
        total: favorites.length || 0,
        favorites
      }
    })
  } catch (err) {
    next(err)
  }
}

/**
 * Este metodo es utilizado en el metodo getCompanyByID
 * Para el endpoint http://localhost:3000/api/companies/66
 * @param {*} objeto 
 * @returns 
 */
const buildNewEmpresa = async (objeto) => {
  try {
    let nuevoObjeto = { ...objeto };
    delete nuevoObjeto.redes_sociales;
    const redesSociales = objeto.redes_sociales.split('|');
    nuevoObjeto.redes_sociales = redesSociales.map(redSocial => {
      const [nombre, enlace, icono] = redSocial.split('-');
      return { nombre, enlace, icono };
    });
    return nuevoObjeto;
  } catch (error) {
    console.log(error)
  }
}

exports.getCompanyByIDV2 = async (req, res, next) => {
  try {
    const { params } = req
    const { id } = params
    const [empresaOld] = await companiesService.getEmpresa(id)
    if (!empresaOld) return next(boom.badRequest('No existe empresa'))

    const empresa = await buildNewEmpresa(empresaOld)

    const domicilios = await companiesService.getEmpresaDomicilios(id)
    const [horario] = await companiesService.getEmpresaHorario(id)
    const fotos = await companiesService.getEmpresaFotos(id)
    const valores = await companiesService.getEmpresaValores(id, 1)
    const empleados = await companiesService.getCompanyUsers(id)

    /**
    * Al traer los empleados pro el id de la empresa
    * Se obtiene como dato relevante para la parte del filtrado por 
    * (vendedores, compradores y administradores) se obtiene directamente
    * de la tabla de usuarios y no de la tabla emprersa_usuario que tambien tiene un campo de tpo
    */

    const vendedores = empleados.filter(e => e.usu_tipo === 1)
    const compradores = empleados.filter(e => e.usu_tipo === 2)
    const administradores = empleados.filter(e => e.usu_tipo === 3)

    /**
     * En la siguiente validación  se obtendra si es jefe de ventas
     * o jefe de compras
     * estos valores se obtienen de la tabla empresa_usuario del campo tipo
     * el tipo 3 es jefe de ventas
     * el tipo 4 es jefe de compras
     */

    const jefeVentas = await userService.getJefeArea(id, 3)
    const jefeCompras = await userService.getJefeArea(id, 4)
    console.log(domicilios);

    for (let i = 0; i < domicilios.length; i++) {
      const id = domicilios[i].domicilio_id
      domicilios[i].telefonos = await companiesService.getEmpresaDomicilioTelefonos(id)
    }

    for (let i = 0; i < vendedores.length; i++) {
      const { usu_id: userID } = vendedores[i]
      // Ventas totales
      const historicalSales = await statisticService.getHistoricalSalesV2(userID)
      vendedores[i].ventasTotales = historicalSales
      // Posibles ventas
      const posiblesVentas = await statisticService.getSalesAmountCurrentMonthV2(userID)
      vendedores[i].posiblesVentas = posiblesVentas
    }

    for (let i = 0; i < compradores.length; i++) {
      const { usu_id: userID } = compradores[i]
      // Compras totales
      const { totalAmount } = await statisticService.getHistoricalPurchasesV2(userID)
      compradores[i].comprasTotales = totalAmount
      // Posibles compras
      const posiblesCompras = await statisticService.getPossiblePurchasesCurrentMonthV2(userID)
      compradores[i].posiblesCompras = posiblesCompras
    }

    empresa.direcciones = domicilios
    empresa.horario = horario
    empresa.fotos = fotos
    empresa.valores = valores
    empresa.empleados = { vendedores, compradores, administradores }
    empresa.jefes = { jefeVentas, jefeCompras }

    return res.json({
      error: false,
      empresa
    })
  } catch (error) {
    next(error)
  }
}

exports.getCompanyByID = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { params } = req
    const { id } = params
    const [empresaOld] = await companiesService.getEmpresa(id)
    const empresa = await buildNewEmpresa(empresaOld)

    if (!empresa) return next(boom.badRequest('No hay empresa'))
    const domicilios = await companiesService.getEmpresaDomicilios(id)
    const [horario] = await companiesService.getEmpresaHorario(id)
    const fotos = await companiesService.getEmpresaFotos(id)
    const valores = await companiesService.getEmpresaValores(id, 1)
    const empleados = await companiesService.getCompanyUsers(id)

    const vendedores = empleados.filter(e => e.usu_tipo === 1)
    const compradores = empleados.filter(e => e.usu_tipo === 2)
    const administradores = empleados.filter(e => e.usu_tipo === 3)

    const jefeVentas = await userService.getJefeArea(id, 3)
    const jefeCompras = await userService.getJefeArea(id, 4)

    for (let i = 0; i < domicilios.length; i++) {
      const id = domicilios[i].domicilio_id
      domicilios[i].telefonos = await companiesService.getEmpresaDomicilioTelefonos(id)
    }

    for (let i = 0; i < vendedores.length; i++) {
      const { usu_id: userID } = vendedores[i]
      // Ventas totales
      const historicalSales = await statisticService.getHistoricalSales(userID)
      vendedores[i].ventasTotales = historicalSales
      // Posibles ventas
      const posiblesVentas = await statisticService.getSalesAmountCurrentMonth(userID)
      vendedores[i].posiblesVentas = posiblesVentas
    }

    for (let i = 0; i < compradores.length; i++) {
      const { usu_id: userID } = compradores[i]
      // Compras totales
      const { totalAmount } = await statisticService.getHistoricalPurchases(userID)
      compradores[i].comprasTotales = totalAmount
      // Posibles compras
      const posiblesCompras = await statisticService.getPossiblePurchasesCurrentMonth(userID)
      compradores[i].posiblesCompras = posiblesCompras
    }

    empresa.direcciones = domicilios
    empresa.horario = horario
    empresa.fotos = fotos
    empresa.valores = valores
    empresa.empleados = { vendedores, compradores, administradores }
    empresa.jefes = { jefeVentas, jefeCompras }

    return res.json({
      error: false,
      empresa
    })
  } catch (err) {
    next(err)
  }
}

exports.actualizaListaContactos = async (req, res, next) => {
  try {
    const lista_contactos = await companiesService.getAllUsers()
    const resApi = []
    for (let c of lista_contactos) {
      const request = {
        Name: c.usuario_nombre,
        Properties: {
          company: c.empresa_nombre,
          empresa_investigada: '',
          empresa_referencia_comercial: '',
          firstname: c.usuario_nombre,
          country: ''
        },
        Action: 'addforce',
        Email: c.usu_email
      }

      const secretKeyMailjet = await globalConfig.find(item => item.nombre === 'secretKeyMailjet').valor
      const contactListMailjet = await globalConfig.find(item => item.nombre === 'contactListMailjet').valor
      const mailjetHeaders = { headers: { "Content-Type": "application/json", "Authorization": `Basic ${secretKeyMailjet}` } }
      const res_api = await axios.post(`https://api.mailjet.com/v3/REST/contactslist/${contactListMailjet}/managecontact`, request, mailjetHeaders)
      if (res_api.status == 201) {
        resApi.push(res_api)
      }
    }

    const removeCircularReferences = (key, value) => {
      if (key === 'request' || key === 'res' || key === 'req' || key === 'socket') {
        return undefined
      }
      return value
    }
    const cleanResApi = JSON.stringify(resApi, removeCircularReferences)

    return res.json({
      error: false,
      resApi: JSON.parse(cleanResApi)
    })
  } catch (err) {
    next(err)
  }
}

exports.editCompany = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const body = typeof req.decryptedBody === 'string' ? JSON.parse(req.decryptedBody) : req.decryptedBody
    const { id_usuario } = body
    const { params } = req
    const { id } = params
    const [datos_usuario] = await companiesService.getUsuariosById(id_usuario)
    const [datos_empresa] = await companiesService.getCompanyByID(id)

    const { rfc, razon_social } = body

    const konesh_api = await callKoneshApi(rfc, globalConfig, { emp_id: id, razon_social_req: razon_social })
    if (konesh_api.status === 200) {
      const rfcValid = await descifra_konesh(konesh_api.data.transactionResponse01[0].data02)
      const razonSat = await descifra_konesh(konesh_api.data.transactionResponse01[0].data04)

      if (rfcValid === 'false') {
        return next(boom.badRequest('El rfc no es valido'))
      }

      if (razonSat !== razon_social) {
        return next(boom.badRequest('La razón social proporcionada no coincide con la registrada en el SAT'))
      }
    } else {
      return next(boom.badRequest(`Ocurrio un error al consumir konesh: ${konesh_api.status}`))
    }

    const results = await companiesService.editEmpresa(id, body)

    const [valores] = await companiesService.getEmpresaValores(id)
    if (valores) {
      await companiesService.editEmpresaDetalles(id, body)
    } else {
      await companiesService.addEmpresaDetalles(id, body)
    }


    const request = {
      Name: datos_usuario.usuario_nombre,
      Properties: {
        company: datos_empresa.empresa_nombre,
        empresa_investigada: '',
        empresa_referencia_comercial: '',
        firstname: datos_usuario.usuario_nombre,
        country: ''
      },
      Action: 'addforce',
      Email: datos_usuario.usu_email
    }

    const secretKeyMailjet = await globalConfig.find(item => item.nombre === 'secretKeyMailjet').valor
    const contactListMailjet = await globalConfig.find(item => item.nombre === 'contactListMailjet').valor
    const mailjetHeaders = { headers: { "Content-Type": "application/json", "Authorization": `Basic ${secretKeyMailjet}` } }
    await axios.post(`https://api.mailjet.com/v3/REST/contactslist/${contactListMailjet}/managecontact`, request, mailjetHeaders)


    const encryptedResponse = await cipher.encryptData(JSON.stringify({
      error: false,
      results
    }), keyCipher);

    res.send(encryptedResponse);
  } catch (err) {
    next(err)
  }
}

exports.createSchedule = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { body, params } = req
    const { id } = params

    const [esAdmin] = await userService.getEmpresaAdmin(id, body.id)
    if (!esAdmin) return next(boom.badRequest('Must be admin'))

    const [usuarioPerteneceEmpresa] = await userService.getEmpresaByUserId(body.id)
    if (!usuarioPerteneceEmpresa) return next(boom.badRequest('El usuario no pertenece a la empresa o no existe'))

    const [existeHorario] = await companiesService.getEmpresaHorario(id)
    if (existeHorario) return next(boom.badRequest('La empresa ya cuenta con un horario'))

    await validRegex('^([0-1][0-9]|[2][0-3]):([0-5][0-9])$', body.horario)
    const results = await companiesService.addEmpresaHorario(id, body.horario)
    return res.json({
      error: false,
      results
    })
  } catch (err) {
    next(err)
  }
}

exports.editSchedule = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { body, params } = req
    const { id } = params

    const [esAdmin] = await userService.getEmpresaAdmin(id, body.id)
    if (!esAdmin) return next(boom.badRequest('Must be admin'))

    const [usuarioPerteneceEmpresa] = await userService.getEmpresaByUserId(body.id)
    if (!usuarioPerteneceEmpresa) return next(boom.badRequest('El usuario no pertenece a la empresa o no existe'))

    await validRegex('^([0-1][0-9]|[2][0-3]):([0-5][0-9])$', body.horario)
    const results = await companiesService.updateEmpresaHorario(params.id, body.horario)
    return res.json({
      error: false,
      results
    })
  } catch (err) {
    next(err)
  }
}

exports.createAddress = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { body, params } = req
    const { id, direcciones } = body

    const [esAdmin] = await userService.getEmpresaAdmin(params.id, id)
    if (!esAdmin) return next(boom.badRequest('Must be admin'))

    const [usuarioPerteneceEmpresa] = await userService.getEmpresaByUserId(id)
    if (!usuarioPerteneceEmpresa) return next(boom.badRequest('El usuario no pertenece a la empresa o no existe'))

    const results = []
    for (let i = 0; i < direcciones.length; i++) {
      const result = await companiesService.addEmpresaDomicilio(params.id, direcciones[i])
      const telefonos = direcciones[i].telefonos
      if (telefonos) {
        const direccion = result.insertId
        for (let j = 0; j < telefonos.length; j++) {
          await companiesService.addEmpresaDomicilioTelefono(direccion, telefonos[j])
        }
      }
      results.push(result)
    }
    return res.json({
      error: false,
      results
    })
  } catch (err) {
    next(err)
  }
}

exports.editAddress = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { body, params } = req
    const { id, address } = params

    const [esAdmin] = await userService.getEmpresaAdmin(id, body.id)
    if (!esAdmin) return next(boom.badRequest('Must be admin'))

    const [usuarioPerteneceEmpresa] = await userService.getEmpresaByUserId(body.id)
    if (!usuarioPerteneceEmpresa) return next(boom.badRequest('El usuario no pertenece a la empresa o no existe'))

    for (const key of ['estado', 'nombre', 'direccion', 'google_id']) {
      const d = body[key]
      if (d === '' || d === undefined || d === null) {
        return next(boom.badRequest(`Ẁrong format: ${key} ${d}`))
      }
    }

    const results = await companiesService.editEmpresaDomicilio(address, body, id)

    return res.json({
      error: false,
      results
    })
  } catch (err) {
    next(err)
  }
}

exports.deleteAddress = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { body, params } = req
    const { id } = params
    const { direcciones } = body

    const results = []
    for (let i = 0; i < direcciones.length; i++) {
      const result = await companiesService.deleteEmpresaDomicilio(direcciones[i], id)
      results.push(result)
    }

    return res.json({
      error: false,
      results
    })
  } catch (err) {
    next(err)
  }
}

exports.setAddressAsMain = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { params } = req
    const { id, address } = params

    const tipoCorporativo = 1
    const tipoSucursal = 2

    const corporativo = await companiesService.getEmpresaCorporativo(params.id)
    const results = []
    if (corporativo.length !== 0) {
      const result = await companiesService.changeEmpresaTipoDomicilio(corporativo[0].domicilio_id, tipoSucursal, id)
      results.push(result)
    }

    const result = await companiesService.changeEmpresaTipoDomicilio(address, tipoCorporativo, id)
    results.push(result)

    return res.json({
      error: false,
      results
    })
  } catch (err) {
    next(err)
  }
}

exports.createPhone = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { body, params } = req
    const { id, address } = params
    const { telefonos } = body

    const pertenece = await companiesService.getEmpresaDomicilioPertenece(id, address)

    if (pertenece.length === 0) {
      return next(boom.badRequest('Wrong company or address'))
    }
    const results = []
    for (let i = 0; i < telefonos.length; i++) {
      const result = await companiesService.addEmpresaDomicilioTelefono(address, telefonos[i])
      results.push(result)
    }

    return res.json({
      error: false,
      results
    })
  } catch (err) {
    next(err)
  }
}

exports.deletePhone = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { body, params } = req
    const { id, address } = params
    const { telefonos } = body

    const [pertenece] = await companiesService.getEmpresaDomicilioPertenece(id, address)
    if (!pertenece) return next(boom.badRequest('Wrong company or address'))

    const results = []
    for (let i = 0; i < telefonos.length; i++) {
      const result = await companiesService.deleteEmpresaDomicilioTelefono(address, telefonos[i])
      const { affectedRows } = result
      if (affectedRows === 1) {
        results.push(telefonos[i])
      }
    }

    return res.json({
      error: false,
      results
    })
  } catch (err) {
    next(err)
  }
}

exports.editPhone = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { body, params } = req
    const { id, address, phone } = params
    const { numero } = body

    const pertenece = await companiesService.getEmpresaDomicilioPertenece(id, address)

    if (pertenece.length === 0) {
      return next(boom.badRequest('Wrong company or address'))
    }

    const results = await companiesService.editEmpresaDomicilioTelefono(phone, numero, address)

    return res.json({
      error: false,
      results
    })
  } catch (err) {
    next(err)
  }
}

exports.getCompanyUsers = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { params } = req
    const { id } = params

    const results = await companiesService.getCompanyUsers(id)
    const vendedores = results.filter(r => r.usu_tipo === 1)
    const compradores = results.filter(r => r.usu_tipo === 2)
    const admin = results.filter(r => r.usu_tipo === 3)
    const jefeVentas = await userService.getJefeArea(id, 3)
    const jefeCompras = await userService.getJefeArea(id, 4)

    return res.json({
      error: false,
      results: {
        admin,
        vendedores,
        compradores,
        jefeVentas,
        jefeCompras
      }
    })
  } catch (err) {
    next(err)
  }
}

exports.sendInvitations = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { body, params } = req
    const { id } = params

    const [esAdmin] = await userService.getEmpresaAdmin(id, body.id)
    if (!esAdmin) return next(boom.badRequest('Must be admin'))

    const [admin] = await userService.getById(body.id)

    const users = body.users
    if (!users || users.length === undefined) return next(boom.badRequest('Users empty'))
    for (let i = 0; i < users.length; i++) {
      const [existeUsuario] = await userService.getByEmail(users[i].email)
      if (existeUsuario) return next(boom.badRequest('Email taken'))
    }

    await companiesService.postCompanyInvitations(id, users)

    const normalUsers = users.filter(u => u.tipo !== 3)
    for (let i = 0; i < normalUsers.length; i++) {
      const msg = {
        to: `${normalUsers[i].nombre.trim()} <${normalUsers[i].email}>`,
        from: `${email.sender.name} <${email.sender.email}>`,
        replyTo: `${email.sender.email}`,
        subject: 'Invitación a Market Choice B2B',
        text: 'Has sido invitado a Market Choice B2B',
        html: invitationTemplate(normalUsers[i].nombre, normalUsers[i].apellido, normalUsers[i].email, normalUsers[i].tipo, id, admin.usu_nombre)
      }
      await sendgrid(msg)
    }

    const [company] = await companiesService.getEmpresa(id)
    const adminUsers = users.filter(u => u.tipo === 3)
    for (let i = 0; i < adminUsers.length; i++) {
      const user = {
        name: adminUsers[i].nombre.trim(),
        lastName: adminUsers[i].apellido,
        email: adminUsers[i].email
      }
      const msg = {
        to: `${user.name} <${user.email}>`,
        from: `${email.sender.name} <${email.sender.email}>`,
        replyTo: `${email.sender.email}`,
        subject: 'Invitación a Market Choice B2B',
        text: 'Has sido invitado a Market Choice B2B',
        html: invitationToBecomeAdminTemplate({ company, user })
      }
      await sendgrid(msg)
    }

    return res.json({
      users
    })
  } catch (err) {
    next(err)
  }
}

exports.setCompanyUsers = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { body, params } = req
    const { id } = params

    const [esAdmin] = await userService.getEmpresaAdmin(id, body.id)
    if (!esAdmin) return next(boom.badRequest('Must be admin'))

    const [usuarioPerteneceEmpresa] = await userService.getEmpresaByUserId(body.usuario)
    if (!usuarioPerteneceEmpresa) return next(boom.badRequest('El usuario no pertenece a la empresa o no existe'))

    const jefeVentas = 3
    const jefeCompras = 4

    if (body.tipo != jefeVentas && body.tipo != jefeCompras) return next(boom.badRequest(`Error: ${body.tipo} no es un código de jefe válido`))

    const [usuarioTipo] = await userService.getAllDataById(body.usuario)
    const tipo = usuarioTipo.usu_tipo

    if (tipo !== 1 && tipo !== 2) return next(boom.badRequest('Error: No puedes elegir como jefe a un usuario de este tipo.'))
    if ((tipo === 1 && body.tipo !== 3) || (tipo === 2 && body.tipo !== 4)) return next(boom.badRequest('Error: No puedes elegir como jefe a un usuario de este tipo.'))

    const [jefe] = await userService.getJefeArea(id, body.tipo)

    if (jefe) {
      debug('Existe jefe')
      const normal = 2
      await companiesService.updateUserToCompany(id, jefe.usu_id, normal)
    }
    const results = await companiesService.updateUserToCompany(id, body.usuario, body.tipo)
    return res.json({
      error: false,
      results
    })
  } catch (err) {
    next(err)
  }
}

exports.getCompanyInvitations = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { params } = req
    const { id } = params

    const results = await companiesService.getCompanyInvitations(id)

    return res.json({
      error: false,
      results
    })
  } catch (err) {
    next(err)
  }
}

exports.createCompanyInvitation = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const { params, body } = req
    const { id } = params
    const { usuario } = body

    const [esAdmin] = await userService.getEmpresaAdmin(id, body.id)
    if (!esAdmin) return next(boom.badRequest('Must be admin'))
    const [admin] = await userService.getById(body.id)
    const payload = { ...usuario, empresa: id }
    const [invitacion] = await companiesService.getCompanyInvitationsDetails(payload)
    if (!invitacion) return next(boom.badRequest('No existe invitación'))

    const msg = {
      to: `${usuario.nombre.trim()} <${usuario.correo}>`,
      from: `${email.sender.name} <${email.sender.email}>`,
      replyTo: `${email.sender.email}`,
      subject: 'Invitación a Market Choice B2B',
      text: 'Has sido invitado a Market Choice B2B',
      html: invitationTemplate(usuario.nombre, usuario.apellido, usuario.correo, usuario.tipo, id, admin.usu_nombre)
    }

    await sendgrid(msg)

    return res.json({
      error: false,
      results: invitacion
    })
  } catch (err) {
    next(err)
  }
}

exports.deleteCompanyInvitation = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { body, params } = req
    const { id } = params

    const results = await companiesService.deleteCompanyInvitations(id, body.email)

    return res.json({
      error: false,
      results
    })
  } catch (err) {
    next(err)
  }
}

exports.editCompanyInvitation = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { body, params } = req
    const { id } = params
    const { email, usuario } = body

    const [esAdmin] = await userService.getEmpresaAdmin(id, body.id)
    if (!esAdmin) return next(boom.badRequest('Must be admin'))
    const [admin] = await userService.getById(body.id)

    const results = await companiesService.updateCompanyInvitations(id, email, usuario)

    const msg = {
      to: `${usuario.nombre.trim()} <${usuario.correo}>`,
      from: `${email.sender.name} <${email.sender.email}>`,
      replyTo: `${email.sender.email}`,
      subject: 'Invitación a Market Choice B2B',
      text: 'Has sido invitado a Market Choice B2B',
      html: invitationTemplate(usuario.nombre, usuario.apellido, usuario.correo, usuario.tipo, id, admin.usu_nombre)
    }
    await sendgrid(msg)

    return res.json({
      error: false,
      results
    })
  } catch (err) {
    next(err)
  }
}

exports.editCompanyUser = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { body, params } = req
    const { id } = params
    const { usuario } = body

    const [esAdmin] = await userService.getEmpresaAdmin(id, body.id)
    if (!esAdmin) return next(boom.badRequest('Must be admin'))

    const [usuarioPerteneceEmpresa] = await userService.getEmpresaByUserId(body.id)
    if (!usuarioPerteneceEmpresa) return next(boom.badRequest('El usuario no pertenece a la empresa o no existe'))

    await userService.updateUser(usuario)

    return res.json({
      error: false,
      results: usuario
    })
  } catch (err) {
    next(err)
  }
}

exports.getCompanyProducts = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { params } = req
    const { id } = params

    const productos = await productService.getProductsCompany(id)
    console.log(JSON.stringify(productos));

    for (let i = 0; i < productos.length; i++) {
      const producto = productos[i].producto_id
      // Traducciones
      const textos = await productService.getProductoTraducciones(producto)
      productos[i].textos = textos
      // Calificación total
      const [calificacion] = await productService.getProductoCalificacion(producto)
      const { total } = calificacion
      productos[i].calificacion = total ? Number(total) : null
      // Imágenes
      const fotos = await productService.getProductoFotos(producto)
      productos[i].fotos = fotos
    }

    return res.json({
      error: false,
      results: {
        productos
      }
    })
  } catch (err) {
    next(err)
  }
}

exports.getCompanyEvents = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { params, query } = req
    const { companyID } = params

    let { number, page } = query

    number = number ? Math.abs(number) : 10
    page = page ? Math.abs(page) : 1

    if (isNaN(number) || isNaN(page)) return next(boom.badRequest('Bad query'))

    const events = await eventsService.getEventsByCompanyId(companyID, page, number)

    // Obtener detalles de los eventos

    for (let i = 0; i < events.length; i++) {
      const evento = events[i]

      // Obtener lista de invitados
      const usuariosInvitados = await eventsService.getInvitations(evento.evento_id)

      // Filtrarlos
      const [invitado, interesado, asistir] = [1, 2, 3]
      const noConfirmados = usuariosInvitados.filter(u => u.tipo === invitado)
      const interesados = usuariosInvitados.filter(u => u.tipo === interesado)
      const asistiran = usuariosInvitados.filter(u => u.tipo === asistir)

      const invitados = {
        total: usuariosInvitados.length,
        no_confirmados: {
          total: noConfirmados.length
        },
        interesados: {
          total: interesados.length
        },
        asistiran: {
          total: asistiran.length
        }
      }

      events[i].invitados = invitados

      let horarios = []
      const horariosEvento = await eventsService.getSchedule(evento.evento_id)
      horarios = [...horariosEvento]
      events[i].horarios = horarios
      const [primerHorario] = horarios
      const { fecha: horarioFecha } = primerHorario
      events[i].horario_principal = horarioFecha
    }

    return res.json({
      error: false,
      results: {
        total: events.length,
        page: page ? Number(page) : 1,
        events
      }
    })
  } catch (err) {
    next(err)
  }
}

exports.createOrRemoveFavorite = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { body } = req
    const { user: userID, company: companyID } = body

    // Revisar que usuario y empresa existan
    const [user] = await userService.getById(userID)
    if (!user) return next(boom.badRequest('User does not exist'))
    const [company] = await companiesService.getEmpresa(companyID)
    if (!company) return next(boom.badRequest('Company does not exist'))

    // ¿Ya estaba marcado como favorito con anterioridad?
    const [isAlreadyFavorite] = await companiesService.checkCompanyIsFavorite(userID, companyID)
    let added
    if (isAlreadyFavorite) {
      // Si es así quitar el favorito
      await companiesService.removeCompanyFavorite(userID, companyID)
      added = false
    } else {
      // Si no es así agregar el favorito
      await companiesService.createCompanyFavorite(userID, companyID)
      added = true
    }

    return res.json({
      error: false,
      results: {
        added,
        removed: !added
      }
    })
  } catch (err) {
    next(err)
  }
}

exports.getCompanyRatings = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    let { params: { companyID } } = req
    companyID = Math.abs(companyID) || null

    if (!companyID) return next(boom.badRequest('Wrong company'))

    const [companyDetails] = await companiesService.getEmpresa(companyID)
    if (!companyDetails) return next(boom.notFound('Company not found'))

    const ratings = await companiesService.getCompanyRatings(companyID)

    return res.json({
      error: false,
      results: {
        total: ratings.length || 0,
        ratings
      }
    })
  } catch (err) {
    next(err)
  }
}

exports.postCompanyVideo = async (req, res, next) => {
  try {
    let { params: { companyID } } = req
    let setVideo = null
    companyID = Math.abs(companyID) || null
    const { video } = req.body;
    if (!video) return next(boom.badRequest('Empty video'))
    let url

    if (video) {
      const regex = /^(https?\:\/\/)?(www\.youtube\.com|youtu\.?be)\/.+$/
      if (regex.test(video)) {
        url = video
      } else {
        url = await uploadVideoS3.uploadVideo2(video, 'videoCorporativo')
        console.log(url)
      }
      setVideo = await companiesService.insertCompanyVideo(companyID, url)
    }

    res.status(200).json({
      error: false,
      results: setVideo
    })
  } catch (err) {
    next(err)
  }

  /* try {
     let { params: { companyID } } = req
     companyID = Math.abs(companyID) || null
     if (!companyID) return next(boom.badRequest('Wrong company'))
 
     const { file } = req
     if (!file) return next(boom.badRequest('Video not present'))
 
     const video = await uploadVideoS3(file)
 
     const inserted = await companiesService.insertCompanyVideo(companyID, video)
 
     return res.json({
       error: false,
       results: {
         inserted,
         video
       }
     })
   } catch (err) {
     next(err)
   }*/
}

exports.createAndUpdateAdresses = async (req, res, next) => {
  const { userId, direcciones } = req.body

  if (!userId || isNaN(userId)) return next(boom.badRequest('Invalid user.'))

  const [emp] = await userService.getEmpresaByUserId(userId)

  if (!emp) return next(boom.badRequest('User not found.'))

  const { emp_id: empId } = emp
  const [isAdmin] = await userService.getEmpresaAdmin(empId, userId)

  if (!isAdmin) return next(boom.badRequest('Must be admin'))

  if (!direcciones || direcciones.length < 1 || !Array.isArray(direcciones)) return next(boom.badRequest('Direcciones must be an array greater or equal than 1.'))

  const resultAddr = []
  for (let i = 0; i < direcciones.length; i++) {
    const address = direcciones[i]
    const { domicilioId, estadoId, nombre, direccion, googleId, telefonos } = address

    if (domicilioId === 'new') {
      if (!estadoId || !nombre || !direccion || !googleId) {
        resultAddr.push({ error: true, index: i, msg: 'estadoId, nombre, direccion and googleId are required.' })
        continue
      }
      const newAddress = await companiesService.addEmpresaDomicilio(empId, { estado: estadoId, nombre, direccion, google_id: googleId })

      if (telefonos != null) {
        if (Array.isArray(telefonos) && telefonos.length > 0) {
          for (let j = 0; j < telefonos.length; j++) {
            if (telefonos[j].id === 'new' && typeof telefonos[j].num === 'string') {
              await companiesService.addEmpresaDomicilioTelefono(newAddress.insertId, telefonos[j].num)
            }
          }
        } else {
          resultAddr.push({ error: true, index: i, msg: 'field telefonos must be an array greater or equal to 1.' })
          continue
        }
      }
      resultAddr.push({ error: false, newDomicilioId: newAddress.insertId })
    } else if (!isNaN(domicilioId)) {
      const [existsAddress] = await companiesService.getDomicilioById(domicilioId)
      if (!existsAddress) {
        resultAddr.push({ error: true, index: i, msg: 'Domicilio not found.' })
        continue
      }

      // const modifiedFields = []

      if (estadoId != null) {
        await companiesService.updateEstadoIdByDomicilioId(domicilioId, Number(estadoId))
        // modifiedFields.push({ type: 'modified', field: 'estadoId' })
      }
      if (nombre != null) {
        await companiesService.updateNombreByDomicilioId(domicilioId, nombre)
        // modifiedFields.push({ type: 'modified', field: 'nombre' })
      }
      if (direccion != null) {
        await companiesService.updateDireccionByDomicilioId(domicilioId, direccion)
        // modifiedFields.push({ type: 'modified', field: 'direccion' })
      }
      if (googleId != null) {
        await companiesService.updateGoogleIdByDomicilioId(domicilioId, googleId)
        // modifiedFields.push({ type: 'modified', field: 'googleId' })
      }
      if (telefonos != null) {
        if (Array.isArray(telefonos) && telefonos.length > 0) {
          for (let j = 0; j < telefonos.length; j++) {
            if (telefonos[j].id === 'new' && typeof telefonos[j].num === 'string') {
              // const newTelefon = await companiesService.addEmpresaDomicilioTelefono(domicilioId, telefonos[j].num)
              await companiesService.addEmpresaDomicilioTelefono(domicilioId, telefonos[j].num)
              // modifiedFields.push({ type: 'new', field: 'telefono', id: newTelefon.insertId })
            } else if (!isNaN(telefonos[j].id)) {
              const [existTelefono] = await companiesService.getTelefonoById(telefonos[j].id, domicilioId)
              if (!existTelefono) {
                resultAddr.push({ error: true, index: i, msg: 'telefono not found.' })
                continue
              }

              await companiesService.editEmpresaDomicilioTelefono(telefonos[j].id, telefonos[j].num, domicilioId)
              // modifiedFields.push({ type: 'modified', field: 'telefono', id: telefonos[j].id })
            }
          }
        }
      }
      // resultAddr.push({ error: false, modifiedDomicilioId: domicilioId, metadata: modifiedFields })
      resultAddr.push({ error: false, modifiedDomicilioId: domicilioId })
    } else {
      resultAddr.push({ error: true, index: i, msg: 'domicilioId invalid.' })
      continue
    }
  }

  const results = []
  const errors = []
  for (let i = 0; i < resultAddr.length; i++) {
    const element = resultAddr[i]
    if (!element.error) {
      const [addr] = await companiesService.getDomicilioById(element.newDomicilioId || element.modifiedDomicilioId)
      delete addr.fecha_creacion
      delete addr.fecha_actualizacion

      const telefonos = await companiesService.getEmpresaDomicilioTelefonos(addr.domicilio_id)
      for (let j = 0; j < telefonos.length; j++) {
        const tel = telefonos[j]
        delete tel.fecha_creacion
        delete tel.fecha_actualizacion
        delete tel.domicilio_id
      }

      results[i] = addr
      results[i].type = element.newDomicilioId ? 'new' : 'modified'
      results[i].telefonos = telefonos
    } else {
      errors[i] = { index: element.index, msg: element.msg }
    }
  }
  return res.json({
    ok: true,
    results: {
      data: results.filter(e => e != null),
      errors: errors.filter(e => e != null)
    }
  })
}



