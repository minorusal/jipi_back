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

    if (bad_times.contador_konesh >= 5) {
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

    const headers = { headers: { "Content-Type": "application/json" } }
    const konesh_api = await axios.post(konesh_url_valid_rfc, request, headers)
    if (konesh_api.status === 200) {

      if (await descifra_konesh(konesh_api.data.transactionResponse01[0].data04) !== razon_social) {
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

      const save_konesh = await koneshService.saveKonesh(konesh_api_des)
      logger.info(`Guardado de la informacón de konesh: ${JSON.stringify(save_konesh)} - ${fileMethod}`)

      const update_konesh = await koneshService.updateFlagKonesh(await descifra_konesh(konesh_api.data.transactionResponse01[0].data02), await descifra_konesh(konesh_api.data.transactionResponse01[0].data01))
      logger.info(`Actualizado de la bandera de konesh: ${JSON.stringify(update_konesh)} - ${fileMethod}`)

      if (await descifra_konesh(konesh_api.data.transactionResponse01[0].data02) == 'false') {
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
      logger.error(`Ocurrio un error al consumir konesh: ${konesh_api.status} - ${fileMethod}`)
      return next(boom.badRequest(`Ocurrio un error al consumir konesh: ${konesh_api.status}`))
    }

    //const estatus_konesh = await koneshService.getEstatusKonesh(rfc)

    logger.info(`Respuesta de servicio: ${JSON.stringify(konesh_api_des)} - ${fileMethod}`)

    const encryptedResponse = await cipher.encryptData(
      JSON.stringify(konesh_api_des),
      keyCipher
    )

    return res.send(encryptedResponse)

  } catch (error) {
    logger.error(`Ocurrio un error al consumir konesh: ${konesh_api.status} - ${fileMethod}`)
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
  const konesh_api = await axios.post(konesh_url_valid_rfc, request, headers)

  const data = konesh_api.data

  const razonDesencriptada = await descifra_konesh(data.transactionResponse01[0].data04)

  if (razonDesencriptada !== razon_social) {
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

    const originalText = decryptedBytes.toString(CryptoJS.enc.Utf8)
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

exports.callKoneshApi = async (rfc, globalConfig) => {
  const startTs = Date.now()
  const konesh_url_valid_rfc = globalConfig.find(item => item.nombre === 'konesh_url_valid_rfc').valor
  const textCifrado = await cifra_konesh(rfc)

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

  const headers = { headers: { 'Content-Type': 'application/json' } }
  const response = await axios.post(konesh_url_valid_rfc, request, headers)

  const responseTime = Date.now() - startTs

  try {
    const data = response.data
    await koneshService.saveKoneshResponse({
      rfc,
      request_ts: new Date(startTs).toISOString().slice(0, 19).replace('T', ' '),
      response_time_ms: responseTime,
      http_status: response.status,
      konesh_status: await descifra_konesh(data.transactionResponse01[0].data02),
      error_message: await descifra_konesh(data.transactionResponse01[0].data03),
      name_sat: await descifra_konesh(data.transactionResponse01[0].data04),
      postal_code: await descifra_konesh(data.transactionResponse01[0].data05),
      transaction_id: await descifra_konesh(data.transactionResponse02),
      transaction_date: await descifra_konesh(data.transactionResponse03),
      node: await descifra_konesh(data.transactionResponse04),
      raw_response: data
    })
  } catch (err) {
    logger.error(`Error saving konesh response log: ${err.message}`)
  }

  return response
}

exports.genericKoneshRequest = async (req, res, next) => {
  try {
    const { rfc, razon_social } = req.query

    if (!rfc || !razon_social) {
      return next(boom.badRequest('Faltan parámetros requeridos'))
    }

    const globalConfig = await utilitiesService.getParametros()

    const activa_api_sat = globalConfig.find(item => item.nombre === 'activa_api_sat')?.valor
    if (activa_api_sat !== 'true') {
      return res.json({ success: false, mensaje: 'El consumo a la API de Konesh está desactivado' })
    }

    const konesh_url_valid_rfc = globalConfig.find(item => item.nombre === 'konesh_url_valid_rfc').valor
    const textCifrado = await cifra_konesh(rfc)

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
      list: {
        list: [textCifrado]
      }
    }

    const headers = { headers: { 'Content-Type': 'application/json' } }
    const konesh_api = await axios.post(konesh_url_valid_rfc, request, headers)
    const data = konesh_api.data

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

    const problematicEntry = Object.entries(konesh_api_des.transactionResponse01[0])
      .find(([, value]) => typeof value === 'string' && value.toLowerCase() === 'false')

    if (problematicEntry) {
      return res.json({
        success: false,
        mensaje: 'El RFC tiene problemas en el SAT',
        detalle: problematicEntry[0],
        data_konesh: konesh_api_des
      })
    }

    const razonSat = konesh_api_des.transactionResponse01[0].data04
    if (razonSat !== razon_social) {
      return res.json({
        success: false,
        mensaje: 'La razón social proporcionada no coincide con la registrada en el SAT',
        data_konesh: konesh_api_des
      })
    }

    return res.json({ success: true, mensaje: 'RFC y razón social validados correctamente', data_konesh: konesh_api_des })
  } catch (error) {
    next(error)
  }
}

