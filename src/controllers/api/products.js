'use strict'
const debug = require('debug')('old-api:productos-router')
const boom = require('boom')
const productService = require('../../services/products')
const companiesService = require('../../services/companies')
const userService = require('../../services/users')
const statisticService = require('../../services/statistics')
const { verifyToken } = require('../../utils/jwt')
const uploadImageS3 = require('../../utils/uploadImageS3')

const getProducts = async function (req, res, next) {
  try {
    const { query: { q: query, user: userRaw } } = req
    const queryArr = typeof query === 'string' ? [query] : query
    const user = parseInt(userRaw)

    const allowedQueries = ['latest', 'historical', 'bestselling', 'promos', 'mostwanted', 'tendencies', 'searchrelated', 'visitsrelated']
    const [latest, historical, bestSelling, promos, mostWanted, tendencies, searchRelated, visitsRelated] = allowedQueries
    const response = { error: false, numberEntries: null, results: [] }

    // si no hay query, devuelve todos
    if (!queryArr) response.results = await productService.getAllData()

    // devuelve error si existe el query y hay mas de un parametro
    if (queryArr && queryArr.length > 1) return next(boom.badRequest('Bad query. Only one parameter allowed.'))

    if (userRaw && !user) return next(boom.badRequest('User ID invalid.'))

    const isQueryAllowed = allowedQueries.find(el => el === queryArr[0])

    if ((queryArr && isQueryAllowed === searchRelated && !user) ||
      (queryArr && isQueryAllowed === visitsRelated && !user)) return next(boom.badRequest('User needed.'))

    if (queryArr && isQueryAllowed === latest) response.results = await productService.getAllDataLatest()
    if (queryArr && isQueryAllowed === historical) response.results = await productService.getAllDataHistorical()
    if (queryArr && isQueryAllowed === bestSelling) response.results = await productService.getAllDataBestSelling()
    if (queryArr && isQueryAllowed === promos) response.results = await productService.getAllDataPromos()
    if (queryArr && isQueryAllowed === mostWanted) response.results = await productService.getAllDataMostWanted()
    if (queryArr && isQueryAllowed === tendencies) response.results = await productService.getAllDataTendencies()
    if (queryArr && isQueryAllowed === searchRelated) response.results = await productService.getAllDataSearchRelated(user)
    if (queryArr && isQueryAllowed === visitsRelated) response.results = await productService.getAllDataVisitRelated(user)
    if (queryArr && !isQueryAllowed) return next(boom.badRequest('Bad query. Query not found.'))

    response.numberEntries = response.results.length
    res.json(response)
  } catch (err) {
    next(err)
  }
}

const getCategories = async function (req, res, next) {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const categorias = await productService.getProductsCategories()
    if (!categorias) return next(boom.badRequest('Error al consultar categorías'))
    res.json({
      error: false,
      results: {
        categorias
      }
    })
  } catch (err) {
    next(err)
  }
}

const getProductByID = async function (req, res, next) {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const { params: { productId } } = req
    let { query: { user } } = req
    user = Math.abs(user) || null

    const [userExists] = await userService.getById(user)

    if (userExists) {
      await productService.insertProductVisit(productId, user)
    }

    const product = await productService.getByIdDetalles(productId)

    const comentarios = await productService.getCommentsProduct(productId)
    product.comentarios = comentarios

    res.json({
      error: false,
      pageNumber: null,
      numberEntries: 1,
      results: product
    })
  } catch (err) {
    next(err)
  }
}

