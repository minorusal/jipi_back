'use strict'

const express = require('express')
const multerPublication = require('../../utils/multerOpts/publications')
const validations = require('../../utils/middlewares/validationHandler')
const { createPublication, updatePublication, createComment, updateComment, deleteComment, likeComment, createSubComment, editSubComment, deleteSubComment, likeSubComment } = require('../../utils/schemas/publications')
const decryptMiddleware = require('../../utils/middlewares/cipherMiddleware')

const publicationsController = require('../../controllers/api/publications')
const authMiddleware = require('../../utils/middlewares/authMiddleware')
const { upload, handleDataField, handleImageGaleriaPublicacion } = require('../../utils/middlewares/publicacionesMiddleware')
const router = express.Router()

/**
 * @swagger
 * /api/publicaciones/crearPublicacion:
 *   post:
 *     summary: Crear una nueva publicación - Cifrado = [true]
 *     description: Este endpoint permite crear una nueva publicación, que puede incluir imágenes, videos y un comentario. También admite la creación de una galería de imágenes asociada a la publicación.
 *     operationId: createPublication
 *     tags:
 *       - Publicaciones
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               data:
 *                 type: string
 *                 description: Datos de la publicación en formato JSON (usuario_id_origen, comentario, tipo_origen, tipo_destino)
 *                 example: '{"usuario_id_origen": 84, "comentario": "ese es un comentario de prueba", "tipo_origen": "corporativo", "tipo_destino": "todos"}'
 *               imagen:
 *                 type: string
 *                 format: binary
 *                 description: Imagen principal (puede estar vacía)
 *               video:
 *                 type: string
 *                 format: binary
 *                 description: Video asociado a la publicación (puede estar vacío)
 *               galeria:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Lista de imágenes para la galería de la publicación (puede tener hasta 20 imágenes)
 *                 example: ["image1", "image2", "image3"]
 *     responses:
 *       '200':
 *         description: Publicación creada correctamente.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: boolean
 *                   description: Indica si hubo un error en la creación de la publicación.
 *                   example: false
 *                 results:
 *                   type: object
 *                   properties:
 *                     publication_created:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           video:
 *                             type: string
 *                             description: URL del video (vacío si no se ha proporcionado)
 *                             example: ""
 *                           imagen:
 *                             type: string
 *                             description: URL de la imagen (vacío si no se ha proporcionado)
 *                             example: ""
 *                           description:
 *                             type: string
 *                             description: El comentario o descripción de la publicación.
 *                             example: "Este es un comentario de prueba sobre la publicación."
 *                           usuario_id_origen:
 *                             type: integer
 *                             description: ID del usuario que creó la publicación.
 *                             example: 84
 *                           tipo_origen:
 *                             type: string
 *                             description: Tipo de origen de la publicación (corporativo o personal).
 *                             example: "corporativo"
 *                           tipo_destino:
 *                             type: string
 *                             description: Tipo de destino de la publicación (todos, administrador, proveedor, cliente).
 *                             example: "todos"
 *                           se_creo:
 *                             type: string
 *                             description: Fecha de creación de la publicación.
 *                             example: "2024-11-07T22:56:42.000Z"
 *                           se_actualizo:
 *                             type: string
 *                             description: Fecha de la última actualización de la publicación.
 *                             example: "2024-11-07T22:56:42.000Z"
 *                     publication_galery:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           url:
 *                             type: string
 *                             description: URL de una imagen en la galería asociada a la publicación.
 *                             example: "https://mycredibusinessbucketapp.s3.amazonaws.com/publicacionesImg/5E4debBculOGI58mhzLp7X2z66z3M0rfoHIvkDe8ZWdy.png"
 *       '400':
 *         description: Error de validación de datos en la solicitud.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Datos inválidos o incompletos"
 *       '500':
 *         description: Error interno en el servidor.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Error en el servidor, por favor intente más tarde."
 */
router.post('/crearPublicacion', upload, handleDataField, publicationsController.crearPublicacion)

