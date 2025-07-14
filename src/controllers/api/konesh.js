const boom = require('boom')
const logger = require('../../../src/utils/logs/logger')
const cipher = require('../../utils/cipherService')
const koneshService = require('../../services/konesh')
const utilitiesService = require('../../services/utilities')
const crypto = require('crypto')
const CryptoJS = require('crypto-js')
const axios = require('axios')
const konesh = require('../../services/konesh')
const { globalAuth: { keyCipher } } = require('../../config')

const DEFAULT_KONESH_TIMEOUT_MS = 15000

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

exports.validaListaService = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/konesh.js - method: validaListaService`
  try {
    logger.info(`Inicio de proceso Konesh - ${fileMethod}`)

    const parsedData = typeof req.decryptedBody === 'string' ? JSON.parse(req.decryptedBody) : req.decryptedBody
    const { rfc, razon_social, idEmpresa, tipo } = parsedData

    let message = []

    let [bad_times] = await koneshService.obtenerBanderaIntentos(idEmpresa)
    let times = bad_times.contador_konesh

    let [bad_times_razon_social] = await koneshService.obtenerBanderaIntentosRazonSocial(idEmpresa)
    let times_razon_social = bad_times_razon_social.contador_konesh_razon_social_no_igual 

    if (times >= 5) {
      message.push('Ha alcanzado el limite de intentos para validar el RFC')
      // const encryptedResponse = await cipher.encryptData(
      //   JSON.stringify({
      //     error: true,
      //     message: "Ha alcanzado el limite de intentos para validar el RFC"
      //   }),
      //   keyCipher
      // )

      // return res.send(encryptedResponse)
    }

    const regexFisico = /^[A-Za-z]{4}\d{6}[A-Za-z0-9]{3}$/
    const regexMoral = /^[A-Za-z]{3}\d{6}[A-Za-z0-9]{3}$/

    if (
      (regexFisico.test(rfc) && tipo === 'moral') ||   // El RFC es físico, pero el tipo es moral
      (regexMoral.test(rfc) && tipo === 'fisico') ||   // El RFC es moral, pero el tipo es físico
      (!regexFisico.test(rfc) && tipo === 'fisico') || // El RFC no es físico, pero el tipo es físico
      (!regexMoral.test(rfc) && tipo === 'moral')      // El RFC no es moral, pero el tipo es moral
    ) {
      times++
      await koneshService.updateContadorKoneshEstructuraRfc(times, idEmpresa)
      message.push('El RFC no tiene la nomenclatura correcta')
      // const encryptedResponse = await cipher.encryptData(
      //   JSON.stringify({
      //     error: true,
      //     message: "El RFC no tiene la nomenclatura correcta"
      //   }),
      //   keyCipher
      // );
      // return res.send(encryptedResponse)
    }


    logger.info(`Request de endpoint: ${JSON.stringify(parsedData)} -  ${fileMethod}`)


  
  const razonSocialUpper = razon_social ? razon_social.toUpperCase() : razon_social
  const apiResponse = await callKoneshApi(rfc, globalConfig, { emp_id: idEmpresa, razon_social_req: razon_social })
  const result = apiResponse.data
  const konesh_api_des = result ? result.data_konesh : {}

  if (apiResponse.errorMessage) {
    logger.error(`Error de comunicación con Konesh: ${apiResponse.errorMessage} - ${fileMethod}`)
    return next(boom.gatewayTimeout(apiResponse.errorMessage))
  }

  if (apiResponse.status === 200 && result) {

      if (konesh_api_des?.transactionResponse01?.[0]?.data04 !== razonSocialUpper) {
        times_razon_social++
        message.push('La razón social capturada no corresponde a la razón social del SAT')
        await koneshService.updateContadorKoneshRazonSocialNoIgual(times_razon_social, idEmpresa)
        // await koneshService.updateContadorKoneshRazonSocialNoIgual(times, idEmpresa)
        // const encryptedResponse = await cipher.encryptData(
        //   JSON.stringify({
        //     error: true,
        //     message: "La razón social capturada no corresponde a la razón social del SAT"
        //   }),
        //   keyCipher
        // )

        // return res.send(encryptedResponse)
      }

      logger.info(`Respuesta Konesh: ${JSON.stringify(apiResponse.data)} - ${fileMethod}`)
      logger.info(`Respuesta descifrada Konesh: ${JSON.stringify(konesh_api_des)} - ${fileMethod}`)

      const save_konesh = await koneshService.saveKonesh(konesh_api_des)
      logger.info(`Guardado de la informacón de konesh: ${JSON.stringify(save_konesh)} - ${fileMethod}`)

      const update_konesh = await koneshService.updateFlagKonesh(konesh_api_des.transactionResponse01[0].data02, konesh_api_des.transactionResponse01[0].data01)
      logger.info(`Actualizado de la bandera de konesh: ${JSON.stringify(update_konesh)} - ${fileMethod}`)

      if (konesh_api_des.transactionResponse01[0].data02 == 'false') {
        logger.info(`Respuesta de servicio: ${JSON.stringify(konesh_api_des)} - ${fileMethod}`)
        times++
        message.push('El RFC es incorrecto')
        konesh_api_des.error = true
        konesh_api_des.message = 'El RFC es incorrecto'
        await koneshService.updateContadorKoneshEstructuraRfc(times, idEmpresa)
        
        // const encryptedResponse = await cipher.encryptData(
        //   JSON.stringify(konesh_api_des),
        //   keyCipher
        // )

        // return res.send(encryptedResponse)
      }

    } else {
      logger.error(`Ocurrio un error al consumir konesh: ${apiResponse.status} - ${fileMethod}`)
      return next(boom.badRequest(`Ocurrio un error al consumir konesh: ${apiResponse.status}`))
    }

    //const estatus_konesh = await koneshService.getEstatusKonesh(rfc)

    logger.info(`Respuesta de servicio: ${JSON.stringify(konesh_api_des)} - ${fileMethod}`)

    }
    
    const responsePayload = { ...konesh_api_des, error: message.length > 0, message: message.join('. ') }

    const encryptedResponse = await cipher.encryptData(JSON.stringify(responsePayload), keyCipher)
    
    return res.send(encryptedResponse)

  } catch (error) {
    console.log(error)
    logger.error(`Ocurrio un error al consumir konesh: ${apiResponse?.status} - ${fileMethod}`)
    next(error)
  }
}

exports.validaRfcKonesh = async ({ rfc, razon_social, idEmpresa, tipo, keyCipher }) => {
  let [bad_times] = await koneshService.obtenerBanderaIntentos(idEmpresa)
  let times = bad_times.contador_konesh

  if (times >= 5) {
    return {
      error: true,
      message: "Ha alcanzado el límite de intentos para validar el RFC"
    }
  }

  const regexFisico = /^[A-Za-z]{4}\d{6}[A-Za-z0-9]{3}$/
  const regexMoral = /^[A-Za-z]{3}\d{6}[A-Za-z0-9]{3}$/

  if (
    (regexFisico.test(rfc) && tipo === 'moral') ||
    (regexMoral.test(rfc) && tipo === 'fisico') ||
    (!regexFisico.test(rfc) && tipo === 'fisico') ||
    (!regexMoral.test(rfc) && tipo === 'moral')
  ) {
    times++
    await koneshService.updateContadorKonesh(times, idEmpresa)
    return {
      error: true,
      message: "El RFC no tiene la nomenclatura correcta"
    }
  }

  const globalConfig = await utilitiesService.getParametros()
  const konesh_url_valid_rfc = globalConfig.find(item => item.nombre === 'konesh_url_valid_rfc').valor
  const textCifrado = await cifra_konesh(rfc)

  const request = {
    credentials: {
      usuario: globalConfig.find(item => item.nombre === 'konesh_usuario').valor,
      token: globalConfig.find(item => item.nombre === 'konesh_token').valor,
      password: globalConfig.find(item => item.nombre === 'konesh_password').valor,
      cuenta: globalConfig.find(item => item.nombre === 'konesh_cuenta').valor,
    },
    issuer: {
      rfc: globalConfig.find(item => item.nombre === 'konesh_issuer').valor,
    },
    list: {
      list: [textCifrado]
    }
  }

  const headers = { headers: { "Content-Type": "application/json" } }
  const startTs = Date.now()
  const konesh_api = await axios.post(konesh_url_valid_rfc, request, headers)
  const responseTime = Date.now() - startTs

  const data = konesh_api.data

  const razonDesencriptada = await descifra_konesh(data.transactionResponse01[0].data04)

  const razonSocialUpper = razon_social ? razon_social.toUpperCase() : razon_social
  if (razonDesencriptada !== razonSocialUpper) {
    times++
    await koneshService.updateContadorKonesh(times, idEmpresa)
    return {
      error: true,
      message: "La razón social capturada no corresponde a la razón social del SAT"
    }
  }

  const konesh_api_des = {
    transactionResponse01: [
      {
        data01: await descifra_konesh(data.transactionResponse01[0].data01),
        data02: await descifra_konesh(data.transactionResponse01[0].data02),
        data03: await descifra_konesh(data.transactionResponse01[0].data03),
        data04: razonDesencriptada,
        data05: await descifra_konesh(data.transactionResponse01[0].data05),
      }
    ],
    transactionResponse02: await descifra_konesh(data.transactionResponse02),
    transactionResponse03: await descifra_konesh(data.transactionResponse03),
    transactionResponse04: await descifra_konesh(data.transactionResponse04),
  }

  try {
    await koneshService.saveKoneshResponse({
      emp_id: idEmpresa,
      rfc,
      razon_social_req: razon_social,
      request_ts: new Date(startTs).toISOString().slice(0, 19).replace('T', ' '),
      response_time_ms: responseTime,
      http_status: konesh_api.status,
      konesh_status: konesh_api_des.transactionResponse01?.[0]?.data02 || null,
      error_message: null,
      name_sat: konesh_api_des.transactionResponse01?.[0]?.data04 || null,
      postal_code: konesh_api_des.transactionResponse01?.[0]?.data05 || null,
      transaction_id: konesh_api_des.transactionResponse02 || null,
      transaction_date: konesh_api_des.transactionResponse03 || null,
      node: konesh_api_des.transactionResponse04 || null,
      raw_response: data
    })
  } catch (err) {
    logger.error(`Error saving konesh response log: ${err.message}`)
  }

  await koneshService.saveKonesh(konesh_api_des)

  const razonCorrecta = await descifra_konesh(data.transactionResponse01[0].data02)
  const rfcCorrecto = await descifra_konesh(data.transactionResponse01[0].data01)

  await koneshService.updateFlagKonesh(razonCorrecta, rfcCorrecto)

  if (razonCorrecta === 'false') {
    times++
    await koneshService.updateContadorKonesh(times, idEmpresa)
    return {
      error: true,
      message: 'El RFC es incorrecto'
    }
  }

  return konesh_api_des
}


exports.consultaEstatusKonesh = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/konesh.js - method: consultaEstatusKonesh`
  try {
    const { rfc } = req.params
    logger.info(`Inicio de consulta estatus Konesh - ${fileMethod}`)


    logger.info(`Request de endpoint: ${JSON.stringify(rfc)} -  ${fileMethod}`)

    const estatus_konesh = await koneshService.getEstatusKonesh(rfc)

    logger.info(`Respuesta de servicio: ${JSON.stringify(estatus_konesh)} - ${fileMethod}`)

    const encryptedResponse = await cipher.encryptData(
      JSON.stringify(estatus_konesh),
      keyCipher
    )

    return res.send(encryptedResponse)

  } catch (error) {
    logger.error(`Ocurrio un error al consultar estatus konesh: ${konesh_api.status} - ${fileMethod}`)
    next(error)
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

exports.descifra = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/konesh.js - method: validaListaService`
  try {
    const { body } = req
    const { encryptedText } = body
    const globalConfig = await utilitiesService.getParametros()
    const keyCrypDecrypt = await globalConfig.find(item => item.nombre === 'konesh_keyCrypDecrypt').valor

    const hashedKey = CryptoJS.SHA512(keyCrypDecrypt).toString(CryptoJS.enc.Hex)
    const keyBytes = CryptoJS.enc.Hex.parse(hashedKey.substring(0, 64))


    const encryptedBytes = CryptoJS.enc.Base64.parse(encryptedText)
    const decryptedBytes = CryptoJS.AES.decrypt(
      { ciphertext: encryptedBytes },
      keyBytes,
      { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 }
    )

    let originalText
    try {
      originalText = decryptedBytes.toString(CryptoJS.enc.Utf8)
    } catch (e) {
      logger.error(`descifra: Malformed UTF-8 data when decrypting string: '${encryptedText}'`)
      originalText = 'Error de codificación'
    }
    return res.json({ originalText })

  } catch (error) {
    console.log(error)
    next(error)
  }
}


exports.cifra = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/konesh.js - method: cifra`
  try {
    const { body } = req
    const { plaintext } = body
    const globalConfig = await utilitiesService.getParametros()
    const keyCrypDecrypt = await globalConfig.find(item => item.nombre === 'konesh_keyCrypDecrypt').valor

    const hashedKey = CryptoJS.SHA512(keyCrypDecrypt).toString(CryptoJS.enc.Hex)
    const keyBytes = CryptoJS.enc.Hex.parse(hashedKey.substring(0, 64))

    const ciphertext = CryptoJS.AES.encrypt(
      plaintext,
      keyBytes,
      { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 }
    )

    const encryptedText = ciphertext.ciphertext.toString(CryptoJS.enc.Base64)
    return res.json({ encryptedText })
  } catch (error) {
    next(error);
  }
}

