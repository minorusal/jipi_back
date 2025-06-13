'use strict'

const debug = require('debug')('old-api:publications-controller')
const boom = require('boom')
const publicationService = require('../../services/publicactions')
const userService = require('../../services/users')
const eventsService = require('../../services/events')
const uploadImageS3 = require('../../utils/uploadImageS3')
const uploadVideoS3 = require('../../utils/uploadVideoS3')
const { globalAuth: { keyCipher } } = require('../../config')
const cipher = require('../../utils/cipherService')
const companiesService = require('../../services/companies')
const logger = require('../../../src/utils/logs/logger')

exports.getPublications = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const { query } = req
    const publications = await publicationService.get(query)
    res.json({
      error: false,
      numberEntries: publications.length,
      pageNumber: query && query.page ? query.page : null,
      results: publications
    })
  } catch (err) {
    next(err)
  }
}

exports.getComentariosByIdPub = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/publications.js - method: getComentariosByIdPub`
  try {
    const { id_publicacion } = req.params
    let coments = []

    const comentarios = await publicationService.obtenerComentarioByPublicacion(id_publicacion)
    for (let c of comentarios) {
      const [likes_coments] = await publicationService.obtenerNumeroLikesComentarios(c.id_publication_coment)
      c.likes = likes_coments.likes
      coments.push(c)
    }

    const encryptedResponse = await cipher.encryptData(JSON.stringify({
      error: false,
      results: {
        coments
      }
    }), keyCipher)

    res.send(encryptedResponse)
  } catch (error) {
    next(err)
  }
}

exports.getPublicationsByEmp = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/publications.js - method: getPublicationsByEmp`
  try {
    const { id_empresa, id_usuario } = req.params
    let publicacion = []
    const [empresa] = await publicationService.getEmpresaById(id_empresa)
    const users_empresa = await publicationService.getUserByCompany(id_empresa)
    for (let u of users_empresa) {
      const publicacion_usuario = await publicationService.obtienePublicacionByUsuarioOrigen(u.usu_id)
      const [rol] = await publicationService.obtieneRolByIdUsuario(u.usu_id)
      u.empresa = empresa.empresa_nombre
      u.usuario = rol.usuario_nombre
      u.foto = rol.usu_foto
      u.rol = rol.nombre
      u.publicaciones = publicacion_usuario
      for (let p of publicacion_usuario) {
        const [likes] = await publicationService.obtenerNumeroLikesPublicacion(p.id_publication)
        const [foto_usuario] = await publicationService.obtenerFotoUsuarioPublicacion(p.usuario_id_origen)
        p.usu_foto = foto_usuario.usu_foto
        const [empresa_logo] = await publicationService.obtenerFotoEmpresaUsuario(p.usuario_id_origen)
        p.empresa_logo = empresa_logo.emp_logo
        p.likes = likes.likes
        const [like_login] = await publicationService.getLikeUserPublicacion(p.id_publication, id_usuario)
        p.like_login = like_login.like_logeado > 0 ? true : false
        const comentarios = await publicationService.obtenerComentarioByPublicacion(p.id_publication)
        for (let c of comentarios) {
          const [likes_coments] = await publicationService.obtenerNumeroLikesComentarios(c.id_publication_coment)
          c.likes = likes_coments.likes
          const [foto_usuario] = await publicationService.obtenerFotoUsuarioPublicacion(c.usuario_id)
          c.usu_foto = foto_usuario.usu_foto
          const [empresa_logo] = await publicationService.obtenerFotoEmpresaUsuario(c.usuario_id)
          c.empresa_logo = empresa_logo.emp_logo
          const [like_login] = await publicationService.getLikeUserComentario(c.id_publication_coment, id_usuario)
          c.like_login = like_login.like_logeado > 0 ? true : false
        }
        p.comentarios = comentarios
        p.galeria = await publicationService.obtenerGaleria(p.id_publication)
      }
      publicacion.push(u)
    }

    const encryptedResponse = await cipher.encryptData(JSON.stringify({
      error: false,
      results: {
        publicacion
      }
    }), keyCipher)

    res.send(encryptedResponse)
  } catch (error) {
    next(error)
  }
}

