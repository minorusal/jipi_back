'use strict'
const debug = require('debug')('old-api:blog-service')
const mysqlLib = require('../lib/db')
const { blogAuthor } = require('../config')

const setLimits = (limit, page) => {
  const n = page <= 1 ? 0 : limit * page - limit
  return ` limit ${[n, limit]}`
}

class BlogService {
  constructor (blogAuthor) {
    if (BlogService.instance == null) {
      this.blogAuthor = blogAuthor
      BlogService.instance = this
    }
    return BlogService.instance
  }

  async getPwdAndUserIdByEmail (email) {
    const queryString = `select usu_psw,usu_id from  usuario where usu_email like '${email}'`
    const { result: usuPwd } = await mysqlLib.query(queryString)

    let result
    if (usuPwd.length !== 1) result = false
    else result = usuPwd[0]

    return result
  }

  async getUserDetails (id) {
    const queryString = `select concat(u.usu_nombre,' ',u.usu_app) as usu_nombre, u.usu_foto from usuario u where u.usu_id = ${id}`
    const { result } = await mysqlLib.query(queryString)
    return result[0]
  }

  async createArticle (author, title, article, image) {
    const queryString = `insert into blog_articles(profile_id, title, body, image) values (${author},'${title}','${article}', '${image}')`
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getAllIds () {
    const queryString = 'select id from blog_articles'
    const { result } = await mysqlLib.query(queryString)
    const idsArr = result.reduce((acc, cur, i) => {
      acc.push(cur.id)
      return acc
    }, [])
    return idsArr
  }

  async getAllArticles (limit = 10, page = 1) {
    const paginatedQuery = async (query, limit, page) => {
      const { result: entries } = await mysqlLib.query(`${query.trim()}${setLimits(limit, page)}`)

      const splittedQuery = query.toLowerCase().split('from')
      const totalQuery = `select count(*) as count from ${splittedQuery[splittedQuery.length - 1]}`
      const { result } = await mysqlLib.query(totalQuery)
      const [{ count: totalEntries }] = result
      const totalPages = Math.ceil(totalEntries / limit)
      if (page > totalPages || page < 0) return { error: true, msg: 'Page not found.' }

      return { totalEntries, entries }
    }

    const queryString = `
      select ba.id as art_id, ba.title as article_title, ba.subtitle as article_subtitle, ba.body as article ,ba.image as article_image, 
      concat(u.usu_nombre,' ',u.usu_app) as author_nombre, bup.description as author_descripcion, u.usu_foto as author_foto,
      ba.created_at as article_createdAt
      from blog_articles ba
          join blog_user_profile bup on ba.profile_id = bup.id
          join usuario u on bup.usu_id = u.usu_id
      where u.usu_id = ${this.blogAuthor}
      `
    const result = await paginatedQuery(queryString, limit, page)

    return result
  }


  async searchArticle (text) {
    const queryString = `
    select ba.id as art_id, ba.title as article_title, ba.subtitle as article_subtitle,  ba.body as article, ba.image as article_image, 
    concat(u.usu_nombre,' ',u.usu_app) as author_nombre, bup.description as author_descripcion, u.usu_foto as author_foto,
    ba.created_at as article_createdAt
    from blog_articles ba
        join blog_user_profile bup on ba.profile_id = bup.id
        join usuario u on bup.usu_id = u.usu_id
    where u.usu_id = ${this.blogAuthor} and (ba.title like '%${text}%' or ba.body like '%${text}%')
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getArticleDetail (id) {
    const queryString = `
    select ba.title as article_title, ba.subtitle as article_subtitle,  ba.body as article, ba.image as article_image, 
    concat(u.usu_nombre,' ',u.usu_app) as author_nombre, bup.description as author_descripcion, u.usu_foto as author_foto,
    ba.created_at as article_createdAt
    from blog_articles ba
        join blog_user_profile bup on ba.profile_id = bup.id
        join usuario u on bup.usu_id = u.usu_id
    where ba.id = ${id} and u.usu_id = ${this.blogAuthor}
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async createComment (artId, usuId, comment) {
    const queryString = `insert into blog_comments(art_id, usu_id, body) values (${artId},${usuId},'${comment}')`
    const { result } = await mysqlLib.query(queryString)
    return result.insertId
  }

  // async createSubcomment (comment_id, subcomment, usu_id) {
  //   let queryString = `insert into blog_subcomments(usu_id, body) values(${usu_id},'${subcomment}')`

  //   const { result } = await mysqlLib.query(queryString)

  //   queryString = `insert into blog_comments_subcomments(comment_id, subcomment_id) values (${comment_id},${result.insertId})`
  //   const { result: result2 } = await mysqlLib.query(queryString)

  //   return result.insertId
  // }

  async searchCommentId (id) {
    const queryString = `select id as comment_id from blog_comments where comment_id = ${id}`
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getCommentsAndSubcommentsTreeByArtId (artid) {
    let queryString = `
    select bc.id as comment_id, bc.body as comment, concat(u.usu_nombre,' ',u.usu_app) as usu_nombre, u.usu_foto,  bc.created_at as createdAt
    from blog_comments bc
    join usuario u on bc.usu_id = u.usu_id
    where bc.art_id = ${artid}`

    const { result: arrComments } = await mysqlLib.query(queryString)

    // queryString = `
    // select bcs.comment_id, bs.subcomment_id, bs.subcomment, concat(u.usu_nombre,' ',u.usu_app) as usu_nombre, u.usu_foto,  bs.created_at
    // from blog_subcomments bs
    // join blog_comments_subcomments bcs on bs.subcomment_id = bcs.subcomment_id
    // join usuario u on bs.usu_id = u.usu_id
    // `

    // const { result: arrSubcomments } = await mysqlLib.query(queryString)

    // for (let i = 0; i < arrComments.length; i++) {
    //   arrComments[i].subcomments = []

    //   for (let j = 0; j < arrSubcomments.length; j++) {
    //     if (arrComments[i].comment_id === arrSubcomments[j].comment_id) {
    //       arrComments[i].subcomments.push(arrSubcomments[j])
    //       delete arrSubcomments[j].comment_id
    //     }
    //   }
    // }
    return arrComments
  }

  async modifyArticle (art, id) {
    const { bodyArticle, title, subtitle, author, image } = art

    const queryString = []
    bodyArticle && queryString.push(`update blog_articles ba set ba.article = '${bodyArticle}' where ba.art_id = ${id}`)
    title && queryString.push(`update blog_articles ba set ba.title = '${title}' where ba.art_id = ${id}`)
    subtitle && queryString.push(`update blog_articles ba set ba.subtitle = '${subtitle}' where ba.art_id = ${id}`)
    author && queryString.push(`update blog_articles ba set ba.profile_id = ${author} where ba.art_id = ${id}`)
    image && queryString.push(`update blog_articles ba set ba.image = '${image}' where ba.art_id = ${id}`)

    let results = 0
    for (let i = 0; i < queryString.length; i++) {
      const { result } = await mysqlLib.query(queryString[i])
      results += result.affectedRows
    }

    results = results / Object.keys(art).length

    return results
  }

  async getAuthorDetail (id) {
    const queryString = `select * from blog_user_profile where profile_id = ${id}`
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async regStatsSocial (usuId, social) {
    const queryString = `
    insert into blog_stats_social(usu_id, browser, type) values (${usuId},'${social.browser}',${social.type})
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async regStatsSearch (usuId, search) {
    const queryString = `
    insert into blog_stats_search(usu_id, term, browser) values (${usuId},'${search.term}', '${search.browser}')
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async regStatsOrigin (usuId, origin) {
    const queryString = `
    insert into blog_stats_origin(usu_id, type, browser) values (${usuId}, ${origin.type}, '${origin.browser}')
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async regStatsVisit (usuId, visit) {
    const queryString = `
    insert into blog_stats_visit(usu_id, art_id, browser) values (${usuId}, ${visit.art_id}, '${visit.browser}')
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }
}

const inst = new BlogService(blogAuthor)
Object.freeze(inst)

module.exports = inst