exports.callKoneshApi = async (rfc, globalConfig, opts = {}) => {
  const fileMethod = `file: src/controllers/api/konesh.js - method: callKoneshApi`;
  logger.info(`${fileMethod} | Iniciando llamada a Konesh para RFC: ${rfc}`);
  const { emp_id = null, razon_social_req = null } = opts
  const startTs = Date.now()
  const konesh_url_valid_rfc = globalConfig.find(item => item.nombre === 'konesh_url_valid_rfc').valor
  const textCifrado = await cifra_konesh(rfc);

  const request = {
    credentials: {
      usuario: globalConfig.find(item => item.nombre === 'konesh_usuario').valor,
      token: globalConfig.find(item => item.nombre === 'konesh_token').valor,
      password: globalConfig.find(item => item.nombre === 'konesh_password').valor,
      cuenta: globalConfig.find(item => item.nombre === 'konesh_cuenta').valor
    },
    issuer: {
      rfc: globalConfig.find(item => item.nombre === 'konesh_issuer').valor
    },
    list: { list: [textCifrado] }
  }

  logger.info(`${fileMethod} | Construyendo request para Konesh: ${JSON.stringify({ ...request, credentials: { ...request.credentials, password: '***' } })}`);
  const timeoutMs = parseInt(globalConfig.find(item => item.nombre === 'konesh_timeout_ms')?.valor) || DEFAULT_KONESH_TIMEOUT_MS
  const axiosConfig = { headers: { 'Content-Type': 'application/json' }, timeout: timeoutMs }
  let response
  let status
  let errorMessage = null

  try {
    logger.info(`${fileMethod} | Enviando petición a ${konesh_url_valid_rfc}`);
    response = await axios.post(konesh_url_valid_rfc, request, axiosConfig)
    status = response.status
    logger.info(`${fileMethod} | Respuesta exitosa de Konesh con status: ${status}`);
    response.errorMessage = null
  } catch (err) {
    if (err.code === 'ECONNABORTED') {
      errorMessage = 'Tiempo de espera agotado al contactar a Konesh'
      status = 504
    } else if (err.message === 'Network Error') {
      errorMessage = 'No se pudo conectar al servicio Konesh'
      status = 503
    } else {
      errorMessage = err.message
      status = err.response ? err.response.status : null
    }
    response = err.response ? err.response : { status, data: null }
    response.errorMessage = `${errorMessage}. Respuesta de Konesh: ${JSON.stringify(response.data)}`
    logger.error(`${fileMethod} | Error al llamar a Konesh: ${errorMessage}`)
  }

  const responseTime = Date.now() - startTs

  try {
    const data = response.data
    logger.info(`${fileMethod} | Guardando log de la respuesta de Konesh en la base de datos.`);
    await koneshService.saveKoneshResponse({
      emp_id,
      rfc,
      razon_social_req,
      request_ts: new Date(startTs).toISOString().slice(0, 19).replace('T', ' '),
      response_time_ms: responseTime,
      http_status: status,
      konesh_status: data?.transactionResponse01 ? await descifra_konesh(data.transactionResponse01[0].data02) : null,
      error_message: errorMessage || (data?.transactionResponse01 ? await descifra_konesh(data.transactionResponse01[0].data03) : null),
      name_sat: data?.transactionResponse01 ? await descifra_konesh(data.transactionResponse01[0].data04) : null,
      postal_code: data?.transactionResponse01 ? await descifra_konesh(data.transactionResponse01[0].data05) : null,
      transaction_id: data ? await descifra_konesh(data.transactionResponse02) : null,
      transaction_date: data ? await descifra_konesh(data.transactionResponse03) : null,
      node: data ? await descifra_konesh(data.transactionResponse04) : null,
      raw_response: data
    })
  } catch (err) {
    logger.error(`${fileMethod} | Error al guardar el log de respuesta de Konesh: ${err.message}`)
  }

  logger.info(`${fileMethod} | Finalizando llamada a Konesh para RFC: ${rfc}. Duración: ${responseTime}ms`);
  return response
}