exports.eliminarPublicacion = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/publications.js - method: eliminarPublicacion`
  try {
    const { id_publicacion } = req.params
    const desactivar = await publicationService.desactivarPublicacion(id_publicacion)
    const encryptedResponse = await cipher.encryptData(JSON.stringify({
      error: false,
      results: {
        desactivar
      }
    }), keyCipher)

    res.send(encryptedResponse)
  } catch (error) {
    next(error)
  }
}

exports.uploadImageGaleriaPublicacion = async (req, res, next) => {
  try {
    let { imagen } = req
    const urlImg = await uploadImageS3.uploadImage2(imagen, 'publicacionesImg')
    return res.json({
      urlImg
    })
  } catch (error) {
    next(error)
  }
}

exports.editarPublicacion = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/publications.js - method: editarPublicacion`
  try {
    let { galeria, video, imagen } = req
    const parsedData = typeof req.decryptedData === 'string' ? JSON.parse(req.decryptedData) : req.decryptedData
    const { id_publicacion, usuario_id_origen, comentario, tipo_origen, tipo_destino } = parsedData

    let valor_video
    let video_bd

    let valor_imagen
    let imagen_bd

    let valor_galeria
    let galeria_bd = []

    logger.info(`${fileMethod} | Se recibe la siguiente info para editar una publicación: ${JSON.stringify(parsedData)}`)

    const [publicacion] = await publicationService.obtenerPublicacionCreada(id_publicacion)

    const regex_s3 = /^https:\/\/mycredibusinessbucketapp\.s3\.amazonaws\.com\/.*/

    const validarAwsVideo = (video) => regex_s3.test(video)
    const validarBase64Video = (video) => /^data:video\/mp4;base64,/.test(video)
    const validarYoutube = (video) => /^https:\/\/www\.youtube\.com\/.*$/.test(video)
    const esCadenaVaciaVideo = (video) => video === ''
    const esUndefinedVideo = (video) => video === undefined
    const esBufferVideo = (video) => Buffer.isBuffer(video.buffer)

    const validacionesVideo = [
      { check: validarAwsVideo, valor: 5 },
      { check: esUndefinedVideo, valor: 4 },
      { check: esCadenaVaciaVideo, valor: 3 },
      { check: validarBase64Video, valor: 1 },
      { check: validarYoutube, valor: 2 },
      { check: esBufferVideo, valor: 6 }
    ]

    for (let { check, valor } of validacionesVideo) {
      if (check(video)) {
        valor_video = valor
        break
      }
    }

    switch (valor_video) {
      case 1:
        let video_base64 = video.split(',')[1]
        try {
          atob(video_base64)
          video_bd = await uploadVideoS3.uploadVideo2(video, 'publicacionesVideo')
        } catch (e) {
          logger.error(`${fileMethod} | Base 64 invalido ${e}`)
          return next(boom.badRequest(`Base 64 invalido ${e}`))
        }
        break
      case 2:
        video_bd = video
        break
      case 3:
        video_bd = video
        break
      case 4:
        logger.warn(`${fileMethod} | Se requiere que envies un comentario, una imagen o un video`)
        return next(boom.badRequest('Se requiere que envies un comentario, una imagen o un video'))
      case 5:
        video_bd = video
        break
      case 6:
        video_bd = await uploadVideoS3.uploadVideo2(video, 'publicacionesVideo')
        break
    }

    if (regex_s3.test(publicacion.video)) {
      await uploadImageS3.deleteFileFromS3(publicacion.video)
    }

    const validarAwsImagen = (imagen) => regex_s3.test(imagen)
    const validarBase64Imagen = (imagen) => /^data:image\/png;base64,/.test(imagen)
    const esCadenaVaciaImagen = (imagen) => imagen === ''
    const esUndefinedImagen = (imagen) => imagen === undefined
    const esBufferImagen = (imagen) => Buffer.isBuffer(imagen.buffer)

    const validacionesImagen = [
      { check: validarAwsImagen, valor: 4 },
      { check: esUndefinedImagen, valor: 3 },
      { check: esCadenaVaciaImagen, valor: 2 },
      { check: validarBase64Imagen, valor: 1 },
      { check: esBufferImagen, valor: 5 }
    ]

    for (let { check, valor } of validacionesImagen) {
      if (check(imagen)) {
        valor_imagen = valor
        break
      }
    }

    switch (valor_imagen) {
      case 1:
        let imagen_base64 = imagen.split(',')[1]
        try {
          atob(imagen_base64)
          imagen_bd = await uploadImageS3.uploadImage2(imagen, 'publicacionesImg')
        } catch (e) {
          logger.error(`${fileMethod} | Base 64 invalido ${e}`)
          return next(boom.badRequest(`Base 64 invalido ${e}`))
        }
        break
      case 2:
        imagen_bd = imagen
        break
      case 3:
        logger.warn(`${fileMethod} | Se requiere que envies un comentario, una imagen o un video`)
        return next(boom.badRequest('Se requiere que envies un comentario, una imagen o un video'))
      case 4:
        imagen_bd = imagen
        break
      case 5:
        imagen_bd = await uploadImageS3.uploadImage2(imagen, 'publicacionesImg')
        break
      default:
        break
    }

    if (regex_s3.test(publicacion.imagen)) {
      await uploadImageS3.deleteFileFromS3(publicacion.imagen)
      logger.info(`${fileMethod} | Se elimino el objeto ${publicacion.imagen}`)
    }

    const esUndefinedGaleria = (galeria) => galeria === undefined
    const esBase64Valido = (cadena) => {
      const regexBase64 = /^data:image\/(png|jpeg|jpg|gif);base64,/
      if (regexBase64.test(cadena)) {
        try {
          const base64Str = cadena.split(',')[1]
          atob(base64Str)
          return true
        } catch (e) {
          return false
        }
      }
      return false;
    }
    const tieneMasDeUnElementoGaleria = (galeria) => {
      return Array.isArray(galeria) && galeria.length > 0
    }

    const tieneUrlsValidas = (galeria) =>
      Array.isArray(galeria) && galeria.every(item => regex_s3.test(item.url))

    const validacionesGaleria = [
      { check: esUndefinedGaleria, valor: 1 },
      { check: tieneMasDeUnElementoGaleria, valor: 2 },
      { check: tieneUrlsValidas, valor: 3 }
    ]

    for (let { check, valor } of validacionesGaleria) {
      if (check(galeria)) {
        valor_galeria = valor
        break
      }
    }

    switch (valor_galeria) {
      case 1:
        logger.warn(`${fileMethod} | Se requiere que envies un comentario, una imagen o un video`)
        return next(boom.badRequest('Se requiere que envies un comentario, una imagen o un video'))
      case 2:
        if (galeria.length > 0) {
          for (let img of galeria) {
            let image = img.hasOwnProperty('url') ? img.url : img
            if (esBase64Valido(image)) {
              const uploadResult = await uploadImageS3.uploadImage2(image, 'publicacionesImg')
              galeria_bd.push(uploadResult)
            } else if (regex_s3.test(image)) {
              galeria_bd.push(image)
            } else if (img.hasOwnProperty('buffer')) {
              const uploadResult = await uploadImageS3.uploadImage2(img, 'publicacionesImg')
              galeria_bd.push(uploadResult)
            }
          }
        }

        let galeria_saved = await publicationService.obtenerGaleria(id_publicacion)

        if (galeria_saved.length > 0) {
          for (let img_saved of galeria_saved) {
            if (regex_s3.test(img_saved.url)) {
              const deleted = await uploadImageS3.deleteFileFromS3(img_saved.url)
              logger.info(`${fileMethod} | Se elimino el objeto ${deleted}`)
            }
          }
        }
        break
      case 3:
        for (let img of galeria) {
          galeria_bd.push(img)
        }
        break
    }

    const obj_update_publication = {
      id_publicacion,
      usuario_id_origen,
      imagen_bd,
      video_bd,
      comentario,
      tipo_origen,
      tipo_destino
    }

    await publicationService.updatePublication(obj_update_publication)

    await publicationService.deleteImageGalery(id_publicacion)
    if (galeria_bd.length > 0) {
      for (let img of galeria_bd) {
        await publicationService.saveImageGalery(img.hasOwnProperty('url') ? img.url : img, id_publicacion)
      }
    }

    const publication_created = await publicationService.obtenerPublicacionCreada(id_publicacion)
    logger.info(`${fileMethod} | Publicación creada: ${JSON.stringify(publication_created)}`)

    const publication_galery = await publicationService.obtenerGaleria(id_publicacion)
    logger.info(`${fileMethod} | Publicación creada: ${JSON.stringify(publication_galery)}`)

    const encryptedResponse = await cipher.encryptData(JSON.stringify({
      error: false,
      results: {
        publication_created,
        publication_galery
      }
    }), keyCipher)

    res.send(encryptedResponse)
  } catch (error) {
    next(error)
  }
}