const getProductByIDWebVersion = async function (req, res, next) {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const { params: { productId } } = req

    // Existe producto?
    const [producto] = await productService.getById(productId)
    // No existe 400
    if (!producto) return next(boom.badRequest('No existe el producto'))

    let { query: { user } } = req
    user = Math.abs(user) || null

    const [userExists] = await userService.getById(user)

    if (userExists) {
      await productService.insertProductVisit(productId, user)
    }

    // Detalles de empresa
    const { empresa_id: empresaID } = producto
    const [empresa] = await companiesService.getEmpresa(empresaID)

    // Obtener calificación de la empresa
    const [calificacionEmpresa] = await statisticService.getPromediosExperienciaEmpresa(empresaID)
    const { tiempo } = calificacionEmpresa
    empresa.calificacion = tiempo * 10 || null

    // Detalles de traducciones y cadenas de texto
    const textos = await productService.getProductoTraducciones(productId)
    producto.textos = textos

    // Comentarios
    const comentarios = await productService.getCommentsProduct(productId)
    producto.comentarios = comentarios
    // Calificaciones
    const calificaciones = await productService.getProductoCalificaciones(productId)
    // Calificación total
    const [calificacion] = await productService.getProductoCalificacion(productId)
    const { total } = calificacion

    producto.calificacion = {
      total: total ? Number(total) : null,
      calificaciones
    }

    // Imágenes
    const fotos = await productService.getProductoFotos(productId)
    producto.fotos = fotos

    // ¿Cuántas veces se ha vendido el producto?
    const [ventasRaw] = await productService.totalSalesOfProduct(productId)
    producto.ventas_totales = ventasRaw.total

    // Obtener reviews del producto

    const productReviews = await productService.getProductReviewByID(productId)
    for (let i = 0; i < productReviews.length; i++) {
      const reviewID = productReviews[i].review_id
      const photosRaw = await productService.getProductReviewPhotos(reviewID)
      const photos = photosRaw.reduce((iv, cv) => {
        const url = cv.foto
        iv.push(url)
        return iv
      }, [])
      productReviews[i].photos = photos
    }

    producto.reviews = productReviews

    const totalSells = await productService.getTotalSells(productId)
    producto.ventasTotales = totalSells

    res.json({
      error: false,
      results: {
        producto,
        empresa
      }
    })
  } catch (err) {
    next(err)
  }
}

const search = async function (req, res, next) {
  try {
    const { body: { search } } = req
    const products = await productService.search(search)

    res.json({
      error: false,
      pageNumber: null,
      numberEntries: products.length,
      results: products
    })
  } catch (err) {
    next(err)
  }
}

const createComment = async function (req, res, next) {
  try {
    const { body: { usuario, comentario, calificacion }, params: { productoID } } = req

    const [existeProducto] = await productService.getProductById(productoID)
    if (!existeProducto) return next(boom.badRequest('No existe el producto'))

    const [existeUsuario] = await userService.getById(usuario)
    if (!existeUsuario) return next(boom.badRequest('No existe el usuario'))

    const [existeComentario] = await productService.getCommentProductByUser(productoID, usuario)
    if (existeComentario) return next(boom.badRequest('Ya existe un comentario para este producto por parte de este usuario'))

    const [existeCalificacion] = await productService.getRateProductByUser(productoID, usuario)
    if (existeCalificacion) return next(boom.badRequest('Ya existe una calificación para este producto por parte de este usuario'))

    // Crear comentario
    const { affectedRows: comentarioCreado } = await productService.commentProduct(productoID, usuario, comentario)
    if (comentarioCreado === 0) return next(boom.badRequest('Comentario no creado'))

    // Si el comentario fue creado crear la calificación
    await productService.rateProduct(productoID, usuario, calificacion)

    // Obtener comentario recién creado
    const [comentarioRecienCreado] = await productService.getCommentCreated(productoID, usuario)

    return res.json({
      ok: true,
      results: comentarioRecienCreado
    })
  } catch (err) {
    next(err)
  }
}

const editComment = async function (req, res, next) {
  try {
    const { body: { usuario, comentario, calificacion }, params: { id: producto } } = req
    const [existeProducto] = await productService.getProductById(producto)
    if (!existeProducto) return next(boom.badRequest('No existe el producto'))

    const [existeUsuario] = await userService.getById(usuario)
    if (!existeUsuario) return next(boom.badRequest('No existe el usuario'))

    const [existeComentario] = await productService.getCommentProductByUser(producto, usuario)
    if (!existeComentario) return next(boom.badRequest('No existe un comentario para este producto por parte de este usuario'))

    await productService.editCommentProduct(producto, usuario, comentario)

    await productService.updateRateProduct(producto, usuario, calificacion)

    const [comentarioEditado] = await productService.getCommentCreated(producto, usuario)

    res.json({
      error: false,
      result: comentarioEditado
    })
  } catch (err) {
    next(err)
  }
}