const executeGenericKoneshRequest = async (rfc, razon_social, globalConfig, opts = {}) => {
  const fileMethod = `file: src/controllers/api/konesh.js - method: executeGenericKoneshRequest`;
  logger.info(`${fileMethod} | Iniciando para RFC: ${rfc}, Razón Social: ${razon_social}`);

  const razonSocialUpper = razon_social ? razon_social.toUpperCase() : razon_social
  const apiResponse = await exports.callKoneshApi(rfc, globalConfig, opts)
  logger.info(`${fileMethod} | Respuesta de callKoneshApi - status: ${apiResponse.status}`);

  if (apiResponse.status !== 200) {
    logger.warn(`${fileMethod} | La API de Konesh devolvió un estado no exitoso: ${apiResponse.status}`);
    return { apiResponse, result: null }
  }

  const data = apiResponse.data
  if (!data || !Array.isArray(data.transactionResponse01) || !data.transactionResponse01[0]) {
    if (data && data.result === 'INVALID' && data.stage === 'AUTHENTICATION') {
      apiResponse.errorMessage = data.message
      logger.error(`${fileMethod} | Error de autenticación con Konesh: ${data.message}`);
    }
    logger.error(`${fileMethod} | Respuesta de Konesh inválida o inesperada: ${JSON.stringify(data)}`);
    return { apiResponse, result: null }
  }

  logger.info(`${fileMethod} | Descifrando respuesta de Konesh...`);
  const konesh_api_des = {
    transactionResponse01: [{
      data01: await descifra_konesh(data.transactionResponse01[0].data01),
      data02: await descifra_konesh(data.transactionResponse01[0].data02),
      data03: await descifra_konesh(data.transactionResponse01[0].data03),
      data04: await descifra_konesh(data.transactionResponse01[0].data04),
      data05: await descifra_konesh(data.transactionResponse01[0].data05)
    }],
    transactionResponse02: await descifra_konesh(data.transactionResponse02),
    transactionResponse03: await descifra_konesh(data.transactionResponse03),
    transactionResponse04: await descifra_konesh(data.transactionResponse04)
  }
  logger.info(`${fileMethod} | Respuesta de Konesh descifrada: ${JSON.stringify(konesh_api_des)}`);

  const problematicEntry = Object.entries(konesh_api_des.transactionResponse01[0])
    .find(([, value]) => typeof value === 'string' && value.toLowerCase() === 'false')

  let result
  if (problematicEntry) {
    result = {
      success: false,
      mensaje: 'El RFC tiene problemas en el SAT',
      detalle: problematicEntry[0],
      data_konesh: konesh_api_des
    }
    logger.warn(`${fileMethod} | RFC con problemas en el SAT: ${rfc}. Detalle: ${problematicEntry[0]}`);
  } else if (konesh_api_des.transactionResponse01[0].data04 !== razonSocialUpper) {
    result = {
      success: false,
      mensaje: 'La razón social proporcionada no coincide con la registrada en el SAT',
      data_konesh: konesh_api_des
    }
    logger.warn(`${fileMethod} | Discrepancia en Razón Social. Proporcionada: '${razonSocialUpper}', SAT: '${konesh_api_des.transactionResponse01[0].data04}'`);
  } else {
    result = {
      success: true,
      mensaje: 'RFC y razón social validados correctamente',
      data_konesh: konesh_api_des
    }
    logger.info(`${fileMethod} | Validación exitosa para RFC: ${rfc}`);
  }

  return { apiResponse, result }
}