exports.crearPublicacion = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/publications.js - method: crearPublicacion`
  try {
    const { galeria, video, imagen } = req
    const parsedData = typeof req.decryptedData === 'string' ? JSON.parse(req.decryptedData) : req.decryptedData
    const { usuario_id_origen, comentario, tipo_origen, tipo_destino } = parsedData

    let publication = {}
    const pathBucket = 'publicacionesImg'

    logger.info(`${fileMethod} | Se recibe la siguiente info para crear una publicación: ${JSON.stringify(parsedData)}`)

    if ((!comentario || comentario == '') && (!imagen || imagen == '') && (!video || video == '')) {
      logger.warn(`${fileMethod} | Se requiere que envies un comentario, una imagen o un video`)
      return next(boom.badRequest('Se requiere que envies un comentario, una imagen o un video'))
    }

    const [existUser] = await userService.getEmpresaByUserId(usuario_id_origen)
    if (!existUser) {
      logger.warn(`${fileMethod} | No se encontro el usuario con el id: ${usuario_id_origen}`)
      return next(boom.badRequest(`No se encontro el usuario con el id: ${usuario_id_origen}`))
    }

    logger.info(`${fileMethod} | Usuario origen: ${JSON.stringify(existUser)}`)

    publication.empresa_id = existUser.emp_id
    publication.imagen = imagen
    publication.video = video
    publication.usuario_id_origen = usuario_id_origen
    publication.tipo_origen = tipo_origen
    publication.comentario = comentario
    publication.tipo_destino = tipo_destino

    if (imagen) {
      const location_image = await uploadImageS3.uploadImage2(imagen, pathBucket)
      publication.imagen = location_image
      logger.info(`${fileMethod} | Se guarda exitosamente la imagen: ${JSON.stringify(location_image)}`)
    }

    if (video) {
      let location_video
      const regex = /^(https?\:\/\/)?(www\.youtube\.com|youtu\.?be)\/.+$/
      if (regex.test(video)) {
        location_video = video
      } else {
        location_video = await uploadVideoS3.uploadVideo2(video, 'publicacionesVideo')
      }
      publication.video = location_video
      logger.info(`${fileMethod} | Se guarda exitosamente el video: ${JSON.stringify(location_video)}`)
    }

    logger.info(`${fileMethod} | Objeto para guardar publicación: ${JSON.stringify(publication)}`)

    const publication_id = await publicationService.crearPublicacion(publication)
    logger.info(`${fileMethod} | Id de publicación insertada: ${JSON.stringify(publication_id)}`)

    if (galeria.length > 0) {
      for (let img of galeria) {
        const location_image = await uploadImageS3.uploadImage2(img, pathBucket)
        await publicationService.saveImageGalery(location_image, publication_id.insertId)
      }
    }

    const publication_created = await publicationService.obtenerPublicacionCreada(publication_id.insertId)
    logger.info(`${fileMethod} | Publicación creada: ${JSON.stringify(publication_created)}`)

    const publication_galery = await publicationService.obtenerGaleria(publication_id.insertId)
    logger.info(`${fileMethod} | Publicación creada: ${JSON.stringify(publication_galery)}`)
    //data:image/png;base64
    //data:video/mp4;base64

    const encryptedResponse = await cipher.encryptData(JSON.stringify({
      error: false,
      results: {
        publication_created,
        publication_galery
      }
    }), keyCipher)

    res.send(encryptedResponse)

  } catch (error) {
    next(error)
  }
}

exports.crearComentario = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/publications.js - method: crearComentario`
  try {
    const parsedData = typeof req.decryptedBody === 'string' ? JSON.parse(req.decryptedBody) : req.decryptedBody
    const { id_publicacion, usuario_id, imagen, video, comentario } = parsedData

    let publication = {}
    publication.imagen = imagen
    publication.video = video

    logger.info(`${fileMethod} | Se recibe la siguiente info para crear una publicación: ${JSON.stringify(parsedData)}`)

    const [publicacion] = await publicationService.obtenerPublicacionCreada(id_publicacion)
    if (!publicacion) {
      logger.warn(`${fileMethod} | No se encontro la publicación con el id: ${id_publicacion}`)
      return next(boom.badRequest(`No se encontro la publicación con el id: ${id_publicacion}`))
    }

    logger.info(`${fileMethod} | La publicación encontrada para comentar es: ${JSON.stringify(publicacion)}`)

    if (imagen) {
      const location_image = await uploadImageS3.uploadImage2(imagen, 'publicacionesImg')
      publication.imagen = location_image
      logger.info(`${fileMethod} | Se guarda exitosamente la imagen: ${JSON.stringify(location_image)}`)
    }

    if (video) {
      let location_video
      const regex = /^(https?\:\/\/)?(www\.youtube\.com|youtu\.?be)\/.+$/
      if (regex.test(video)) {
        location_video = video
      } else {
        location_video = await uploadVideoS3.uploadVideo2(video, 'publicacionesVideo')
      }
      publication.video = location_video
      logger.info(`${fileMethod} | Se guarda exitosamente el video: ${JSON.stringify(location_video)}`)
    }

    publication.id_publicacion = id_publicacion
    publication.usuario_id = usuario_id
    publication.comentario = comentario

    const creacion_comentario = await publicationService.crearComentario(publication)
    const comentario_creado = await publicationService.obtenerComentarioCreado(creacion_comentario.insertId)

    const encryptedResponse = await cipher.encryptData(JSON.stringify({
      error: false,
      results: {
        comentario_creado
      }
    }), keyCipher)

    res.send(encryptedResponse)
  } catch (error) {
    next(error)
  }
}

