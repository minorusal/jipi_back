const boom = require('boom')
const blogServices = require('../../services/blog')
const userServices = require('../../services/users')
const imagesToS3 = require('../../utils/uploadImageS3')
const parseLimitAndPage = require('../../utils/parseLimitAndPage')

exports.createArticle = async (req, res, next) => {
  try {
    const { files, body } = req
    if (files.length < 0 || files.length > 1) return next(boom.notAcceptable('You must provide at least one image per product.'))

    const articleImageUrl = await imagesToS3.imagesToS3(files[0])

    const { bodyArticle: rawHTLMEncoded, title, author } = body

    const results = await blogServices.createArticle(author, title, rawHTLMEncoded, articleImageUrl)

    return res.json({ ok: true, results })
  } catch (error) {
    next(error)
  }
}
exports.modifyArticle = async (req, res, next) => {
  try {
    const { bodyArticle, title, subtitle, author } = req.body
    const { artId } = req.params

    if (!Number(artId) || !artId) return next(boom.badRequest('art_id invalid.'))
    if (author && !Number(author)) return next(boom.badRequest('author invalid.'))

    const existArt = await blogServices.getArticleDetail(artId)
    if (existArt.length !== 1) return next(boom.notFound('Article not found.'))
    if (author) {
      const existAuthor = await blogServices.getAuthorDetail(author)
      if (existAuthor.length !== 1) return next(boom.notFound('Author not found.'))
    }
    const articleParams = {}

    if (bodyArticle) articleParams.bodyArticle = bodyArticle
    if (title) articleParams.title = title
    if (subtitle) articleParams.subtitle = subtitle
    if (author)articleParams.author = author
    if (req.files && req.files.images && req.files.images.length === 1) articleParams.image = await imagesToS3.imagesToS3(req.files.images[0])

    if (req.files && req.files.images && req.files.images.length > 1) return next(boom.badRequest('Only one image allowed.'))
    if ((Object.keys(req.body).length === 0 && req.body.constructor === Object) && !req.files) return next(boom.badRequest('You need at least one parameter.'))

    const results = await blogServices.modifyArticle(articleParams, artId)
    if (results !== 1) return next(boom.badRequest('Something went wrong.'))

    return res.json({ ok: true, msg: 'Article modified successfuly.' })
  } catch (error) {
    next(error)
  }
}

exports.getAllArticlesIds = async (req, res, next) => {
  try {
    const results = await blogServices.getAllIds()

    return res.json({ ok: true, results })
  } catch (error) {
    next(error)
  }
}
exports.getAllArticles = async (req, res, next) => {
  try {
    const [limit, page] = parseLimitAndPage(req.query.limit, req.query.page)

    if (page === 0) return next(boom.forbidden('Page not found.'))
    if (!limit || !page) return next(boom.notAcceptable('Limit and Page queries must be numbers.'))

    const results = await blogServices.getAllArticles(limit, page)

    return res.json({ ok: true, results })
  } catch (error) {
    next(error)
  }
}

exports.searchArticles = async (req, res, next) => {
  try {
    const { q: text } = req.query
    if (!text) return next(boom.badRequest('Query needed.'))
    const searchParameter = encodeURI(text)
    const results = await blogServices.searchArticle(searchParameter)

    return res.json({ ok: true, results })
  } catch (error) {
    next(error)
  }
}

exports.getArticleById = async (req, res, next) => {
  try {
    const { artId } = req.params

    const results = await blogServices.getArticleDetail(artId)
    if (results.length !== 1) return next(boom.notFound('Article not found.'))

    return res.json({ ok: true, results })
  } catch (error) {
    next(error)
  }
}

exports.createComment = async (req, res, next) => {
  try {
    const { usuId: usu_id } = req.payload
    const { comment, art_id } = req.body

    if (!comment || !art_id) return next(boom.badRequest('Comment and artId needed.'))

    const result = await blogServices.createComment(art_id, usu_id, comment)

    return res.json({ ok: true, results: { comment_id: result } })
  } catch (error) {
    next(error)
  }
}
// exports.createSubcomment = async (req, res, next) => {
//   try {
//     const { usuId: usu_id } = req.payload
//     const { subcomment, comment_id } = req.body

//     if (!subcomment || !comment_id) return next(boom.badRequest('subcomment and comment_id needed.'))

//     const commentExists = await blogServices.searchCommentId(comment_id)
//     if (commentExists.length !== 1) return next(boom.badRequest('Comment does not exists.'))

//     const subcomment_id = await blogServices.createSubcomment(comment_id, subcomment, usu_id)

//     return res.json({ ok: true, results: { subcomment_id } })
//   } catch (error) {
//     next(error)
//   }
// }

exports.getCommentsAndSubcommentsTreeByArtId = async (req, res, next) => {
  try {
    const { artId } = req.params
    if (!artId || !Number(artId)) return next(boom.badRequest('artId not valid.'))

    const doesArtExist = await blogServices.getArticleDetail(artId)
    if (doesArtExist.length !== 1) return next(boom.badRequest('Article not found'))

    const results = await blogServices.getCommentsAndSubcommentsTreeByArtId(artId)
    return res.json({ ok: true, results })
  } catch (error) {
    next(error)
  }
}

exports.regStats = async (req, res, next) => {
  try {
    const { social, search, origin, visit } = req.body
    const { usuId } = req.payload

    if (usuId) {
      const [result] = await userServices.getById(usuId)
      if (!result) return next(boom.badRequest('User not found.'))
    }

    const registered = []
    if (social) {
      await blogServices.regStatsSocial(usuId, social)
      registered.push('social')
    }
    if (search) {
      await blogServices.regStatsSearch(usuId, search)
      registered.push('search')
    }
    if (origin) {
      await blogServices.regStatsOrigin(usuId, origin)
      registered.push('origin')
    }
    if (visit) {
      await blogServices.regStatsVisit(usuId, visit)
      registered.push('visit')
    }

    return res.json({ error: false, registered })
  } catch (error) {
    next(error)
  }
}
