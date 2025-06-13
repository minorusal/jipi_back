'use strict'
const debug = require('debug')('old-api:companies-service')
const mysqlLib = require('../lib/db')

class VideosService {
  constructor () {
    if (VideosService.instance == null) VideosService.instance = this
    return VideosService.instance
  }

  async insertConvertedVideo ({ region, destBucket, videoConvertedFile }) {
    debug('video->insertConvertedVideo')
    let queryString = `
    select emp_id as Id, 'empresa' as TableName from empresa where emp_video like '%${videoConvertedFile}%'
    union
    select id as Id, 'publicaciones' as TableName  from publicaciones where video like '%${videoConvertedFile}%'
     `

    debug(queryString)
    const { result } = await mysqlLib.query(queryString)
    const Ids = result.reduce((acc, curr, i) => {
      if (curr.TableName === 'empresa') acc.empresa.push(curr.Id)
      if (curr.TableName === 'publicaciones') acc.publicaciones.push(curr.Id)

      return acc
    }, { empresa: [], publicaciones: [] })

    const resUpdate = []
    const newUrl = `https://${destBucket}.s3.${region}.amazonaws.com/${videoConvertedFile}.mp4`

    if (Ids.empresa.length > 0) {
      queryString = `update empresa set emp_video = '${newUrl}' where emp_id in (${Ids.empresa.join(',')})`
      debug(queryString)
      const { result } = await mysqlLib.query(queryString)
      resUpdate.push(result)
    }
    if (Ids.publicaciones.length > 0) {
      queryString = `update publicaciones set video = '${newUrl}' where id in (${Ids.publicaciones.join(',')})`
      debug(queryString)

      const { result } = await mysqlLib.query(queryString)
      resUpdate.push(result)
    }

    return resUpdate.length > 0 ? { error: false, msg: 'Updated video' } : { error: true, msg: 'There was a problem updating new video.' }
  }
}

const inst = new VideosService()
Object.freeze(inst)

module.exports = inst