exports.editarComentario = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/publications.js - method: editarComentario`
  try {
    const parsedData = typeof req.decryptedBody === 'string' ? JSON.parse(req.decryptedBody) : req.decryptedBody
    const { id_comentario, id_publicacion, usuario_id, imagen, video, comentario } = parsedData

    let valor_video
    let video_bd

    let valor_imagen
    let imagen_bd

    logger.info(`${fileMethod} | Se recibe la siguiente info para editar una publicación: ${JSON.stringify(parsedData)}`)

    const [comentario_obtenido] = await publicationService.obtenerComentarioCreado(id_comentario)

    const regex_s3 = /^https:\/\/mycredibusinessbucketapp\.s3\.amazonaws\.com\/.*/

    const validarBase64Video = (video) => /^data:video\/mp4;base64,/.test(video)
    const validarYoutube = (video) => /^https:\/\/www\.youtube\.com\/.*$/.test(video)
    const esCadenaVaciaVideo = (video) => video === ''
    const esUndefinedVideo = (video) => video === undefined

    const validacionesVideo = [
      { check: esUndefinedVideo, valor: 4 },
      { check: esCadenaVaciaVideo, valor: 3 },
      { check: validarBase64Video, valor: 1 },
      { check: validarYoutube, valor: 2 }
    ]

    for (let { check, valor } of validacionesVideo) {
      if (check(video)) {
        valor_video = valor
        break
      }
    }

    switch (valor_video) {
      case 1:
        let video_base64 = video.split(',')[1]
        try {
          atob(video_base64)
          video_bd = await uploadVideoS3.uploadVideo2(video, 'publicacionesVideo')
        } catch (e) {
          logger.error(`${fileMethod} | Base 64 invalido ${e}`)
          return next(boom.badRequest(`Base 64 invalido ${e}`))
        }
        break
      case 2:
        video_bd = video
        break
      case 3:
        video_bd = video
        break
      case 4:
        logger.warn(`${fileMethod} | Se requiere que envies un comentario, una imagen o un video`)
        return next(boom.badRequest('Se requiere que envies un comentario, una imagen o un video'))
    }

    if (regex_s3.test(comentario_obtenido.video)) {
      await uploadImageS3.deleteFileFromS3(comentario_obtenido.video)
    }

    const validarBase64Imagen = (imagen) => /^data:image\/png;base64,/.test(imagen)
    const esCadenaVaciaImagen = (imagen) => imagen === ''
    const esUndefinedImagen = (imagen) => imagen === undefined

    const validacionesImagen = [
      { check: esUndefinedImagen, valor: 3 },
      { check: esCadenaVaciaImagen, valor: 2 },
      { check: validarBase64Imagen, valor: 1 }
    ]

    for (let { check, valor } of validacionesImagen) {
      if (check(imagen)) {
        valor_imagen = valor
        break
      }
    }

    switch (valor_imagen) {
      case 1:
        let imagen_base64 = imagen.split(',')[1]
        try {
          atob(imagen_base64)
          imagen_bd = await uploadImageS3.uploadImage2(imagen, 'publicacionesImg')
        } catch (e) {
          logger.error(`${fileMethod} | Base 64 invalido ${e}`)
          return next(boom.badRequest(`Base 64 invalido ${e}`))
        }
        break
      case 2:
        imagen_bd = imagen
        break
      case 3:
        logger.warn(`${fileMethod} | Se requiere que envies un comentario, una imagen o un video`)
        return next(boom.badRequest('Se requiere que envies un comentario, una imagen o un video'))
      default:
        break
    }

    if (regex_s3.test(comentario_obtenido.imagen)) {
      await uploadImageS3.deleteFileFromS3(comentario_obtenido.imagen)
      logger.info(`${fileMethod} | Se elimino el objeto ${comentario_obtenido.imagen}`)
    }

    const obj_update_coment = {
      id_comentario,
      id_publicacion,
      usuario_id,
      imagen_bd,
      video_bd,
      comentario
    }

    await publicationService.updateComent(obj_update_coment)

    const comentario_creado = await publicationService.obtenerComentarioCreado(id_comentario)

    const encryptedResponse = await cipher.encryptData(JSON.stringify({
      error: false,
      results: {
        comentario_creado
      }
    }), keyCipher)

    res.send(encryptedResponse)

  } catch (error) {
    next(error)
  }
}

exports.likePublicacion = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/publications.js - method: likePublicacion`
  try {
    const parsedData = typeof req.decryptedBody === 'string' ? JSON.parse(req.decryptedBody) : req.decryptedBody
    logger.info(`${fileMethod} | Se recibe la siguiente info para dar like a publicacion: ${JSON.stringify(parsedData)}`)

    const [user_liked] = await publicationService.isLikedPublicationsByUser(parsedData)

    if (user_liked.likes_by_user > 0) {
      const obtener_like = await publicationService.obtenerLikePublicationLikes(parsedData.id_publicacion)
      const encryptedResponse = await cipher.encryptData(JSON.stringify({
        error: false,
        message: `El usuario: ${parsedData.usuario_id} no tiene permitido dar más de 1 like a una publicación`,
        results: {
          likes: obtener_like.length
        }
      }), keyCipher)

      return res.send(encryptedResponse)
    }

    const save_like = await publicationService.likePublicacion(parsedData)

    const obtener_like = await publicationService.obtenerLikePublication(save_like.insertId)

    const encryptedResponse = await cipher.encryptData(JSON.stringify({
      error: false,
      results: {
        obtener_like,
        likes: obtener_like.length
      }
    }), keyCipher)

    res.send(encryptedResponse)
  } catch (error) {
    next(error)
  }
}

