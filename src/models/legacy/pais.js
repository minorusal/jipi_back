// 'use strict'

// const helpers = require('../modules/helpers')

// module.exports = {
//     getPaises: getPaises,
//     getPaisByID: getPaisByID,
//     AddPais: AddPais,
//     UpdatePais: UpdatePais,
//     getPaisesLenguaje: getPaisesLenguaje
// }

// function getPaises() {
//     return helpers.getPaises('GET', conn_mysql,
//         `select * from pais `
//     )
// }

// function getPaisByID(pais_id) {
//     return helpers.getPaisByID('GET', conn_mysql,
//         `select * from pais where pais_id = @pais_id`
//         , pais_id)
// }

// function AddPais(datos) {
//     return helpers.AddPais('SET', conn_mysql,
//         `ìnsert into pais(pais_nombre,id_idioma) values(@pais_nombre,@id_idioma)`
//         , datos)
// }

// function UpdatePais(datos) {
//     return helpers.UpdatePais('SET', conn_mysql,
//         `update pais
//     set pais_nombre = @pais_nombre , id_idioma = @id_idioma
//     where  pais_id = @pais_id`
//         , datos)
// }

// function getPaisesLenguaje(idioma_id) {
//     if(idioma_id == 1){
//         return helpers.getPaisesLenguaje('GET', conn_mysql,
//         `select cpais_id, cpaid_nombre_esp as  cpaid_nombre , cpaid_status, cpaid_udapte from cat_pais `
//         , idioma_id)
//     }else if(idioma_id == 2){
//         return helpers.getPaisesLenguaje('GET', conn_mysql,
//         `select cpais_id, cpaid_nombre_ing as  cpaid_nombre , cpaid_status, cpaid_udapte from cat_pais `
//         , idioma_id)
//     }

// }