/**
 * @swagger
 * /api/publicaciones/editarPublicacion:
 *   put:
 *     summary: "Editar una publicación - Cifrado = [true]" 
 *     description: "Este endpoint permite editar una publicación existente"
 *     operationId: editarPublicacion
 *     tags:
 *       - Publicaciones
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - name: data
 *         in: formData
 *         description: "Datos cifrados que contienen la información para editar la publicación (id_publicacion, usuario_id_origen, comentario, tipo_origen, tipo_destino)."
 *         required: true
 *         type: string
 *         format: byte  # Si es necesario, usa byte para datos codificados (base64 u otros)
 *       - name: imagen
 *         in: formData
 *         description: "Imagen principal de la publicación (puede estar vacía o contener una imagen)."
 *         required: false
 *         type: file
 *       - name: video
 *         in: formData
 *         description: "Video asociado a la publicación (puede estar vacío o contener un video)."
 *         required: false
 *         type: file
 *       - name: galeria
 *         in: formData
 *         description: "Galería de imágenes asociada a la publicación (puede contener hasta 20 imágenes)."
 *         required: false
 *         type: array
 *         items:
 *           type: file
 *     responses:
 *       '200':
 *         description: "Publicación editada correctamente"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: boolean
 *                   description: "Indica si hubo un error al editar la publicación."
 *                   example: false
 *                 results:
 *                   type: object
 *                   properties:
 *                     publication_created:
 *                       type: object
 *                       properties:
 *                         video:
 *                           type: string
 *                           description: "URL del video (vacío si no se ha proporcionado)"
 *                           example: ""
 *                         imagen:
 *                           type: string
 *                           description: "URL de la imagen (vacío si no se ha proporcionado)"
 *                           example: ""
 *                         description:
 *                           type: string
 *                           description: "El comentario o descripción de la publicación."
 *                           example: "Este es un comentario de prueba sobre la publicación."
 *                         usuario_id_origen:
 *                           type: integer
 *                           description: "ID del usuario que editó la publicación."
 *                           example: 84
 *                         tipo_origen:
 *                           type: string
 *                           description: "Tipo de origen de la publicación (corporativo o personal)."
 *                           example: "corporativo"
 *                         tipo_destino:
 *                           type: string
 *                           description: "Tipo de destino de la publicación (todos, administrador, proveedor, cliente)."
 *                           example: "todos"
 *                         se_creo:
 *                           type: string
 *                           description: "Fecha de creación de la publicación."
 *                           example: "2024-11-07T22:56:42.000Z"
 *                         se_actualizo:
 *                           type: string
 *                           description: "Fecha de la última actualización de la publicación."
 *                           example: "2024-11-07T22:56:42.000Z"
 *                     publication_galery:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           url:
 *                             type: string
 *                             description: "URL de una imagen en la galería asociada a la publicación."
 *                             example: "https://mycredibusinessbucketapp.s3.amazonaws.com/publicacionesImg/5E4debBculOGI58mhzLp7X2z66z3M0rfoHIvkDe8ZWdy.png"
 *       '400':
 *         description: "Error de validación de datos en la solicitud."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Datos inválidos o incompletos"
 *       '500':
 *         description: "Error interno en el servidor."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Error en el servidor, por favor intente más tarde."
 */
router.put('/editarPublicacion', upload, handleDataField, publicationsController.editarPublicacion)

/**
 * @swagger
 * /api/publicaciones/uploadImageGaleriaPublicacion:
 *   post:
 *     summary: "Subir imagen a la galería de la publicación"
 *     description: "Este endpoint permite subir una imagen a la galería de una publicación existente"
 *     operationId: uploadImageGaleriaPublicacion
 *     tags:
 *       - Publicaciones
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - name: imagen
 *         in: formData
 *         description: "Imagen que se subirá a la galería de la publicación (solo una imagen)."
 *         required: true
 *         type: file
 *     responses:
 *       '200':
 *         description: "Imagen subida correctamente"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: boolean
 *                   description: "Indica si hubo un error al subir la imagen."
 *                   example: false
 *                 results:
 *                   type: object
 *                   properties:
 *                     image_url:
 *                       type: string
 *                       description: "URL de la imagen subida a la galería de la publicación."
 *                       example: "https://mycredibusinessbucketapp.s3.amazonaws.com/publicacionesImg/5E4debBculOGI58mhzLp7X2z66z3M0rfoHIvkDe8ZWdy.png"
 *       '400':
 *         description: "Error de validación de la imagen en la solicitud."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Formato de imagen no válido o imagen demasiado grande"
 *       '500':
 *         description: "Error interno en el servidor."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Error en el servidor, por favor intente más tarde."
 */
router.post('/uploadImageGaleriaPublicacion', upload, handleImageGaleriaPublicacion, publicationsController.uploadImageGaleriaPublicacion)