exports.disLikePublicacion = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/publications.js - method: disLikePublicacion`
  try {
    let dislike
    const parsedData = typeof req.decryptedBody === 'string' ? JSON.parse(req.decryptedBody) : req.decryptedBody
    logger.info(`${fileMethod} | Se recibe la siguiente info para dar dislike a publicacion: ${JSON.stringify(parsedData)}`)

    const [user_liked] = await publicationService.isLikedPublicationsByUser(parsedData)

    if (user_liked.likes_by_user > 0) {
      dislike = await publicationService.disLikePublicacion(parsedData)
    }

    const [likes] = await publicationService.obtenerNumeroLikesPublicacion(parsedData.id_publicacion)

    const encryptedResponse = await cipher.encryptData(JSON.stringify({
      error: false,
      results: {
        dislike,
        likes: likes.likes
      }
    }), keyCipher)

    res.send(encryptedResponse)
  } catch (error) {
    next(error)
  }
}

exports.likeComentario = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/publications.js - method: likeComentario`
  try {
    const parsedData = typeof req.decryptedBody === 'string' ? JSON.parse(req.decryptedBody) : req.decryptedBody
    logger.info(`${fileMethod} | Se recibe la siguiente info para dar like a comentario: ${JSON.stringify(parsedData)}`)

    const [user_liked] = await publicationService.isLikedComentsByUser(parsedData)
    if (user_liked.likes_by_user > 0) {
      const obtener_like = await publicationService.obtenerLikeComentLikes(parsedData.coment_id)
      const encryptedResponse = await cipher.encryptData(JSON.stringify({
        error: false,
        message: `El usuario: ${parsedData.usuario_id} no tiene permitido dar más de 1 like a un comentario`,
        results: {
          likes: obtener_like.length
        }
      }), keyCipher)

      return res.send(encryptedResponse)
    }

    const save_like = await publicationService.likeComent(parsedData)

    const obtener_like = await publicationService.obtenerLikeComent(save_like.insertId)

    const encryptedResponse = await cipher.encryptData(JSON.stringify({
      error: false,
      results: {
        obtener_like,
        likes: obtener_like.length
      }
    }), keyCipher)

    res.send(encryptedResponse)
  } catch (error) {
    next(error)
  }
}

exports.disLikeComentario = async (req, res, next) => {
  const fileMethod = `file: src/controllers/api/publications.js - method: disLikeComentario`
  try {
    let dislike
    const parsedData = typeof req.decryptedBody === 'string' ? JSON.parse(req.decryptedBody) : req.decryptedBody
    logger.info(`${fileMethod} | Se recibe la siguiente info para dar dislike a comentario: ${JSON.stringify(parsedData)}`)

    const [user_liked] = await publicationService.isLikedComentsByUser(parsedData)

    if (user_liked.likes_by_user > 0) {
      dislike = await publicationService.disLikeComentario(parsedData)
    }

    const [likes] = await publicationService.obtenerNumeroLikesComentarios(parsedData.coment_id)

    const encryptedResponse = await cipher.encryptData(JSON.stringify({
      error: false,
      results: {
        dislike,
        likes: likes.likes
      }
    }), keyCipher)

    res.send(encryptedResponse)
  } catch (error) {
    next(error)
  }
}

exports.createPublication = async (req, res, next) => {
  try {
    const { usuario_id, imagen, video, comentario, origen, destino } = req.body;

    // const { comentario } = publication
    if (!comentario && !imagen && !video) return next(boom.badRequest('Empty publication'))

    const [existUser] = await userService.getEmpresaByUserId(usuario_id)
    if (!existUser) return next(boom.badRequest('User incorrect or does not exist...'))
    let publication = {};
    publication.empresa_id = existUser.emp_id
    publication.imagen = imagen
    publication.usuario_id = usuario_id
    publication.origen = origen
    publication.comentario = comentario
    publication.destino = destino

    if (imagen) {
      const pathBucket = 'publicacionesImg';
      const Location = await uploadImageS3.uploadImage2(imagen, pathBucket)
      publication.imagen = Location
    }

    const publicacionId = await publicationService.create(publication)

    if (video) {
      const [file] = video
      const url = await uploadVideoS3.uploadVideo2(video, 'publicacionesVideo')
      await publicationService.postPublicationVideo(publicacionId, url)
    }

    const publicationById = await publicationService.getById(publicacionId)
    //data:image/png;base64
    res.status(200).json({
      error: false,
      numberEntries: 1,
      pageNumber: null,
      results: publicationById
    })
  } catch (err) {
    next(err)
  }
}

