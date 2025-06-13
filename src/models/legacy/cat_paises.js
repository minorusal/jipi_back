'use strict'
const mysqlLib = require('../../lib/db')

async function getPaisesCatalogo (d) {
  if (d.idioma == 1) {
    return await mysqlLib.mysqlQuery('GET',
      'SELECT cpais_id, cpaid_nombre_esp as cpaid_nombre FROM cat_pais WHERE cpaid_status = 1')
  } else {
    return await mysqlLib.mysqlQuery('GET',
      'SELECT cpais_id, cpaid_nombre_ing as cpaid_nombre FROM cat_pais WHERE cpaid_status = 1')
  }
}

async function getPaises () {
  return await mysqlLib.mysqlQuery('GET',
    'select * from cat_pais where cpaid_status= 1'
  )
}

async function getPaisByID (pais_id) {
  return await mysqlLib.mysqlQuery('GET',
    'select * from cat_pais where cpais_id = @pais_id and cpaid_status = 1'
    , pais_id)
}

async function AddPais (datos) {
  return await mysqlLib.mysqlQuery('SET',
    'ìnsert into cat_pais(cpaid_nombre_esp,cpaid_nombre_ing) values(@cpaid_nombre_esp,@cpaid_nombre_ing)'
    , datos)
}

async function UpdatePais (datos) {
  return await mysqlLib.mysqlQuery('SET',
    `update cat_pais 
    set cpaid_nombre_esp = @cpaid_nombre_esp , cpaid_nombre_ing = @cpaid_nombre_ing
    where  cpais_id = @pais_id`
    , datos)
}

async function getPaisesLenguaje (idioma_id) {
  if (idioma_id.idioma_id == 1) {
    return await mysqlLib.mysqlQuery('GET',
      'select cpais_id, cpaid_nombre_esp as  cpaid_nombre , cpaid_status, cpaid_udapte from cat_pais'
      , idioma_id)
  } else if (idioma_id.idioma_id == 2) {
    return await mysqlLib.mysqlQuery('GET',
      ' select cpais_id, cpaid_nombre_ing as  cpaid_nombre , cpaid_status, cpaid_udapte from cat_pais'
      , idioma_id)
  }
}
module.exports = {
  getPaisesCatalogo,
  getPaises,
  getPaisByID,
  AddPais,
  UpdatePais,
  getPaisesLenguaje
}
