'use strict'

const uuid = require('uuid-base62')
const debug = require('debug')('old-api:publications-service')
const mysqlLib = require('../lib/db')

class PublicationService {
  constructor() {
    if (PublicationService.instance == null) {
      this.table = 'publicaciones'
      this.commentTable = 'publicaciones_comentarios'
      this.commentLikesTable = 'publicaciones_comentarios_likes'
      this.subcommentTable = 'publicaciones_subcomentarios'
      this.subcommentLikesTable = 'publicaciones_subcomentarios_likes'
      this.publicationVisitTable = 'publicaciones_vistas'
      PublicationService.instance = this
    }
    return PublicationService.instance
  }

  async get(query) {
    debug('PublicactionService -> get')

    const orderByCondition = 'ORDER BY created_at DESC'

    let whereConditions = (query && query.usuario_id) ? 'WHERE ' : ''
    whereConditions += (query && query.usuario_id ? `usuario_id = ${query.usuario_id}` : '')

    let limitCondition = query && query.limit ? `LIMIT ${query.limit}` : ''
    limitCondition = (query && query.limit && query.page) ? `${limitCondition} OFFSET ${(parseInt(query.page) - 1) * parseInt(query.limit)}` : limitCondition

    const queryString = `
      SELECT
        p.id AS "publicacion_id",
        e.emp_id AS "empresa_id",
        e.emp_nombre AS "empresa_nombre",
        u.usu_id AS "usuario_id",
        CONCAT(u.usu_nombre, ' ', u.usu_app) AS "usuario_nombre",
        p.imagen AS "publicacion_imagen",
        p.descripcion AS "descripcion",
        p.created_at AS "publicacion_creada",
        p.updated_at AS "publicacion_ultima_actualizacion"
      FROM ${this.table} AS p
      INNER JOIN empresa AS e
        ON e.emp_id = p.empresa_id
      INNER JOIN usuario AS u
        ON p.usuario_id = u.usu_id
      ${whereConditions}
      ${orderByCondition}
      ${limitCondition}
    `
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)

    for (let i = 0; i < result.length; ++i) {
      const { result: comentarios } = await mysqlLib.query(`SELECT COUNT(*) AS "resultado" FROM publicaciones_comentarios WHERE publicacion_id = ${result[i].publicacion_id}`)
      const { result: likes } = await mysqlLib.query(`SELECT COUNT(*) AS "resultado" FROM publicaciones_likes WHERE publicacion_id = ${result[i].publicacion_id}`)
      result[i].comentarios = comentarios[0].resultado
      result[i].likes = likes[0].resultado
    }