exports.uploadVideoEmpresa = async (req, res, next) => {
  try {
    const { emp_id, video } = req.body;
    if (!video) return next(boom.badRequest('Empty video'))
    let url


    if (video) {
      const [file] = video
      const regex = /^(https?\:\/\/)?(www\.youtube\.com|youtu\.?be)\/.+$/
      if (regex.test(video)) {
        url = video
      } else {
        url = await uploadVideoS3.uploadVideo2(video, 'videoCorporativo')
      }
      const setVideo = await publicationService.postCorporativoVideo(emp_id, url)
      console.log(setVideo)
    }

    const uploadVideo = await companiesService.getEmpresa(emp_id)

    res.status(200).json({
      error: false,
      results: uploadVideo
    })
  } catch (err) {
    next(err)
  }
}


exports.uploadImagenEmpresa = async (req, res, next) => {
  try {
    const { emp_id, imagen } = req.body;

    if (!imagen) return next(boom.badRequest('Empty imagen'))

    if (imagen) {
      const pathBucket = 'bannerEmpresa';
      const Location = await uploadImageS3.uploadImage2(imagen, pathBucket)
      await publicationService.postCorporativoBanner(emp_id, Location)
    }

    const uploadImagen = await companiesService.getEmpresa(emp_id)

    res.status(200).json({
      error: false,
      results: uploadImagen
    })
  } catch (err) {
    next(err)
  }
}


exports.uploadLogoEmpresa = async (req, res, next) => {
  try {
    const { emp_id, imagen } = req.body;

    if (!imagen) return next(boom.badRequest('Empty imagen'))

    if (imagen) {
      const pathBucket = 'logoEmpresa';
      const Location = await uploadImageS3.uploadImage2(imagen, pathBucket)
      await publicationService.postCorporativoLogo(emp_id, Location)
    }

    const uploadImagen = await companiesService.getEmpresa(emp_id)

    res.status(200).json({
      error: false,
      results: uploadImagen
    })
  } catch (err) {
    next(err)
  }
}

exports.editPublication = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const { publicationId } = req.params
    const { comentario } = req.body

    const publicationUpdated = await publicationService.update(publicationId, comentario)

    res.status(200).json({
      error: false,
      numberEntries: null,
      pageNumber: null,
      results: publicationUpdated
    })
  } catch (err) {
    next(err)
  }
}

exports.deletePublication = async (req, res, next) => {
  try {
    debug('A request come to DELETE /api/publicaciones/:publicationId')
    const { publicationId } = req.params
    const [existPublication] = await publicationService.getById(publicationId)
    if (!existPublication) return next(boom.badRequest('Publication incorrect or does not exist...'))
    await publicationService.delete(publicationId)
    res.json({
      error: false,
      numberEntries: null,
      pageNumber: null,
      results: {
        publicacion_id: Number(publicationId),
        deleted: true
      }
    })
  } catch (err) {
    next(err)
  }
}


exports.getPublicationsFromMyNetwork = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)

    console.log(req.params)

    const { usuario } = req.params

    const { query } = req

    if (query.page === 0) return next(boom.badRequest('Page not allowed.'))
    if (query.page && !query.limit) return next(boom.badRequest('Limit and Page queries needed.'))
    if (!query.page && query.limit) query.page = 1


    const rol = await publicationService.getRolByUser(usuario)

    const { publicaciones, total } = query.q === 'notAll' ? await publicationService.getPublicacionesRedNueva(usuario, query) : await publicationService.getPublicacionesRedTodas(usuario, rol, query)

    const totalPublicaciones = total
    const totalPaginas = Math.ceil(total / query.limit)


    const [usr] = await userService.getById(usuario)
    if (!usr) {
      return next(boom.badRequest('No existe usuario con este ID'))
    }

    // Obtener publicaciones
    let publicacionesCB = []
    if (usr.usu_tipo == 4) {
      publicacionesCB = await userService.getPublicacionesCB()
    }

    if (query.page > totalPaginas) return next(boom.badRequest('Page not allowed.'))
    // Obtener comentarios y detalles de interacciones
    if (publicaciones !== null || publicaciones === undefined || publicaciones.length !== 0) {
      for (let i = 0; i < publicaciones.length; i++) {
        const pubID = publicaciones[i].id
        const comentarios = await publicationService.getComentariosPublicacion(pubID)
        // Obtener subcomentarios y agregarlos al objeto de comentarios
        for (let j = 0; j < comentarios.length; j++) {
          const commentID = comentarios[j].comentario_id
          // Obtener likes
          const likes = await publicationService.getCommentsLikes(commentID)
          comentarios[j].likes = likes
          const subcomentarios = await publicationService.getSubCommentsByCommentID(commentID)
          // Obtener likes de subcomentarios y agregarlos al objeto de subcomentarios
          for (let h = 0; h < subcomentarios.length; h++) {
            const subcommentUUID = subcomentarios[h].subcomentario_uuid
            const likes = await publicationService.getSubCommentsLikes(subcommentUUID)
            subcomentarios[h].likes = likes
          }
          comentarios[j].subcomentarios = subcomentarios
        }
        publicaciones[i].comentarios = comentarios
        const interacciones = await publicationService.getPublicationInteractions(pubID)
        publicaciones[i].interacciones = interacciones
      }
    }

    // Obtener eventos públicos
    const eventosPublicos = await eventsService.getEventsByUserNetwork(usuario)
    // Obtener eventos privados a donde fuiste invitado
    const eventosPrivados = await eventsService.getPrivateEventsByUserId(usuario)

    // Obtener horarios
    for (let i = 0; i < eventosPublicos.length; i++) {
      const [horario] = await eventsService.getSchedule(eventosPublicos[i].evento_id)
      eventosPublicos[i].horario = horario
    }
    for (let i = 0; i < eventosPrivados.length; i++) {
      const [horario] = await eventsService.getSchedule(eventosPrivados[i].evento_id)
      eventosPrivados[i].horario = horario
    }

    // Hacer un merge de los 3 arreglos
    const combinados = [...publicaciones, ...eventosPublicos, ...eventosPrivados]

    // Crar nueva estructura
    const nuevoArreglo = []
    for (let i = 0; i < combinados.length; i++) {
      const publicacion = combinados[i]
      const nuevoObjeto = {}
      nuevoObjeto.tipo = publicacion.tipo
      if (publicacion.tipo === 'Publicacion') {
        nuevoObjeto.data_evento = null
        nuevoObjeto.data_publicacion = publicacion
      } else {
        nuevoObjeto.data_evento = publicacion
        nuevoObjeto.data_publicacion = null
      }
      nuevoArreglo.push(nuevoObjeto)
    }

    // Hacer un sort por la fecha
    nuevoArreglo.sort((a, b) => {
      const objA = a.tipo === 'Publicacion' ? a.data_publicacion : a.data_evento
      const objB = b.tipo === 'Publicacion' ? b.data_publicacion : b.data_evento
      return objA.created_at < objB.created_at ? 1 : -1
    })

    // return res.json({
    //   error: false,
    //   totalPublicaciones,
    //   totalPaginas,
    //   results: {
    //     publicaciones: nuevoArreglo,
    //     publicacionesCB
    //   }
    // })

    const encryptedResponse = await cipher.encryptData(JSON.stringify({
      error: false,
      totalPublicaciones,
      totalPaginas,
      results: {
        publicaciones: nuevoArreglo,
      }
    }), keyCipher);

    return res.send(encryptedResponse);
  } catch (err) {
    next(err)
  }
}