exports.genericKoneshRequest = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/konesh.js - method: genericKoneshRequest`
  try {
    logger.info(`${fileMethod} | Inicio de la solicitud genérica a Konesh`)
    const { rfc, razon_social } = req.query

    if (!rfc || !razon_social) {
      logger.warn(`${fileMethod} | Parámetros requeridos faltantes: rfc o razon_social`)
      return next(boom.badRequest('Faltan parámetros requeridos'))
    }

    const globalConfig = await utilitiesService.getParametros()

    const activa_api_sat = globalConfig.find(item => item.nombre === 'activa_api_sat')?.valor
    if (activa_api_sat !== 'true') {
      logger.info(`${fileMethod} | La validación con Konesh está desactivada por configuración.`)
      return res.json({ success: true, mensaje: 'El consumo a la API de Konesh está desactivado' })
    }

    const razonSocialUpper = razon_social ? razon_social.toUpperCase() : razon_social
    logger.info(`${fileMethod} | Ejecutando consulta a Konesh para RFC: ${rfc}`)
    const { apiResponse, result } = await executeGenericKoneshRequest(rfc, razonSocialUpper, globalConfig)

    if (apiResponse.errorMessage) {
      logger.error(`${fileMethod} | Error en la respuesta de la API de Konesh: ${apiResponse.errorMessage}`)
      return next(boom.gatewayTimeout(apiResponse.errorMessage))
    }

    if (!result) {
      logger.error(`${fileMethod} | No se obtuvo un resultado válido de Konesh. Estado de la API: ${apiResponse.status}`)
      return next(boom.badRequest(`Ocurrio un error al consumir konesh: ${apiResponse.status}`))
    }

    logger.info(`${fileMethod} | Consulta a Konesh exitosa. Resultado: ${JSON.stringify(result)}`)
    return res.json(result)
  } catch (error) {
    logger.error(`${fileMethod} | Error en el bloque catch: ${error.message}`)
    if (error.code === 'ECONNABORTED') {
      logger.error(`${fileMethod} | Timeout al conectar con Konesh.`)
      return next(boom.gatewayTimeout('Tiempo de espera agotado al contactar a Konesh'))
    }
    if (error.message === 'Network Error') {
      logger.error(`${fileMethod} | Error de red al conectar con Konesh.`)
      return next(boom.badGateway('No se pudo conectar al servicio Konesh'))
    }
    next(error)
  }
}