    return result
  }


  async getById(publication_id) {
    debug('PublicactionService -> getById')

    const queryString = `
      SELECT
        p.id AS "publicacion_id",
        e.emp_id AS "empresa_id",
        e.emp_nombre AS "empresa_nombre",
        u.usu_id AS "usuario_id",
        CONCAT(u.usu_nombre, ' ', u.usu_app) AS "usuario_nombre",
        p.imagen AS "publicacion_imagen",
        p.video AS "publicacion_video",
        p.descripcion AS "descripcion",
        p.created_at AS "publicacion_creada",
        p.updated_at AS "publicacion_ultima_actualizacion"
      FROM ${this.table} as p
      INNER JOIN empresa AS e
        ON e.emp_id = p.empresa_id
      INNER JOIN usuario AS u
        ON p.usuario_id = u.usu_id
      WHERE id = ${publication_id}
    `
    debug(queryString)

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getPublicationComments(publicationId) {
    debug('PublicationService -> getPublicationComments')

    let queryString = `
      SELECT
        p.id AS "publicacion_id",
        e.emp_id AS "empresa_id",
        e.emp_nombre AS "empresa_nombre",
        u.usu_id AS "usuario_id",
        u.usu_nombre AS "usuario_nombre",
        u.usu_app AS "usuario_apellido",
        u.usu_foto AS "usuario_avatar",
        CONCAT(u.usu_nombre, ' ', u.usu_app) AS "usuario_nombre",
        p.imagen AS "publicacion_imagen",
        p.descripcion AS "descripcion",
        p.created_at AS "publicacion_creada",
        p.updated_at AS "publicacion_ultima_actualizacion"
      FROM ${this.table} as p
      INNER JOIN empresa AS e
        ON e.emp_id = p.empresa_id
      INNER JOIN usuario AS u
        ON p.usuario_id = u.usu_id
      WHERE id = ${publicationId}
    `
    debug(queryString)

    const { result: publication } = await mysqlLib.query(queryString)

    // COMENTARIOS
    queryString = `
      SELECT
        pc.*,
        u.usu_nombre AS "usuario_nombre",
        u.usu_app AS "usuario_apellido",
        u.usu_foto AS "usuario_avatar",
        eu.emp_id
      FROM publicaciones_comentarios AS pc
      JOIN usuario AS u
      ON u.usu_id = pc.usuario_id
      JOIN empresa_usuario AS eu
      ON eu.usu_id = u.usu_id
      WHERE pc.publicacion_id = ${publicationId}
    `

    const { result: comments } = await mysqlLib.query(queryString)
    publication[0].comentarios = comments

    // LIKES
    queryString = `
      SELECT
        pl.id AS "like_id",
        pl.publicacion_id AS "publicacion_id",
        pl.usuario_id AS "usuario_id",
        CONCAT(u.usu_nombre, ' ', u.usu_app) AS "usuario_nombre",
        u.usu_foto,
        pl.created_at AS "creado",
        e.emp_id, e.emp_nombre, e.emp_logo
      FROM publicaciones_likes AS pl
      INNER JOIN usuario AS u ON u.usu_id = pl.usuario_id
      JOIN empresa_usuario AS eu USING(usu_id)
      JOIN empresa AS e USING(emp_id)
      WHERE pl.publicacion_id = ${publicationId}
    `
    const { result: likes } = await mysqlLib.query(queryString)
    publication[0].likes = likes

    return publication
  }

  // -------------- MODULO D EPUBLICACIONES ------------

  async crearPublicacion(publication) {
    const { video, imagen, comentario, usuario_id_origen, tipo_origen, tipo_destino } = publication
    const queryString = `
      INSERT INTO 
        publications
      (video, imagen, description, usuario_id_origen, tipo_origen, tipo_destino)
      VALUES
      (
        '${video}',
        '${imagen}',
        '${comentario.trim()}',
        ${usuario_id_origen},
        '${tipo_origen}',
        '${tipo_destino}'
      )
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async updatePublication(publication) {
    const {
      id_publicacion,
      video_bd,
      usuario_id_origen,
      imagen_bd,
      comentario,
      tipo_origen,
      tipo_destino
    } = publication

    const queryString = `
    UPDATE publications
    SET
      video = '${video_bd}',
      imagen = '${imagen_bd}',
      description = '${comentario.trim()}',
      usuario_id_origen = ${usuario_id_origen},
      tipo_origen = '${tipo_origen}',
      tipo_destino = '${tipo_destino}'
    WHERE id_publication = ${id_publicacion}
  ;`
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async updateComent(coment) {
    const {
      id_comentario,
      id_publicacion,
      usuario_id,
      imagen_bd,
      video_bd,
      comentario
    } = coment

    const queryString = `
    UPDATE publications_coments
    SET
      publicacion_id = ${id_publicacion},
      usuario_id = ${usuario_id},
      comentario = '${comentario}',
      imagen = '${imagen_bd}',
      video = '${video_bd}'
    WHERE id_publication_coment = ${id_comentario}
  ;`
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async saveImageGalery(img, id_publication) {
    const queryString = `
      INSERT INTO 
        publications_galery
      (id_publication, url)
      VALUES
      (
        ${id_publication},
        '${img}'
      )
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async deleteImageGalery(id_publication) {
    const queryString = `
      DELETE FROM publications_galery
      WHERE id_publication = ${id_publication}
    `;

    const { result } = await mysqlLib.query(queryString);
    return result;
  }


  async obtenerPublicacionCreada(id_publicacion) {
    const queryString = `
    SELECT
      video,                                  
      imagen,                                 
      description,                                    
      usuario_id_origen,                               
      tipo_origen,  
      tipo_destino,  
      created_at AS se_creo,  
      updated_at AS se_actualizo
    FROM publications
    WHERE id_publication = ${id_publicacion}
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getUserByCompany(emp_id) {
    const queryString = `
    SELECT eu.usu_id, eu.emp_id
    FROM empresa_usuario AS eu
    WHERE eu.emp_id = ${emp_id}
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getLikeUserPublicacion(id_publicacion, id_user) {
    const queryString = `
    SELECT
      COUNT(*) as like_logeado
    FROM publications_likes
    WHERE publicacion_id = ${id_publicacion} AND usuario_id = ${id_user}
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getLikeUserComentario(id_coment, id_user) {
    const queryString = `
    SELECT
      COUNT(*) as like_logeado
    FROM coments_likes
    WHERE coment_id = ${id_coment} AND usuario_id = ${id_user}
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getEmpresaById(id) {
    const queryString = `
    SELECT
        e.emp_id,
        e.emp_nombre,
        d.denominacion,
        CONCAT(e.emp_razon_social, ' ', d.denominacion) AS empresa_nombre
    FROM empresa AS e
    LEFT JOIN cat_denominacion AS d ON d.id = e.denominacion
    WHERE e.emp_id = ${id}
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async obtienePublicacionByUsuarioOrigen(id_usuario) {
    const queryString = `
    SELECT
      id_publication,
      usuario_id_origen,
      video,                                  
      imagen,                                 
      description,                               
      tipo_origen,  
      tipo_destino,
      created_at
    FROM publications
    WHERE usuario_id_origen = ${id_usuario} AND estado = 'activo'
    ORDER BY created_at DESC
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async obtieneRolByIdUsuario(id) {
    const queryString = `
   SELECT
      u.usu_tipo,
			CONCAT(u.usu_nombre, ' ', u.usu_app) AS usuario_nombre,
      u.usu_foto,
      r.nombre
    FROM usuario AS u
    LEFT JOIN roles AS r ON r.id_rol = u.usu_tipo
    WHERE usu_id = ${id}
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async obtenerComentarioByPublicacion(id) {
    const queryString = `
    SELECT
      pc.id_publication_coment,
      pc.usuario_id,
			CONCAT(u.usu_nombre, ' ', u.usu_app) AS nombre_usuario,
      pc.comentario,
      pc.imagen,                                  
      pc.video,                                 
      pc.created_at
    FROM publications_coments AS pc
		LEFT JOIN usuario AS u ON u.usu_id = pc.usuario_id
    WHERE publicacion_id = ${id}
    ORDER BY pc.created_at DESC
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async obtenerGaleria(id_publicacion) {
    const queryString = `
    SELECT
      url
    FROM publications_galery
    WHERE id_publication = ${id_publicacion}
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async obtenerNumeroLikesPublicacion(id) {
    const queryString = `
    SELECT COUNT(*) AS likes
    FROM publications_likes
    WHERE publicacion_id = ${id}
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async obtenerFotoUsuarioPublicacion(id_usu) {
    const queryString = `
    SELECT
      usu_foto
    FROM usuario
    WHERE usu_id = ${id_usu}
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async obtenerFotoEmpresaUsuario (id_usu) {
    const queryString = `
    SELECT
      e.emp_logo
    FROM empresa AS e
    LEFT JOIN empresa_usuario AS eu ON eu.emp_id = e.emp_id
    WHERE eu.usu_id = ${id_usu}
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async obtenerNumeroLikesComentarios(id) {
    const queryString = `
    SELECT COUNT(*) AS likes
    FROM coments_likes
    WHERE coment_id = ${id}
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async crearComentario(publicacion) {
    const { id_publicacion, usuario_id, imagen, video, comentario } = publicacion
    const queryString = `
      INSERT INTO 
        publications_coments
      (publicacion_id, usuario_id, imagen, video, comentario)
      VALUES
      (
        ${id_publicacion},
        ${usuario_id},
        '${imagen}',
        '${video}',
        '${comentario}'
      )
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async obtenerComentarioCreado(id) {
    const queryString = `
    SELECT
      publicacion_id,
      usuario_id,
      comentario,
      imagen,
      video
    FROM publications_coments
    WHERE id_publication_coment = ${id}
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async disLikePublicacion(dislike) {
    const { id_publicacion, usuario_id } = dislike
    const queryString = `
    DELETE FROM publications_likes
    WHERE usuario_id = ${usuario_id} AND publicacion_id = ${id_publicacion};
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async disLikeComentario (dislike) {
    const { coment_id, usuario_id } = dislike
    const queryString = `
    DELETE FROM coments_likes
    WHERE usuario_id = ${usuario_id} AND coment_id = ${coment_id};
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async isLikedPublicationsByUser(liked) {
    const { id_publicacion, usuario_id } = liked
    const queryString = `
    SELECT
      COUNT(*) AS likes_by_user
    FROM publications_likes
    WHERE usuario_id = ${usuario_id} AND publicacion_id = ${id_publicacion}
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async isLikedComentsByUser(liked) {
    const { coment_id, usuario_id } = liked
    const queryString = `
    SELECT
      COUNT(*) AS likes_by_user
    FROM coments_likes
    WHERE usuario_id = ${usuario_id} AND coment_id = ${coment_id}
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async likePublicacion(like) {
    const { id_publicacion, usuario_id } = like
    const queryString = `
    INSERT INTO 
      publications_likes
    (publicacion_id, usuario_id)
    VALUES
    (
      ${id_publicacion},
      ${usuario_id}
    )
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async obtenerLikePublicationLikes(id_publication) {
    const queryString = `
    SELECT
      publicacion_id,
      usuario_id
    FROM publications_likes
    WHERE publicacion_id = ${id_publication}
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async obtenerLikePublication(id) {
    const queryString = `
    SELECT
      publicacion_id,
      usuario_id
    FROM publications_likes
    WHERE id = ${id}
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async likeComent(like) {
    const { coment_id, usuario_id } = like
    const queryString = `
    INSERT INTO 
      coments_likes
    (coment_id, usuario_id)
    VALUES
    (
      ${coment_id},
      ${usuario_id}
    )
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async obtenerLikeComentLikes(id_coment) {
    const queryString = `
    SELECT
      coment_id,
      usuario_id
    FROM coments_likes
    WHERE coment_id = ${id_coment}
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async obtenerLikeComent(id) {
    const queryString = `
    SELECT
      coment_id,
      usuario_id
    FROM coments_likes
    WHERE id = ${id}
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async desactivarPublicacion(id) {
    const queryString = `
    UPDATE publications
    SET
      estado = 'inactivo'
    WHERE id_publication = ${id}
  ;`
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async create({ empresa_id, usuario_id, comentario, imagen, origen, destino }) {
    let comentarioTxt = ''
    if (comentario) {
      comentarioTxt = comentario
    }

    const queryString = `
      INSERT INTO 
        ${this.table}
      (empresa_id, origen, usuario_id, descripcion, imagen, id_tipo_user_destino)
      VALUES
      (
        ${empresa_id},
        '${origen}',
        ${usuario_id},
        '${comentarioTxt}',
        ${imagen ? `'${imagen}'` : `${null}`},
        ${destino}
      )
    `
    debug(queryString)

    const { result } = await mysqlLib.query(queryString)

    return result.insertId
  }

  async update(id, texto) {
    debug('PublicationService -> update')

    const queryString = `
      UPDATE ${this.table}
      SET descripcion = '${texto}'
      WHERE id = ${id}
    `

    debug(queryString)

    await mysqlLib.query(queryString)

    return this.getById(id)
  }

  delete(publication_id) {
    debug('PublicationService -> delete')

    const queryString = publication_id => `
      DELETE FROM ${this.table}
      WHERE id = ${publication_id}
    `

    return mysqlLib.query(queryString(publication_id))
  }

  async getCommentById(commentId) {
    debug('PublicationService -> getCommentById')

    const queryString = `
      SELECT
        *
      FROM publicaciones_comentarios
      WHERE id = ${commentId}
    `

    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async addComment(id, comment, url) {
    debug('PublicationService -> addComment')

    const queryString = `
      INSERT INTO publicaciones_comentarios
      (publicacion_id, usuario_id, comentario, imagen, video)
      VALUES (
        ${id},
        ${comment.usuario_id},
        "${comment.comentario}",
        ${comment.imagen ? `"${comment.imagen}"` : null},
        ${url ? `"${url}"` : null}
      )
    `

    await mysqlLib.query(queryString)

    return this.getPublicationComments(id)
  }

  async updateComment(publicationId, comment) {
    debug('PublicationService -> updateComment')

    const setValues = comment => `SET comentario = "${comment.comentario}"`
    const whereCondition = comment => `WHERE id = ${comment.comentario_id} AND publicacion_id = ${publicationId}`

    const queryString = `
      UPDATE publicaciones_comentarios
      ${setValues(comment)}
      ${whereCondition(comment)}
    `
    debug(queryString)
    await mysqlLib.query(queryString)

    return this.getPublicationComments(publicationId)
  }

  deleteComment(commentId) {
    debug('PublicationService -> deleteComment')

    const queryString = `
      DELETE FROM publicaciones_comentarios WHERE id = ${commentId}
    `

    return mysqlLib.query(queryString)
  }

  async getLikeByIds(publicationId, usuarioId) {
    debug('PublicationService -> getLikeByIds')

    const queryString = `
      SELECT
        *
      FROM publicaciones_likes AS pl
      WHERE pl.publicacion_id = ${publicationId} AND pl.usuario_id = ${usuarioId}
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getLikes(publicationId) {
    debug('PublicationService -> getLikes')

    const queryString = `
      SELECT
        *
      FROM publicaciones_likes AS pl
      INNER JOIN usuario AS u
        ON pl.usuario_id = u.usu_id
      WHERE pl.publicacion_id = ${publicationId}
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async canLikePublication(user) {
    debug('PublicationService -> canLikePublication')
    const queryLike = `
      SELECT COUNT(*) AS 'total'
      FROM publicaciones_likes
      WHERE usuario_id = ${user}
      AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
    `
    const { result: likesRaw } = await mysqlLib.query(queryLike)
    const [likes] = likesRaw
    const { total } = likes

    return total
  }

  async addLike(publicationId, usuarioId) {
    debug('PublicationService -> addLike')

    const queryString = `
      INSERT INTO publicaciones_likes
        (publicacion_id, usuario_id)
      VALUES
      (
        ${publicationId},
        ${usuarioId}
      )
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async unLike(publicationId, usuarioId) {
    debug('PublicationService -> unLike')

    const whereCondition = (publicationId, usuarioId) => `WHERE publicacion_id = ${publicationId} AND usuario_id = ${usuarioId}`

    const queryString = `
      DELETE 
      FROM publicaciones_likes
      ${whereCondition(publicationId, usuarioId)}
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getPublicacionesRed(usuario) {
    debug('PublicationService -> getPublicacionesRed')

    const queryString = `
      SELECT
      p.*,
      u.usu_nombre,
      u.usu_app,
      u.usu_foto,
      e.emp_nombre,
      e.emp_logo,
      (SELECT COUNT(*) FROM pub_eve_accion WHERE pub_id = p.pub_id AND pea_tipo = 1) AS pub_like,
      (SELECT count(*) FROM pub_eve_accion WHERE pub_id = p.pub_id AND pea_tipo = 2) AS pub_compartir,
      (SELECT COUNT(*) AS total FROM publicaciones_likes WHERE publicacion_id = p.pub_id) AS num_like
      FROM publicacion AS p
      JOIN usuario AS u
      ON u.usu_id = p.usu_id
      JOIN empresa AS e
      ON e.emp_id = p.emp_id
      WHERE p.usu_id IN (
        (
          SELECT usu_id_amigo
          FROM network
          WHERE usu_id_origen = ${usuario}
        )
      )
      OR p.usu_id IN (
        (
          SELECT usu_id_origen
          FROM network
          WHERE usu_id_amigo = ${usuario}
        )
      )
      OR p.usu_id = ${usuario}
      ORDER BY p.pub_fecha desc
    `

    const { result } = await mysqlLib.query(queryString)

    debug(queryString)

    return result
  }

  async getPublicacionesRedNueva(usuario, query) {
    debug('PublicationService -> getPublicacionesRedNueva')

    let limitCondition = query && query.limit ? `LIMIT ${query.limit}` : ''
    limitCondition = (query && query.limit && query.page) ? `${limitCondition} OFFSET ${(parseInt(query.page) - 1) * parseInt(query.limit)}` : limitCondition

    let queryString = `
      SELECT
        p.*,
        p.id AS "pub_id",
        u.usu_nombre,
        u.usu_app,
        u.usu_foto,
        e.emp_nombre,
        e.emp_logo,
        (SELECT COUNT(*) FROM publicaciones_likes WHERE publicacion_id = p.id) AS pub_like,
        (SELECT COUNT(*) FROM publicaciones_comentarios WHERE publicacion_id = p.id) AS pub_comentarios,
        (SELECT COUNT(*) FROM publicaciones_compartidas WHERE publicacion_id = p.id) as pub_compartidas,
        (SELECT COUNT(*) FROM publicaciones_vistas WHERE pub_id = p.id) as pub_vistas,
        (SELECT IF (COUNT(*) > 0, true, false) FROM publicaciones_likes WHERE publicacion_id = p.id AND usuario_id = ${usuario}) AS "liked",
        "Publicacion" AS "tipo"
      FROM publicaciones as p
      JOIN usuario as u
      ON u.usu_id = p.usuario_id
      JOIN empresa as e
      ON e.emp_id = p.empresa_id
      WHERE p.usuario_id IN (
        (
          SELECT usu_id_amigo
          FROM network
          WHERE  usu_id_origen = ${usuario}
        )
      )
      OR p.usuario_id IN (
        (
          SELECT usu_id_origen
          FROM network
          WHERE usu_id_amigo = ${usuario}
        )
      )
      OR p.usuario_id = ${usuario}
      OR p.usuario_id IN (
        SELECT usuario_destino
        FROM seguidores
        WHERE usuario_origen = ${usuario}
        AND estatus = 'Follow'
      )
      ORDER BY p.created_at DESC
      ${limitCondition}
    `

    debug(queryString)
    const { result: publicaciones } = await mysqlLib.query(queryString)

    queryString = `
    SELECT
      count(*) as count
    FROM publicaciones as p
    JOIN usuario as u
    ON u.usu_id = p.usuario_id
    JOIN empresa as e
    ON e.emp_id = p.empresa_id
    WHERE p.usuario_id IN (
      (
        SELECT usu_id_amigo
        FROM network
        WHERE  usu_id_origen = ${usuario}
      )
    )
    OR p.usuario_id IN (
      (
        SELECT usu_id_origen
        FROM network
        WHERE usu_id_amigo = ${usuario}
      )
    )
    OR p.usuario_id = ${usuario}
    OR p.usuario_id IN (
      SELECT usuario_destino
      FROM seguidores
      WHERE usuario_origen = ${usuario}
      AND estatus = 'Follow'
    )
    ORDER BY p.created_at DESC
  `

    debug(queryString)
    const { result: totalRaw } = await mysqlLib.query(queryString)
    const [{ count }] = totalRaw

    return { publicaciones, total: count }
  }

  async getRolByUser(usuario) {
    const queryString = `
      SELECT
        r.id_rol
      FROM usuario AS u
      LEFT JOIN roles AS r ON u.usu_tipo = r.id_rol
      WHERE u.usu_id = ${usuario};
    `
    const { result } = await mysqlLib.query(queryString)
    return result[0].id_rol
  }

  async getPublicacionesRedTodas(usuario, tipo, query) {
    debug('PublicationService -> getPublicacionesRedTodas')
    let limitCondition = query && query.limit ? `LIMIT ${query.limit}` : ''
    limitCondition = (query && query.limit && query.page) ? `${limitCondition} OFFSET ${(parseInt(query.page) - 1) * parseInt(query.limit)}` : limitCondition
    let queryString = `
      SELECT
        p.*,
        p.id AS "pub_id",
        u.usu_nombre,
        u.usu_app,
        u.usu_foto,
        e.emp_nombre,
        e.emp_logo,
        (SELECT COUNT(*) FROM publicaciones_likes WHERE publicacion_id = p.id) AS pub_like,
        (SELECT COUNT(*) FROM publicaciones_comentarios WHERE publicacion_id = p.id) AS pub_comentarios,
        (SELECT COUNT(*) FROM publicaciones_compartidas WHERE publicacion_id = p.id) as pub_compartidas,
        (SELECT COUNT(*) FROM publicaciones_vistas WHERE pub_id = p.id) as pub_vistas,
        (SELECT IF (COUNT(*) > 0, true, false) FROM publicaciones_likes WHERE publicacion_id = p.id AND usuario_id = ${usuario}) AS "liked",
        "Publicacion" AS "tipo"
      FROM publicaciones as p
      JOIN usuario as u
      ON u.usu_id = p.usuario_id
      JOIN empresa as e
      ON e.emp_id = p.empresa_id
      WHERE p.id_tipo_user_destino = ${tipo}
      ORDER BY p.created_at DESC 
      ${limitCondition}
      
    `

    debug(queryString)
    const { result: publicaciones } = await mysqlLib.query(queryString)

    queryString = `
      SELECT
        count(*) as count
      FROM publicaciones as p
      JOIN usuario as u
      ON u.usu_id = p.usuario_id
      JOIN empresa as e
      ON e.emp_id = p.empresa_id
      ORDER BY p.created_at DESC 
      
    `

    const { result: totalRaw } = await mysqlLib.query(queryString)
    const [{ count }] = totalRaw
    return { publicaciones, total: count }
  }

  async getPublicacionByID(usuario, pubID) {
    debug('PublicationService -> getPublicacionByID')

    const queryString = `
      SELECT
        p.*,
        p.id AS "pub_id",
        u.usu_nombre,
        u.usu_app,
        u.usu_foto,
        e.emp_nombre,
        e.emp_logo,
        (SELECT COUNT(*) FROM publicaciones_likes WHERE publicacion_id = p.id) AS pub_like,
        (SELECT COUNT(*) FROM publicaciones_comentarios WHERE publicacion_id = p.id) AS pub_comentarios,
        (SELECT COUNT(*) FROM publicaciones_compartidas WHERE publicacion_id = p.id) as pub_compartidas,
        (SELECT COUNT(*) FROM publicaciones_vistas WHERE pub_id = p.id) as pub_vistas,
        (SELECT IF (COUNT(*) > 0, true, false) FROM publicaciones_likes WHERE publicacion_id = p.id AND usuario_id = ${usuario}) AS "liked",
        "Publicacion" AS "tipo"
      FROM publicaciones as p
      JOIN usuario as u
      ON u.usu_id = p.usuario_id
      JOIN empresa as e
      ON e.emp_id = p.empresa_id
      WHERE p.id = ${Number(pubID)}
      ORDER BY p.created_at DESC 
    `

    debug(queryString)
    const { result: publicaciones } = await mysqlLib.query(queryString)

    return publicaciones
  }

  async getPublicacionesUsuario(usuario) {
    debug('PublicationService -> getPublicacionesUsuario')

    const queryString = `
      SELECT
      p.*,
      u.usu_nombre,
      u.usu_app,
      u.usu_foto,
      e.emp_nombre,
      e.emp_logo,
      (SELECT COUNT(*) FROM pub_eve_accion WHERE pub_id = p.pub_id AND pea_tipo = 1) AS pub_like,
      (SELECT count(*) FROM pub_eve_accion WHERE pub_id = p.pub_id AND pea_tipo = 2) AS pub_compartir,
      (SELECT COUNT(*) AS cuantos FROM pub_eve_accion WHERE usu_id = ${usuario} AND pub_id = p.pub_id AND pea_tipo in ( 1, 3 ) ) AS num_like
      FROM publicacion AS p
      JOIN usuario AS u
      ON u.usu_id = p.usu_id
      JOIN empresa AS e
      ON e.emp_id = p.emp_id
      WHERE p.usu_id = ${usuario}
      ORDER BY p.pub_fecha desc
    `

    const { result } = await mysqlLib.query(queryString)

    debug(queryString)

    return result
  }

  async getComentariosPublicacion(publicacion) {
    debug('PublicationService -> getComentariosPublicacion')

    const queryString = `
      SELECT
        pc.id AS "comentario_id",
        pc.comentario,
        pc.imagen,
        pc.video,
        pc.created_at,
        pc.updated_at,
        u.usu_id,
        u.usu_nombre,
        u.usu_app,
        u.usu_foto,
        e.emp_id,
        e.emp_nombre,
        e.emp_logo
      FROM publicaciones_comentarios AS pc
      JOIN usuario AS u ON u.usu_id = pc.usuario_id
      JOIN empresa_usuario AS eu ON eu.usu_id = pc.usuario_id
      JOIN empresa AS e ON e.emp_id = eu.emp_id
      WHERE pc.publicacion_id = ${publicacion}
    `

    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getPublicationInteractions(publication) {
    debug('PublicationService -> getPublicationInteractions')
    const queryComments = `
    SELECT
      pc.id, u.usu_id, u.usu_nombre, u.usu_app, u.usu_foto,
      e.emp_id, e.emp_nombre, e.emp_logo
    FROM publicaciones_comentarios AS pc
    JOIN usuario AS u ON u.usu_id = pc.usuario_id
    JOIN empresa_usuario AS eu USING(usu_id)
    JOIN empresa AS e USING(emp_id)
    WHERE pc.publicacion_id = ${publication}
    ORDER BY pc.created_at DESC
    `

    const queryLikes = `
    SELECT
      pl.id, u.usu_id, u.usu_nombre, u.usu_app, u.usu_foto,
      e.emp_id, e.emp_nombre, e.emp_logo
    FROM publicaciones_likes AS pl
    JOIN usuario AS u ON u.usu_id = pl.usuario_id
    JOIN empresa_usuario AS eu USING(usu_id)
    JOIN empresa AS e USING(emp_id)
    WHERE pl.publicacion_id = ${publication}
    ORDER BY pl.created_at DESC
    `

    const queryShare = `
    SELECT
      u.usu_id, u.usu_nombre, u.usu_app, u.usu_foto,
      e.emp_id, e.emp_nombre, e.emp_logo
    FROM publicaciones_compartidas AS pc
    JOIN usuario AS u ON u.usu_id = pc.usuario_id
    JOIN empresa_usuario AS eu USING(usu_id)
    JOIN empresa AS e USING(emp_id)
    WHERE pc.publicacion_id = ${publication}
    ORDER BY pc.created_at DESC
    `

    const queryViews = `
      SELECT usu_id, COUNT(*) AS 'total'
      FROM publicaciones_vistas
      WHERE pub_id = ${publication}
      GROUP by usu_id
    `

    const { result: comments } = await mysqlLib.query(queryComments)
    const { result: likes } = await mysqlLib.query(queryLikes)
    const { result: share } = await mysqlLib.query(queryShare)
    const { result: views } = await mysqlLib.query(queryViews)

    const users = views.map(v => v.usu_id)
    let usersPayload = []

    if (users.length !== 0) {
      const queryViewsUsers = `
        SELECT
          usu_id, usu_nombre, usu_app, usu_foto,
          emp_id, emp_nombre, emp_logo, emp_certificada
        FROM usuario
        JOIN empresa_usuario USING(usu_id)
        JOIN empresa USING(emp_id)
        WHERE usu_id IN (${users.join(',')})
      `
      const { result: usersDetails } = await mysqlLib.query(queryViewsUsers)
      usersPayload = usersDetails
    }

    const data = {
      total: comments.length + likes.length + share.length + views.length,
      comentarios: {
        total: comments.length,
        payload: comments
      },
      likes: {
        total: likes.length,
        payload: likes
      },
      compartidos: {
        total: share.length,
        payload: share
      },
      vistas: {
        total: views.length,
        payload: usersPayload
      }
    }
    return data
  }

  async postSubComment(userID, commentID, comment) {
    debug('PublicationService -> postSubComment')
    const id = `${uuid.v4()}${uuid.v4()}${uuid.v4()}${uuid.v4()}`
    const queryInsert = `
      INSERT INTO ${this.subcommentTable}
      (subcomentario_uuid, usuario_id, comentario_id, comentario)
      VALUES
      ('${id}', ${userID}, ${commentID}, '${comment}')
    `
    const { result: { affectedRows } } = await mysqlLib.query(queryInsert)
    if (affectedRows === 0) return null

    const queryGet = `
      SELECT
        psc.subcomentario_uuid,
        psc.usuario_id,
        psc.comentario,
        psc.created_at,
        psc.updated_at,
        u.usu_nombre,
        u.usu_app,
        u.usu_foto,
        u.usu_puesto,
        e.emp_id,
        e.emp_nombre,
        e.emp_certificada,
        e.emp_logo
      FROM ${this.subcommentTable} AS psc
      JOIN usuario AS u ON u.usu_id = psc.usuario_id
      JOIN empresa_usuario AS eu ON eu.usu_id = u.usu_id
      JOIN empresa AS e ON e.emp_id = eu.emp_id
      WHERE subcomentario_uuid = '${id}'
      LIMIT 1
    `
    const { result } = await mysqlLib.query(queryGet)
    const [subcomment] = result
    return subcomment
  }

  async editSubComment(uuid, commentID, user, comment) {
    debug('PublicationService -> editSubComment')
    const queryString = `
      UPDATE ${this.subcommentTable}
      SET comentario = '${comment}'
      WHERE subcomentario_uuid = '${uuid}' AND comentario_id = ${commentID} AND usuario_id = ${user}
    `
    const { result: { affectedRows } } = await mysqlLib.query(queryString)
    return Boolean(affectedRows)
  }

  async subcommentExists(uuid) {
    debug('PublicationService -> subcommentExists')
    const queryGet = `
      SELECT * FROM ${this.subcommentTable}
      WHERE subcomentario_uuid = '${uuid}' LIMIT 1
    `
    const { result } = await mysqlLib.query(queryGet)
    const [subcomment] = result
    return subcomment
  }

  async likeSubComment(uuid, user) {
    debug('PublicationService -> likeSubComment')
    const queryActualLikeState = `
      SELECT valor FROM ${this.subcommentLikesTable}
      WHERE subcomentario_uuid = '${uuid}' AND usuario_id = ${user}
      LIMIT 1
    `
    const { result } = await mysqlLib.query(queryActualLikeState)
    const [actualLikeState] = result
    debug('actualLikeState')
    debug(actualLikeState)
    if (!actualLikeState) {
      // Like this subcomment
      const queryString = `
        INSERT INTO ${this.subcommentLikesTable}
        (subcomentario_uuid, usuario_id, valor)
        VALUES
        ('${uuid}', ${user}, 'LIKE')
      `
      const { result: { affectedRows } } = await mysqlLib.query(queryString)
      return affectedRows === 1 ? { like: true, dislike: false } : { like: false, dislike: true }
    } else {
      // Check the value property in actualLikeState
      // like or dislike this comment
      const { valor } = actualLikeState
      if (valor === 'LIKE') {
        // Like this subcomment
        const queryString = `
          UPDATE ${this.subcommentLikesTable}
          SET valor = 'EMPTY'
          WHERE subcomentario_uuid = '${uuid}' AND usuario_id = ${user}
        `
        const { result: { affectedRows } } = await mysqlLib.query(queryString)
        return affectedRows === 1 ? { like: false, dislike: true } : { like: true, dislike: false }
      } else {
        // Like this subcomment
        const queryString = `
          UPDATE ${this.subcommentLikesTable}
          SET valor = 'LIKE'
          WHERE subcomentario_uuid = '${uuid}' AND usuario_id = ${user}
        `
        const { result: { affectedRows } } = await mysqlLib.query(queryString)
        return affectedRows === 1 ? { like: true, dislike: false } : { like: false, dislike: true }
      }
    }
  }

  async commentExists(commentID) {
    debug('PublicationService -> commentExists')
    const queryGet = `
      SELECT * FROM ${this.commentTable}
      WHERE id = ${commentID}  LIMIT 1
    `
    const { result } = await mysqlLib.query(queryGet)
    const [subcomment] = result
    return subcomment
  }

  async likeComment(commentID, user) {
    debug('PublicationService -> likeComment')
    const queryActualLikeState = `
      SELECT valor FROM ${this.commentLikesTable}
      WHERE comentario_id = ${commentID} AND usuario_id = ${user}
      LIMIT 1
    `
    const { result } = await mysqlLib.query(queryActualLikeState)
    const [actualLikeState] = result
    if (!actualLikeState) {
      // Like this subcomment
      const queryString = `
        INSERT INTO ${this.commentLikesTable}
        (comentario_id, usuario_id, valor)
        VALUES
        (${commentID}, ${user}, 'LIKE')
      `
      const { result: { affectedRows } } = await mysqlLib.query(queryString)
      return affectedRows === 1 ? { like: true, dislike: false } : { like: false, dislike: true }
    } else {
      // Check the value property in actualLikeState
      // like or dislike this comment
      const { valor } = actualLikeState
      if (valor === 'LIKE') {
        // Like this subcomment
        const queryString = `
          UPDATE ${this.commentLikesTable}
          SET valor = 'EMPTY'
          WHERE comentario_id = ${commentID} AND usuario_id = ${user}
        `
        const { result: { affectedRows } } = await mysqlLib.query(queryString)
        return affectedRows === 1 ? { like: false, dislike: true } : { like: true, dislike: false }
      } else {
        // Like this subcomment
        const queryString = `
          UPDATE ${this.commentLikesTable}
          SET valor = 'LIKE'
          WHERE comentario_id = ${commentID} AND usuario_id = ${user}
        `
        const { result: { affectedRows } } = await mysqlLib.query(queryString)
        return affectedRows === 1 ? { like: true, dislike: false } : { like: false, dislike: true }
      }
    }
  }

  async getSubCommentsByCommentID(commentID) {
    debug('PublicationService -> getSubCommentsByCommentID')
    const queryGet = `
    SELECT
      ps.subcomentario_uuid, ps.comentario, ps.created_at, ps.updated_at,
      u.usu_id, u.usu_nombre, u.usu_app, u.usu_foto, u.usu_puesto, u.usu_tipo,
      e.emp_id, e.emp_nombre, e.emp_website, e.emp_logo, e.emp_banner, e.emp_certificada
    FROM publicaciones_subcomentarios AS ps
    JOIN usuario AS u on u.usu_id = ps.usuario_id
    JOIN empresa_usuario AS eu on eu.usu_id = u.usu_id
    JOIN empresa AS e on e.emp_id = eu.emp_id
    WHERE ps.comentario_id = ${commentID}
    ORDER BY ps.created_at DESC
    `
    const { result } = await mysqlLib.query(queryGet)
    return result
  }

  async getSubCommentsLikes(subcommentUUID) {
    debug('PublicationService -> getSubCommentsLikes')
    const queryGet = `
      SELECT
        psl.created_at, psl.updated_at,
        u.usu_id, u.usu_nombre, u.usu_app, u.usu_foto, u.usu_puesto, u.usu_tipo,
        e.emp_id, e.emp_nombre, e.emp_website, e.emp_logo, e.emp_banner, e.emp_certificada
      FROM publicaciones_subcomentarios_likes AS psl
      JOIN usuario AS u ON u.usu_id = psl.usuario_id
      JOIN empresa_usuario AS eu ON eu.usu_id = u.usu_id
      JOIN empresa AS e ON e.emp_id = eu.emp_id
      WHERE psl.valor = 'LIKE' AND psl.subcomentario_uuid = '${subcommentUUID}'
      ORDER BY psl.created_at DESC
    `
    const { result } = await mysqlLib.query(queryGet)
    return result
  }

  async getCommentsLikes(commentID) {
    debug('PublicationService -> getCommentsLikes')
    const queryGet = `
      SELECT
        pcl.created_at, pcl.updated_at,
        u.usu_id, u.usu_nombre, u.usu_app, u.usu_foto, u.usu_puesto, u.usu_tipo,
        e.emp_id, e.emp_nombre, e.emp_website, e.emp_logo, e.emp_banner, e.emp_certificada
      FROM publicaciones_comentarios_likes AS pcl
      JOIN usuario AS u ON u.usu_id = pcl.usuario_id
      JOIN empresa_usuario AS eu ON eu.usu_id = u.usu_id
      JOIN empresa AS e ON e.emp_id = eu.emp_id
      WHERE pcl.valor = 'LIKE' AND pcl.comentario_id = ${commentID}
      ORDER BY pcl.created_at DESC
    `
    const { result } = await mysqlLib.query(queryGet)
    return result
  }

  async deleteSubCommentsLikes(subcommentUUID) {
    debug('PublicationService -> deleteSubCommentsLikes')
    const queryDelete = `
      DELETE FROM ${this.subcommentLikesTable}
      WHERE subcomentario_uuid = '${subcommentUUID}'
    `
    const { result: { affectedRows } } = await mysqlLib.query(queryDelete)
    return affectedRows
  }

  async deleteSubComment(subcommentUUID) {
    debug('PublicationService -> deleteSubComment')
    const queryDelete = `
      DELETE FROM ${this.subcommentTable}
      WHERE subcomentario_uuid = '${subcommentUUID}'
    `
    const { result: { affectedRows } } = await mysqlLib.query(queryDelete)
    return affectedRows
  }

  async canPostACommentRightNow(user) {
    debug('PublicationService -> canPostACommentRightNow')
    const queryHowManyComments = `
      SELECT COUNT(*) AS 'total'
      FROM ${this.commentTable}
      WHERE usuario_id = ${user}
      AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
    `
    const { result: resultTotalRaw } = await mysqlLib.query(queryHowManyComments)
    const [result] = resultTotalRaw
    const { total } = result

    return total
  }

  async getPublicationFromCompany(company) {
    debug('PublicationService -> getPublicationFromCompany')
    const queryPublications = `
      SELECT
        u.usu_id AS "usuario_id",
        u.usu_nombre AS "usuario_nombre",
        u.usu_app AS "usuario_apellido",
        u.usu_foto AS "usuario_foto",
        u.usu_tipo AS "usuario_tipo",
        u.usu_puesto AS "usuario_puesto",
        p.id AS "publicacion_id",
        p.imagen AS "publicacion_imagen",
        p.video AS "publicacion_video",
        p.descripcion AS "publicacion_descripcion",
        p.created_at AS "publicacion_created_at",
        p.updated_at AS "publicacion_updated_at",
        p.origen AS "publicacion_origen"
      FROM empresa_usuario AS eu
      JOIN usuario AS u USING(usu_id)
      JOIN publicaciones AS p on p.usuario_id = u.usu_id
      WHERE eu.emp_id = ${company}
      ORDER BY p.created_at DESC
    `
    const { result: publications } = await mysqlLib.query(queryPublications)

    // Detalles de publicaciones
    for (let i = 0; i < publications.length; i++) {
      const publication = publications[i].publicacion_id
      const interactions = await this.getPublicationInteractions(publication)
      publications[i].interacciones = interactions
      const comments = await this.getPublicationCommentsAndSubComments(publication)
      publications[i].comentarios = comments
      const statistics = await this.getPublicationStatistics(publication)
      publications[i].statistics = statistics
    }
    return publications
  }

  async getPublicationStatistics(publication) {
    debug('PublicationService -> getPublicationStatistics')
    const queryString = `
      select
        u.usu_id, u.usu_nombre, u.usu_app, u.usu_foto, u.usu_tipo,
        e.emp_id, e.emp_certificada, e.emp_nombre,
        it.nombre AS "industria",
        esttrans.nombre AS "estado",
        pais.nombre AS "pais"
      from publicaciones as p
      join publicaciones_vistas as pv on pub_id = p.id
      join usuario as u using(usu_id)
      join empresa_usuario as eu using(usu_id)
      join empresa as e using(emp_id)
      join industria_translate as it on it.industria_id = e.cin_id
      left join domicilio as d using(emp_id)
      join estado as est using(estado_id)
      join estado_translate as esttrans using (estado_id)
      join pais_translate as pais using(pais_id)
      where
      p.id = ${publication}
      and origen = 'Corporativo'
      and it.idioma_id = 1
      and d.domicilio_tipo = 1
      and esttrans.idioma_id = 1
      and pais.idioma_id = 1
    `
    const { result: views } = await mysqlLib.query(queryString)

    const certified = views.filter(v => v.emp_certificada === 1).map(v => v.emp_id).filter((v, i, s) => s.indexOf(v) === i).length
    const total = views.map(v => v.usu_id).filter((v, i, s) => s.indexOf(v) === i).length
    const countries = views.map(v => v.pais).filter((v, i, s) => s.indexOf(v) === i)
    const estates = views.map(v => v.estado).filter((v, i, s) => s.indexOf(v) === i)
    const industries = views.map(v => v.industria).filter((v, i, s) => s.indexOf(v) === i)

    const sellers = views.filter(v => v.usu_tipo === 1).map(v => v.usu_id).filter((v, i, s) => s.indexOf(v) === i).length
    const buyers = views.filter(v => v.usu_tipo === 2).map(v => v.usu_id).filter((v, i, s) => s.indexOf(v) === i).length
    const admins = views.filter(v => v.usu_tipo === 3).map(v => v.usu_id).filter((v, i, s) => s.indexOf(v) === i).length

    const data = {
      users: views,
      certified,
      total,
      countries: {
        total: countries.length,
        list: countries
      },
      estates: {
        total: estates.length,
        list: estates
      },
      industries,
      users: {
        sellers,
        buyers,
        admins
      }
    }

    return data
  }

  async getPublicationCommentsAndSubComments(publication) {
    debug('PublicationService -> getPublicationCommentsAndSubComments')
    const comments = await this.getComentariosPublicacion(publication)
    for (let i = 0; i < comments.length; i++) {
      const commentID = comments[i].comentario_id
      const subcomments = await this.getSubCommentsByCommentID(commentID)
      comments[i].subcomentarios = subcomments
      for (let j = 0; j < subcomments.length; j++) {
        const subcommentUUID = subcomments[j].subcomentario_uuid
        const subcomentsLikes = await this.getSubCommentsLikes(subcommentUUID)
        subcomments[j].likes = subcomentsLikes
      }
      const likes = await this.getCommentsLikes(commentID)
      comments[i].likes = likes
    }
    return comments
  }

  async postPublicationVideo(publicationID, url) {
    debug('PublicationService -> postPublicationVideo')
    const queryString = `
      UPDATE ${this.table}
      SET
      video = '${url}'
      WHERE id = ${publicationID}
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async postCorporativoVideo(emp_id, url) {
    const queryString = `
      UPDATE empresa
      SET
      emp_video = '${url}'
      WHERE emp_id = ${emp_id}
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async postCorporativoBanner(emp_id, url) {
    const queryString = `
      UPDATE empresa
      SET
      emp_banner = '${url}'
      WHERE emp_id = ${emp_id}
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }


  async postCorporativoLogo(emp_id, url) {
    const queryString = `
      UPDATE empresa
      SET
      emp_logo = '${url}'
      WHERE emp_id = ${emp_id}
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getLatestPublications() {
    debug('PublicationService -> getLatestPublications')
    const queryLatestPublications = `
      SELECT
        p.id as "publicacion_id",
        p.imagen as "publicacion_imagen",
        p.video as "publicacion_video",
        p.descripcion as "publicacion_descripcion",
        p.created_at as "publicacion_fecha_creacion",
        p.updated_at as "publicacion_fecha_actualizacion",
        p.origen as "publicacion_origen",
        u.usu_id as "usuario_id",
        u.usu_nombre as "usuario_nombre",
        u.usu_app as "usuario_apellido",
        u.usu_puesto as "usuario_puesto",
        u.usu_foto as "usuario_foto",
        u.usu_tipo as "usuario_tipo",
        e.emp_id as "empresa_id",
        e.emp_nombre as "empresa_nombre",
        e.emp_razon_social as "empresa_razon_social",
        e.emp_website as "empresa_website",
        e.emp_logo as "empresa_logo",
        e.emp_banner as "empresa_banner",
        e.emp_video as "empresa_video"
      FROM publicaciones AS p
      JOIN usuario as u on u.usu_id = p.usuario_id
      JOIN empresa as e on e.emp_id = p.empresa_id
      ORDER BY id DESC
      LIMIT 10
    `
    const { result: publications } = await mysqlLib.query(queryLatestPublications)

    for (let i = 0; i < publications.length; i++) {
      const id = publications[i].publicacion_id
      const comments = await this.getComentariosPublicacion(id)
      const likes = await this.getLikes(id)
      publications[i].likes = likes

      for (let j = 0; j < comments.length; j++) {
        const commentID = comments[j].comentario_id
        const subcomments = await this.getSubCommentsByCommentID(commentID)

        for (let h = 0; h < subcomments.length; h++) {
          const subcommentUUID = subcomments[h].subcomentario_uuid
          const subLikes = await this.getSubCommentsLikes(subcommentUUID)
          subcomments[h].likes = subLikes
        }

        const likes = await this.getCommentsLikes(commentID)
        comments[j].subcomentarios = subcomments
        comments[j].likes = likes
      }

      publications[i].comentarios = comments
    }

    return publications
  }

  async inserPublicationVisit(publicationID, user) {
    debug('PublicationService -> inserPublicationVisit')
    const queryString = `
    INSERT INTO ${this.publicationVisitTable}
    (usu_id, pub_id)
    VALUES
    (${user}, ${publicationID})
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }
}

const inst = new PublicationService()
Object.freeze(inst)

module.exports = inst