const deleteComment = async function (req, res, next) {
  try {
    const { body: { usuario }, params: { id: producto } } = req
    const [existeProducto] = await productService.getProductById(producto)
    if (!existeProducto) return next(boom.badRequest('No existe el producto'))

    const [existeUsuario] = await userService.getById(usuario)
    if (!existeUsuario) return next(boom.badRequest('No existe el usuario'))

    const [existeComentario] = await productService.getCommentProductByUser(producto, usuario)
    if (!existeComentario) return next(boom.badRequest('No existe un comentario para este producto por parte de este usuario'))

    const { affectedRows: productoBorrado } = await productService.deleteCommentProduct(producto, usuario)
    if (productoBorrado === 0) return next(boom.badRequest('Comentario no eliminado'))
    const { affectedRows: calificacionBorrada } = await productService.deleteRateProduct(producto, usuario)
    if (calificacionBorrada === 0) return next(boom.badRequest('Calificación no eliminada'))

    res.json({
      error: false,
      result: {
        producto: Number(producto),
        usuario,
        deleted: true
      }
    })
  } catch (err) {
    next(err)
  }
}

const createProductCategory = async function (req, res, next) {
  try {
    const { body: { categoria, producto } } = req
    // ¿Existe categoria?
    const [existeCategoria] = await productService.getProductsCategory(categoria)
    if (!existeCategoria) return next(boom.badRequest('No existe la categoría'))
    // ¿Existe producto?
    const [existeProducto] = await productService.getProductById(producto)
    if (!existeProducto) return next(boom.badRequest('No existe el producto'))

    // Actualizar la categoría
    const { affectedRows: categoriaActualizada } = await productService.updateProductCategory(producto, categoria)
    if (categoriaActualizada === 0) return next(boom.badRequest('No se pudo actualizar la categoría del producto'))

    res.json({
      error: false,
      results: {
        categoria,
        producto
      }
    })
  } catch (err) {
    next(err)
  }
}

const createProductReview = async (req, res, next) => {
  try {
    debug(`[${req.method}] ${req.originalUrl}`)
    const { body: { body: bodyRaw } } = req
    const body = JSON.parse(bodyRaw)
    const { token } = body
    // Crear tokens diferentes

    // const tokenFake = {
    //   user: 58,
    //   product: 4
    // }, '365d')
    // return res.json({
    //   tokenFake
    // })

    const validToken = verifyToken(token)

    if (!validToken) return next(boom.unauthorized('Ivalid token'))

    // ¿Existe calificacion previa?
    // Si existe no calificar.
    const [previousRate] = await productService.getProductReviewByIDs(validToken.user, validToken.product)
    if (previousRate) return next(boom.badRequest('Review already exists'))

    // No existe...
    const { rate } = validToken
    if (!rate) {
      // No hay calificación en token, la calificación será manual
      const { review } = body
      if (!review) {
        return res.status(202).json({
          error: false,
          results: {
            created: false,
            message: 'You can continue with the process now',
            product_id: validToken.product
          }
        })
      }

      const { title, comment, quality, price, delivery } = review

      const { insertId: reviewID } = await productService.createProductReview(validToken.user, validToken.product, quality, price, delivery, title, comment)

      // ¿Hay imágenes?
      const { files } = req
      let photos = null
      if (files.images.length > 0) {
        const filesNames = []
        for (let i = 0; i < files.images.length; i++) {
          const Location = await uploadImageS3.uploadImageS3(files.images[i])
          filesNames.push(Location)
        }
        await productService.insertProductReviewPhotos(reviewID, filesNames)
        photos = filesNames
      }

      // Detalles
      return res.status(201).json({
        error: false,
        results: {
          created: true,
          review: {
            title,
            comment,
            photos
          }
        }
      })
    } else {
      // Hay calificación en token, calificar
      await productService.createProductReview(validToken.user, validToken.product, rate, rate, rate, undefined, undefined)
      return res.status(201).json({
        error: false,
        results: {
          created: true
        }
      })
    }
  } catch (error) {
    next(error)
  }
}

module.exports = {
  getProducts,
  getCategories,
  getProductByID,
  getProductByIDWebVersion,
  search,
  createComment,
  editComment,
  deleteComment,
  createProductCategory,
  createProductReview
}