/**
 * @openapi
 * /api/publicaciones/crearComentario:
 *   post:
 *     summary: "Crear un comentario para una publicación - Cifrado = [true]"
 *     description: "Este endpoint permite crear un comentario para una publicación específica."
 *     operationId: crearComentario
 *     tags:
 *          - Publicaciones
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id_publicacion:
 *                 type: integer
 *                 description: "ID de la publicación para la que se está creando el comentario."
 *               usuario_id:
 *                 type: integer
 *                 description: "ID del usuario que está creando el comentario."
 *               imagen:
 *                 type: string
 *                 description: "URL de la imagen asociada al comentario (opcional)."
 *                 example: ""
 *               video:
 *                 type: string
 *                 description: "URL del video asociado al comentario (opcional)."
 *                 example: "https://www.youtube.com/watch?v=-RsxojIJ4ZU"
 *               comentario:
 *                 type: string
 *                 description: "Texto del comentario."
 *                 example: "Este es un comentario de prueba sobre la publicación."
 *     responses:
 *       '200':
 *         description: "Comentario creado exitosamente."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: boolean
 *                   description: "Indica si hubo un error en el proceso."
 *                   example: false
 *                 results:
 *                   type: object
 *                   properties:
 *                     comentario_creado:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           publicacion_id:
 *                             type: integer
 *                             description: "ID de la publicación relacionada con el comentario."
 *                             example: 14
 *                           usuario_id:
 *                             type: integer
 *                             description: "ID del usuario que hizo el comentario."
 *                             example: 95
 *                           comentario:
 *                             type: string
 *                             description: "Texto del comentario."
 *                             example: "Este es un comentario de prueba sobre la publicación."
 *                           imagen:
 *                             type: string
 *                             description: "URL de la imagen asociada al comentario."
 *                             example: ""
 *                           video:
 *                             type: string
 *                             description: "URL del video asociado al comentario."
 *                             example: "https://mycredibusinessbucketapp.s3.amazonaws.com/publicacionesVideo/6dzaSxYJgsG0cQN0lOSKel6yX59Peso6UVJAdD3zdJoG.mp4"
 *       '400':
 *         description: "Solicitud incorrecta, los datos proporcionados no son válidos."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: boolean
 *                   description: "Indica que hubo un error."
 *                   example: true
 *                 message:
 *                   type: string
 *                   description: "Descripción del error."
 *                   example: "Datos inválidos"
 *       '500':
 *         description: "Error interno en el servidor."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: boolean
 *                   description: "Indica que hubo un error."
 *                   example: true
 *                 message:
 *                   type: string
 *                   description: "Descripción del error."
 *                   example: "Error al crear el comentario"
 */
router.post('/crearComentario', decryptMiddleware, publicationsController.crearComentario)

/**
 * @openapi
 * /api/publicaciones/editarComentario:
 *    put:
 *       summary: "Editar un comentario de una publicación - Cifrado = [true]"
 *       description: "Este endpoint permite editar un comentario de una publicación existente."
 *       tags:
 *          - Publicaciones
 *       requestBody:
 *         required: true
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id_comentario:
 *                   type: integer
 *                   description: "ID del comentario a editar"
 *                 id_publicacion:
 *                   type: integer
 *                   description: "ID de la publicación a la que pertenece el comentario"
 *                 usuario_id:
 *                   type: integer
 *                   description: "ID del usuario que está editando el comentario"
 *                 imagen:
 *                   type: string
 *                   description: "URL de la imagen asociada al comentario (opcional)"
 *                   example: ""
 *                 video:
 *                   type: string
 *                   description: "URL del video asociado al comentario (opcional)"
 *                   example: "https://www.youtube.com/watch?v=-RsxojIJ4ZU"
 *                 comentario:
 *                   type: string
 *                   description: "Nuevo texto del comentario"
 *                   example: "Este es un comentario de prueba sobre la publicación."
 *       responses:
 *         '200':
 *           description: "Comentario editado correctamente"
 *           content:
 *             application/json:
 *               schema:
 *                 type: object
 *                 properties:
 *                   error:
 *                     type: boolean
 *                     example: false
 *                   results:
 *                     type: object
 *                     properties:
 *                       comentario_creado:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             publicacion_id:
 *                               type: integer
 *                               example: 14
 *                             usuario_id:
 *                               type: integer
 *                               example: 95
 *                             comentario:
 *                               type: string
 *                               example: "Este es un comentario de prueba sobre la publicación."
 *                             imagen:
 *                               type: string
 *                               example: ""
 *                             video:
 *                               type: string
 *                               example: "https://www.youtube.com/watch?v=-RsxojIJ4ZU"
 *         '400':
 *           description: "Error al editar el comentario. Datos no válidos o el comentario no encontrado."
 *           content:
 *             application/json:
 *               schema:
 *                 type: object
 *                 properties:
 *                   error:
 *                     type: boolean
 *                     example: true
 *                   message:
 *                     type: string
 *                     example: "Comentario no encontrado o datos inválidos."
 */