exports.getPublicationsFromUser = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const { usuario } = req.params

    const publicaciones = await publicationService.getPublicacionesUsuario(usuario)

    res.status(200).json({
      error: false,
      results: publicaciones
    })
  } catch (err) {
    next(err)
  }
}

exports.getPublicationComments = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const { publicationId } = req.params
    const [existPublication] = await publicationService.getById(publicationId)
    if (!existPublication) return next(boom.badRequest('Publication incorrect or does not exist...'))

    let { query: { user: userID } } = req
    userID = Math.abs(userID) || null

    const [existUser] = await userService.getById(userID)
    if (existUser && (existPublication.usuario_id !== userID)) {
      const { publicacion_id: publicationID } = existPublication
      await publicationService.inserPublicationVisit(publicationID, userID)
    }

    const publicationComments = await publicationService.getPublicationComments(publicationId)
    const [publicationDetails] = publicationComments
    const { comentarios } = publicationDetails
    const interacciones = await publicationService.getPublicationInteractions(publicationId)
    publicationDetails.interacciones = interacciones

    for (let i = 0; i < comentarios.length; i++) {
      const comentarioID = comentarios[i].id
      const likes = await publicationService.getCommentsLikes(comentarioID)
      comentarios[i].likes = likes
      const subcomentarios = await publicationService.getSubCommentsByCommentID(comentarioID)
      for (let j = 0; j < subcomentarios.length; j++) {
        const subcommentUUID = subcomentarios[j].subcomentario_uuid
        const likes = await publicationService.getSubCommentsLikes(subcommentUUID)
        subcomentarios[j].likes = likes
      }
      comentarios[i].subcomentarios = subcomentarios
    }

    return res.json({
      error: false,
      numberEntries: publicationComments.length !== 0 ? publicationComments.length : 0,
      pageNumber: null,
      results: publicationComments
    })
  } catch (err) {
    next(err)
  }
}

exports.createPublicationComment = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const { body, params: { id }, files: { imagen, video } } = req

    const [existPublication] = await publicationService.getById(id)
    if (!existPublication) return next(boom.badRequest('No existe publicación'))

    const [existUser] = await userService.getById(body.usuario_id)
    if (!existUser) return next(boom.badRequest('No existe usuario'))

    // Max 50 por hora
    const total = await publicationService.canPostACommentRightNow(body.usuario_id)
    if (total >= 50) return next(boom.tooManyRequests('Max 50 comments per hour'))

    if (imagen) {
      const [file] = imagen
      const Location = await uploadImageS3.uploadImageS3(file)
      body.imagen = Location
    }

    let url = null
    if (video) {
      const [file] = video
      url = await uploadImageS3.uploadImageS3(file)
    }

    const comment = await publicationService.addComment(id, body, url)

    // Termina
    res.status(200).json({
      error: false,
      results: comment
    })
  } catch (err) {
    next(err)
  }
}

exports.updatePublicationComment = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const { body, params } = req
    const { id } = params

    const [existePublicacion] = await publicationService.getById(id)
    if (!existePublicacion) return next(boom.badRequest('No existe publicación'))

    const [existeComentario] = await publicationService.getCommentById(body.comentario_id)
    if (!existeComentario) return next(boom.badRequest('No existe el comentario'))

    const comment = await publicationService.updateComment(id, body)

    res.status(200).json({
      error: false,
      results: comment
    })
  } catch (err) {
    next(err)
  }
}

exports.deletePublicationComment = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const { body, params } = req
    const { id } = params

    const [existePublicacion] = await publicationService.getById(id)
    if (!existePublicacion) return next(boom.badRequest('No existe la publicación'))

    const [existeComentario] = await publicationService.getCommentById(body.comentario_id)
    if (!existeComentario) return next(boom.badRequest('No existe el comentario'))

    await publicationService.deleteComment(body.comentario_id)

    res.status(200).json({
      error: false,
      results: {
        publicacion_id: Number(id),
        comentariod_id: body.comentario_id,
        deleted: true
      }
    })
  } catch (err) {
    next(err)
  }
}

exports.likePublication = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const { body } = req
    const { publicacion_id, usuario_id } = body

    const [existLike] = await publicationService.getLikeByIds(publicacion_id, usuario_id)

    if (!existLike) {
      // Max 50 likes per hour
      const numberLikes = await publicationService.canLikePublication(usuario_id)
      if (numberLikes >= 50) return next(boom.tooManyRequests('Max 50 likes per hour'))
      const like = await publicationService.addLike(publicacion_id, usuario_id)

      return res.status(200).json({
        error: false,
        pageNumber: null,
        numberEntries: 1,
        results: {
          added: true,
          publicacion_id,
          usuario_id,
          likeId: like.insertId
        }
      })
    }

    await publicationService.unLike(publicacion_id, usuario_id)

    res.status(200).json({
      error: false,
      pageNumber: null,
      numberEntries: 1,
      results: {
        removed: true,
        publicacion_id,
        usuario_id,
        likeId: existLike.id
      }
    })
  } catch (err) {
    next(err)
  }
}