router.put('/editarComentario', decryptMiddleware, publicationsController.editarComentario)

/**
 * @openapi
 * /api/publicaciones/likePublicacion:
 *   post:
 *     summary: "Registrar un 'like' para una publicación - Cifrado = [true]"
 *     description: "Este endpoint permite registrar un 'like' de un usuario para una publicación."
 *     tags:
 *       - Publicaciones
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id_publicacion:
 *                 type: integer
 *                 description: "ID de la publicación a la que se le está dando 'like'."
 *                 example: 14
 *               usuario_id:
 *                 type: integer
 *                 description: "ID del usuario que está dando el 'like'."
 *                 example: 95
 *     responses:
 *       '200':
 *         description: "Like registrado correctamente para la publicación."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: boolean
 *                   example: false
 *                 results:
 *                   type: object
 *                   properties:
 *                     obtener_like:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           publicacion_id:
 *                             type: integer
 *                             example: 14
 *                           video:
 *                             type: integer
 *                             example: 95
 *       '400':
 *         description: "Error al registrar el 'like'. Datos no válidos o problema interno."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Error al registrar el like. Verifique los datos."
 */
router.post('/likePublicacion', decryptMiddleware, publicationsController.likePublicacion)

/**
 * @openapi
 * /api/publicaciones/disLikePublicacion:
 *   post:
 *     summary: "Registrar un 'dislike' para una publicación - Cifrado = [true]"
 *     description: "Este endpoint permite registrar un 'dislike' de un usuario para una publicación."
 *     tags:
 *       - Publicaciones
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id_publicacion:
 *                 type: integer
 *                 description: "ID de la publicación a la que se le está dando 'dislike'."
 *                 example: 14
 *               usuario_id:
 *                 type: integer
 *                 description: "ID del usuario que está dando el 'dislike'."
 *                 example: 96
 *     responses:
 *       '200':
 *         description: "Dislike registrado correctamente para la publicación."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: boolean
 *                   example: false
 *                 results:
 *                   type: object
 *                   properties:
 *                     likes:
 *                       type: integer
 *                       example: 0
 *       '400':
 *         description: "Error al registrar el 'dislike'. Datos no válidos o problema interno."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Error al registrar el dislike. Verifique los datos."
 */
router.post('/disLikePublicacion', decryptMiddleware, publicationsController.disLikePublicacion)


/**
 * @openapi
 * /api/publicaciones/likeComentario:
 *   post:
 *     summary: "Registrar un 'like' sobre un comentario - Cifrado = [true]"
 *     description: "Este endpoint permite registrar un 'like' de un usuario sobre un comentario de una publicación."
 *     tags:
 *       - Publicaciones
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               coment_id:
 *                 type: integer
 *                 description: "ID del comentario sobre el que se está dando 'like'."
 *                 example: 1
 *               usuario_id:
 *                 type: integer
 *                 description: "ID del usuario que está dando el 'like'."
 *                 example: 95
 *     responses:
 *       '200':
 *         description: "Like registrado correctamente sobre el comentario."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: boolean
 *                   example: false
 *                 results:
 *                   type: object
 *                   properties:
 *                     obtener_like:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           coment_id:
 *                             type: integer
 *                             example: 1
 *                           usuario_id:
 *                             type: integer
 *                             example: 95
 *       '400':
 *         description: "Error al registrar el 'like'. Datos no válidos o problema interno."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Error al registrar el like. Verifique los datos."
 */
router.post('/likeComentario', decryptMiddleware, publicationsController.likeComentario)

/**
 * @openapi
 * /api/publicaciones/disLikeComentario:
 *   post:
 *     summary: "Registrar un 'dislike' para un comentario - Cifrado = [true]"
 *     description: "Este endpoint permite registrar un 'dislike' de un usuario para un comentario específico."
 *     tags:
 *       - Publicaciones
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               coment_id:
 *                 type: integer
 *                 description: "ID del comentario al que se le está dando 'dislike'."
 *                 example: 1
 *               usuario_id:
 *                 type: integer
 *                 description: "ID del usuario que está dando el 'dislike'."
 *                 example: 95
 *     responses:
 *       '200':
 *         description: "Dislike registrado correctamente para el comentario."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: boolean
 *                   example: false
 *                 results:
 *                   type: object
 *                   properties:
 *                     dislike:
 *                       type: object
 *                       properties:
 *                         fieldCount:
 *                           type: integer
 *                           example: 0
 *                         affectedRows:
 *                           type: integer
 *                           example: 1
 *                         insertId:
 *                           type: integer
 *                           example: 0
 *                         info:
 *                           type: string
 *                           example: ""
 *                         serverStatus:
 *                           type: integer
 *                           example: 34
 *                         warningStatus:
 *                           type: integer
 *                           example: 0
 *                     likes:
 *                       type: integer
 *                       example: 0
 *       '400':
 *         description: "Error al registrar el 'dislike'. Datos no válidos o problema interno."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Error al registrar el dislike. Verifique los datos."
 */
router.post('/disLikeComentario', decryptMiddleware, publicationsController.disLikeComentario)


/**
 * @openapi
 * /api/publicaciones/getPublicaciones/{id_empresa}:
 *   get:
 *     summary: "Obtener todas las publicaciones de una empresa - Cifrado = [true]"
 *     description: "Este endpoint permite obtener todas las publicaciones asociadas a una empresa específica mediante su `id_empresa`."
 *     tags:
 *       - Publicaciones
 *     parameters:
 *       - in: path
 *         name: id_empresa
 *         required: true
 *         description: "ID de la empresa para la cual se desean obtener las publicaciones."
 *         schema:
 *           type: integer
 *           example: 66
 *     responses:
 *       '200':
 *         description: "Publicaciones obtenidas correctamente"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: boolean
 *                   example: false
 *                 results:
 *                   type: object
 *                   properties:
 *                     publicacion:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           usu_id:
 *                             type: integer
 *                             example: 84
 *                           rol:
 *                             type: string
 *                             example: "Cliente"
 *                           publicaciones:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 id_publication:
 *                                   type: integer
 *                                   example: 1
 *                                 usuario_id_origen:
 *                                   type: integer
 *                                   example: 84
 *                                 video:
 *                                   type: string
 *                                   example: ""
 *                                 imagen:
 *                                   type: string
 *                                   example: "https://mycredibusinessbucketapp.s3.amazonaws.com/publicacionesImg/3jHuBcXv4o0wHUZGXWx54K2tKwMMlsTTkQ2ZvALX5UcG.png"
 *                                 description:
 *                                   type: string
 *                                   example: ""
 *                                 tipo_origen:
 *                                   type: string
 *                                   example: "corporativo"
 *                                 tipo_destino:
 *                                   type: string
 *                                   example: "todos"
 *                                 created_at:
 *                                   type: string
 *                                   format: date-time
 *                                   example: "2024-11-06T22:49:17.000Z"
 *                                 likes:
 *                                   type: integer
 *                                   example: 0
 *                                 comentarios:
 *                                   type: array
 *                                   items:
 *                                     type: object
 *                                     properties:
 *                                       id_publication_coment:
 *                                         type: integer
 *                                         example: 1
 *                                       usuario_id:
 *                                         type: integer
 *                                         example: 95
 *                                       comentario:
 *                                         type: string
 *                                         example: "Este es un comentario de prueba sobre la publicación."
 *                                       imagen:
 *                                         type: string
 *                                         example: ""
 *                                       video:
 *                                         type: string
 *                                         example: "https://www.youtube.com/watch?v=-RsxojIJ4ZU"
 *                                       created_at:
 *                                         type: string
 *                                         format: date-time
 *                                         example: "2024-11-12T18:43:46.000Z"
 *                                       likes:
 *                                         type: integer
 *                                         example: 1
 *                                 galeria:
 *                                   type: array
 *                                   items:
 *                                     type: object
 *                                     properties:
 *                                       url:
 *                                         type: string
 *                                         example: "https://mycredibusinessbucketapp.s3.amazonaws.com/publicacionesImg/6cPQFtkyjKQ55mffzVAMoJ29nGVQ8ivQHgSGJJM79BjF.png"
 *       '400':
 *         description: "Error al obtener las publicaciones. ID de la empresa inválido."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "ID de la empresa no encontrado."
 */