exports.likePublicationComment = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const { body: { comentario_id: commentID, usuario_id: userID } } = req
    const [user] = await userService.getById(userID)
    if (!user) return next(boom.badRequest('Wrong user'))
    // 404 si comentario no existe
    const commentExists = await publicationService.commentExists(commentID)
    if (!commentExists) return next(boom.notFound('Comment not found'))
    const payload = await publicationService.likeComment(commentID, userID)
    res.status(201).json({
      error: false,
      results: {
        payload
      }
    })
  } catch (err) {
    next(err)
  }
}

exports.postSubComment = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const { body: { usuario: userID, comentario_id: commentID, comentario: comment } } = req
    // Si no existe usuario 400
    const [user] = await userService.getById(userID)
    if (!user) return next(boom.badRequest('Wrong user'))
    // Si no existe comentario 404
    const [originalComment] = await publicationService.getCommentById(commentID)
    if (!originalComment) return next(boom.notFound('Comment not found'))
    // Insertar en base de datos
    const subcomment = await publicationService.postSubComment(userID, commentID, comment)
    res.status(201).json({
      error: false,
      results: {
        subcomment
      }
    })
  } catch (err) {
    next(err)
  }
}

exports.editSubComment = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const { body: { usuario: userID, comentario_id: commentID, comentario: comment }, params: { uuid } } = req
    const edited = await publicationService.editSubComment(uuid, commentID, userID, comment)
    res.json({
      error: false,
      results: {
        edited
      }
    })
  } catch (err) {
    next(err)
  }
}

exports.deleteSubComment = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const { body: { usuario: userID, comentario_id: commentID }, params: { uuid } } = req
    // Existe comentario?
    const subComment = await publicationService.subcommentExists(uuid)
    if (!subComment) return next(boom.notFound('Subcomment not found'))
    // La peticion viene del autor?
    const { usuario_id: subCommentAuthor, comentario_id: subCommentOriginalComment } = subComment
    if (userID !== subCommentAuthor) return next(boom.badRequest('Wrong user'))
    if (commentID !== subCommentOriginalComment) return next(boom.badRequest('Wrong comment'))

    // Eliminar likes
    const deletedLikes = await publicationService.deleteSubCommentsLikes(uuid)
    const deletedSubcomment = await publicationService.deleteSubComment(uuid)
    // Eliminar subcomentario
    res.json({
      error: false,
      results: {
        deleted: Boolean(deletedSubcomment),
        likes: deletedLikes
      }
    })
  } catch (err) {
    next(err)
  }
}

exports.likeSubComment = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const { body: { usuario: userID }, params: { uuid } } = req
    const [user] = await userService.getById(userID)
    if (!user) return next(boom.badRequest('Wrong user'))
    // 404 si comentario no existe
    const subcommentExists = await publicationService.subcommentExists(uuid)
    if (!subcommentExists) return next(boom.notFound('Subcomment not found'))
    const payload = await publicationService.likeSubComment(uuid, userID)
    res.json({
      error: false,
      results: {
        payload
      }
    })
  } catch (err) {
    next(err)
  }
}

exports.getPublicationsFromCompany = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    let { params: { companyID } } = req
    companyID = Math.abs(companyID) || null
    if (!companyID) return next(boom.badRequest('Wrong ID'))
    const publications = await publicationService.getPublicationFromCompany(companyID)
    res.json({
      error: false,
      results: {
        publications
      }
    })
  } catch (err) {
    next(err)
  }
}

exports.getLatestPublications = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const publications = await publicationService.getLatestPublications()
    const total = publications.length || 0
    res.json({
      error: false,
      results: {
        total,
        publications
      }
    })
  } catch (err) {
    next(err)
  }
}

exports.getPubByID = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)

    const { pubID, usuID } = req.params

    if (!pubID || !usuID || isNaN(pubID) || isNaN(usuID)) return next(boom.badRequest('pubID and usuID are required and must be numeric.'))

    const usu = await userService.getById(usuID)
    if (usu.length !== 1) return next(boom.notFound('User not found.'))

    const result = await publicationService.getPublicacionByID(usuID, pubID)
    if (result.length !== 1) return next(boom.notFound('Publication not found.'))

    if (result.length === 1) {
      const pubID = result[0].id
      const comentarios = await publicationService.getComentariosPublicacion(pubID)
      // Obtener subcomentarios y agregarlos al objeto de comentarios
      for (let j = 0; j < comentarios.length; j++) {
        const commentID = comentarios[j].comentario_id
        // Obtener likes
        const likes = await publicationService.getCommentsLikes(commentID)
        comentarios[j].likes = likes
        const subcomentarios = await publicationService.getSubCommentsByCommentID(commentID)
        // Obtener likes de subcomentarios y agregarlos al objeto de subcomentarios
        for (let h = 0; h < subcomentarios.length; h++) {
          const subcommentUUID = subcomentarios[h].subcomentario_uuid
          const likes = await publicationService.getSubCommentsLikes(subcommentUUID)
          subcomentarios[h].likes = likes
        }
        comentarios[j].subcomentarios = subcomentarios
      }
      result[0].comentarios = comentarios
      const interacciones = await publicationService.getPublicationInteractions(pubID)
      result[0].interacciones = interacciones
    }

    const [{ ...rest }] = result

    return res.json({ error: false, results: rest })
  } catch (error) {
    next(error)
  }
}