router.get('/getPublicaciones/:id_empresa/:id_usuario', publicationsController.getPublicationsByEmp)

/**
 * @openapi
 * /api/publicaciones/getPublicaciones/{id_empresa}/{id_usuario}:
 *   get:
 *     summary: "Obtener todas las publicaciones de una empresa y un usuario específico - Cifrado = [true]"
 *     description: "Este endpoint permite obtener todas las publicaciones asociadas a una empresa específica y un usuario determinado mediante los parámetros `id_empresa` y `id_usuario`."
 *     tags:
 *       - Publicaciones
 *     parameters:
 *       - in: path
 *         name: id_empresa
 *         required: true
 *         description: "ID de la empresa para la cual se desean obtener las publicaciones."
 *         schema:
 *           type: integer
 *           example: 83
 *       - in: path
 *         name: id_usuario
 *         required: true
 *         description: "ID del usuario para el cual se desean obtener las publicaciones."
 *         schema:
 *           type: integer
 *           example: 101
 *     responses:
 *       '200':
 *         description: "Publicaciones obtenidas correctamente"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: boolean
 *                   example: false
 *                 results:
 *                   type: object
 *                   properties:
 *                     publicacion:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           usu_id:
 *                             type: integer
 *                             example: 101
 *                           emp_id:
 *                             type: integer
 *                             example: 83
 *                           empresa:
 *                             type: string
 *                             example: "Petandmore LLC"
 *                           usuario:
 *                             type: string
 *                             example: "Daniela Ochoa"
 *                           foto:
 *                             type: string
 *                             example: "https://mycredibusinessbucketapp.s3.amazonaws.com/userImage/0VfuRPhMNyKBuGjjLHiInP7bcQxx1IqLjrDnagUZo3Ye.jpeg"
 *                           rol:
 *                             type: string
 *                             example: "Administrador"
 *                           publicaciones:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 id_publication:
 *                                   type: integer
 *                                   example: 91
 *                                 usuario_id_origen:
 *                                   type: integer
 *                                   example: 101
 *                                 video:
 *                                   type: string
 *                                   example: ""
 *                                 imagen:
 *                                   type: string
 *                                   example: ""
 *                                 description:
 *                                   type: string
 *                                   example: "holasas"
 *                                 tipo_origen:
 *                                   type: string
 *                                   example: "personal"
 *                                 tipo_destino:
 *                                   type: string
 *                                   example: ""
 *                                 created_at:
 *                                   type: string
 *                                   format: date-time
 *                                   example: "2024-11-27T17:53:59.000Z"
 *                                 likes:
 *                                   type: integer
 *                                   example: 1
 *                                 like_login:
 *                                   type: boolean
 *                                   example: true
 *                                 comentarios:
 *                                   type: array
 *                                   items:
 *                                     type: object
 *                                     properties:
 *                                       id_publication_coment:
 *                                         type: integer
 *                                         example: 31
 *                                       usuario_id:
 *                                         type: integer
 *                                         example: 101
 *                                       nombre_usuario:
 *                                         type: string
 *                                         example: "Daniela Ochoa"
 *                                       comentario:
 *                                         type: string
 *                                         example: "hola "
 *                                       imagen:
 *                                         type: string
 *                                         example: ""
 *                                       video:
 *                                         type: string
 *                                         example: ""
 *                                       created_at:
 *                                         type: string
 *                                         format: date-time
 *                                         example: "2024-11-27T17:45:47.000Z"
 *                                       likes:
 *                                         type: integer
 *                                         example: 1
 *                                       like_login:
 *                                         type: boolean
 *                                         example: true
 *                                 galeria:
 *                                   type: array
 *                                   items:
 *                                     type: object
 *                                     properties:
 *                                       url:
 *                                         type: string
 *                                         example: "https://mycredibusinessbucketapp.s3.amazonaws.com/publicacionesImg/6cPQFtkyjKQ55mffzVAMoJ29nGVQ8ivQHgSGJJM79BjF.png"
 *       '400':
 *         description: "Error al obtener las publicaciones. ID de la empresa o ID de usuario inválidos."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "ID de la empresa o ID de usuario no encontrado."
 */
router.get('/getComentarios/:id_publicacion', publicationsController.getComentariosByIdPub)

/**
 * @swagger
 * /api/publicaciones/eliminarPublicacion/{id_publicacion}:
 *   delete:
 *     summary: Eliminar una publicación - Cifrado = [true]
 *     description: Elimina una publicación específica por su ID.
 *     tags:
 *       - Publicaciones
 *     operationId: eliminarPublicacion
 *     parameters:
 *       - name: id_publicacion
 *         in: path
 *         description: ID de la publicación a eliminar
 *         required: true
 *         type: integer
 *         format: int64
 *     responses:
 *       200:
 *         description: Publicación eliminada exitosamente
 *         schema:
 *           type: object
 *           properties:
 *             error:
 *               type: boolean
 *               example: false
 *             results:
 *               type: object
 *               properties:
 *                 desactivar:
 *                   type: object
 *                   properties:
 *                     fieldCount:
 *                       type: integer
 *                       example: 0
 *                     affectedRows:
 *                       type: integer
 *                       example: 0
 *                     insertId:
 *                       type: integer
 *                       example: 0
 *                     info:
 *                       type: string
 *                       example: "Rows matched: 1  Changed: 0  Warnings: 0"
 *                     serverStatus:
 *                       type: integer
 *                       example: 2
 *                     warningStatus:
 *                       type: integer
 *                       example: 0
 *                     changedRows:
 *                       type: integer
 *                       example: 0
 *       404:
 *         description: Publicación no encontrada
 *         schema:
 *           type: object
 *           properties:
 *             message:
 *               type: string
 *               example: Publicación no encontrada
 *       500:
 *         description: Error interno del servidor
 *         schema:
 *           type: object
 *           properties:
 *             message:
 *               type: string
 *               example: Error al eliminar la publicación
 */
router.delete('/eliminarPublicacion/:id_publicacion', publicationsController.eliminarPublicacion)

router.post('/', authMiddleware, /*multerPublication(),*/ /*validations(createPublication),*/ publicationsController.createPublication)

router.get('/', authMiddleware, publicationsController.getPublications)
router.post('/uploadVideCorporativo', /*authMiddleware,*/ /*multerPublication(),*/ publicationsController.uploadVideoEmpresa)
router.post('/uploadBannerCorporativo', /*authMiddleware,*/ /*multerPublication(),*/ publicationsController.uploadImagenEmpresa)
router.post('/uploadLogoCorporativo', /*authMiddleware,*/ /*multerPublication(),*/ publicationsController.uploadLogoEmpresa)


router.put('/:publicationId', authMiddleware, validations(updatePublication), publicationsController.editPublication)
router.delete('/:publicationId', authMiddleware, publicationsController.deletePublication)
router.get('/red/:usuario', authMiddleware, publicationsController.getPublicationsFromMyNetwork)
router.get('/usuario/:usuario', authMiddleware, publicationsController.getPublicationsFromUser)
router.get('/comentarios/:publicationId', authMiddleware, publicationsController.getPublicationComments)
router.post('/comentarios/:id', authMiddleware, multerPublication(), validations(createComment), publicationsController.createPublicationComment)
router.put('/comentarios/:id', authMiddleware, validations(updateComment), publicationsController.updatePublicationComment)
router.delete('/comentarios/:id', authMiddleware, validations(deleteComment), publicationsController.deletePublicationComment)
router.post('/like', authMiddleware, publicationsController.likePublication)
router.post('/like/comment', authMiddleware, validations(likeComment), publicationsController.likePublicationComment)
router.post('/subcomentarios', authMiddleware, validations(createSubComment), publicationsController.postSubComment)
router.put('/subcomentarios/:uuid', authMiddleware, validations(editSubComment), publicationsController.editSubComment)
router.delete('/subcomentarios/:uuid', authMiddleware, validations(deleteSubComment), publicationsController.deleteSubComment)
router.post('/subcomentarios/:uuid/like', authMiddleware, validations(likeSubComment), publicationsController.likeSubComment)
router.get('/empresa/:companyID', authMiddleware, publicationsController.getPublicationsFromCompany)
router.get('/publicas/ultimas', authMiddleware, publicationsController.getLatestPublications)
router.get('/:usuID/:pubID', authMiddleware, publicationsController.getPubByID)

module.exports = router
