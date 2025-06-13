'use strict'
// const debug = require('debug')('old-api:')
const crypto = require('crypto')
const UsuarioModel = require('../../models/legacy/usuario')
const bcrypt = require('bcrypt')
const EmpresaModel = require('../../models/legacy/empresa')
const PaisesModel = require('../../models/legacy/cat_paises')
const EstadoModel = require('../../models/legacy/cat_estado')
const IndustriaModel = require('../../models/legacy/cat_industria')
const ProductoModel = require('../../models/legacy/producto')
const CatUnidadModel = require('../../models/legacy/cat_unidad')
const CatTipoEquipo = require('../../models/legacy/cat_tipo_equipo')
const CatTipoCertificacion = require('../../models/legacy/cat_tipo_certificacion')
const CatTipoLogistica = require('../../models/legacy/cat_tipologistica')
const AlertaModel = require('../../models/legacy/alerta')
const processReqFeatures = require('../../utils/processrequestFeatures')
const statisticsService = require('../../services/statistics')

exports.getProcessRequest = function () {
  return new Promise(function (resolve, reject) {
  })
}

exports.AddProcessRequest = function (d, next) {
  return new Promise(function (resolve, reject) {
    const data = d.palabra.split(' ').join('+')

    const secretKey = '6d2O56957M79546P'
    const desencryptar = decrypt(data, secretKey)
    function decrypt (palabra, secretKey) {
      try {
        const llave = new Buffer(secretKey).toString('binary')
        const cipher = crypto.createDecipheriv('aes-128-ecb', llave, '')
        return cipher.update(data, 'base64', 'utf8') + cipher.final('utf8')
      } catch (e) {
        resolve({ err: true, descripcion: 'No se pudo decifrar tu palabra' })
      }
    }
    const arraydesencryptar = desencryptar.split('|')
    if (data != undefined && data != '') {
      if (arraydesencryptar[0] == 201) {
        // Login
        const usu_email = arraydesencryptar[1]
        const usu_psw = arraydesencryptar[2]

        if (usu_psw == undefined) {
          resolve({ login: { valido: '0', error: 'Faltan datos por Ingresar' } })
        } else {
          UsuarioModel.getUsuarioByMail({ usu_email: usu_email, usu_psw: usu_psw })
            .then(function (result) {
              if (result.result.length > 0) {
                bcrypt.compare(usu_psw, result.result[0].usu_psw, async function (err, res) {
                  if (res == true) {
                    await statisticsService.registerUserLogin(result.result[0].usu_id)
                    // delete result.result[0].usu_psw
                    resolve({ login: { valido: '1', error: 'Datos Correctos', usu: result.result[0] } })
                  } else {
                    resolve({ login: { valido: '0', error: 'Datos Incorrectos', usu: '' } })
                  }
                })
              } else {
                resolve({ login: { valido: '0', error: 'No se encuentra registrado el correo' } })
              }
            })
        }
      } else if (arraydesencryptar[0] == 102) {
        // CATALOGOS
        const catalogo = arraydesencryptar[1]
        const idioma = arraydesencryptar[2]
        if (catalogo == 1) {
          EmpresaModel.getEmpresasCatalogo({ idioma: idioma })
            .then(function (result) {
              resolve(!result.err ? { catalogo: result.result, valido: '1' } : { valido: '0', err: 'No se pudieron traer empresas' })
            })
        } else if (catalogo == 2) {
          PaisesModel.getPaisesCatalogo({ idioma: idioma })
            .then(function (result) {
              resolve(!result.err ? { catalogo: result.result, valido: '1' } : { valido: '0', err: 'Error en obtener Paises' })
            })
        } else if (catalogo == 3) {
          IndustriaModel.getIndustriaCatalogo({ idioma: idioma })
            .then(function (result) {
              resolve(!result.err ? { catalogo: result.result, valido: '1' } : { valido: '0', err: 'Error al obtener Industrias' })
            })
        } else if (catalogo == 4) {
          CatUnidadModel.getCatUnidad({ idioma: idioma })
            .then(function (result) {
              resolve(!result.err ? { catalogo: result.result, valido: '1' } : { valido: '0', err: 'Error al obtener catalogo de unidad' })
            })
        } else if (catalogo == 5) {
          EstadoModel.getEstadoCatalogo({ idioma: idioma })
            .then(function (result) {
              resolve(!result.err ? { catalogo: result.result, valido: '1' } : { valido: '0', err: 'Error al obtener catalogo de estados' })
            })
        } else if (catalogo == 6) {
          CatTipoEquipo.getTipoEquipoCatalogo({ idioma: idioma })
            .then(function (result) {
              resolve(!result.err ? { catalogo: result.result, valido: '1' } : { valido: '0', err: 'Error al obtener catalogo de tipo de equipo' })
            })
        } else if (catalogo == 7) {
          CatTipoLogistica.getCatLogisticaCatalogo({ idioma: idioma })
            .then(function (result) {
              resolve(!result.err ? { catalogo: result.result, valido: '1' } : { valido: '0', err: 'Error al obtener catalogo de tipo de logistica' })
            })
        }
      } else if (arraydesencryptar[0] == 200) {
        const usu_id = arraydesencryptar[1]
        const coddigo_user = arraydesencryptar[2]
        let usu_pw = arraydesencryptar[3]
        UsuarioModel.getVerificaCodigoUsuario({ usu_id: usu_id, coddigo_user: coddigo_user })
          .then(function (result) {
            if (result.result.length > 0) {
              const saltRounds = 10

              bcrypt.genSalt(saltRounds, function (errSalt, salt) {
                if (errSalt) return res.status(200).send({ message: 'Error no se pudo generar la contraseña (bcrypt) salt' })
                bcrypt.hash(usu_pw, salt, async function (errHash, hash) {
                  if (errHash) return res.status(200).send({ message: 'Error no se pudo generar la contraseña (bcrypt) hash' })
                  usu_pw = hash
                  UsuarioModel.UpdatePwUser({ usu_pw: usu_pw, usu_id: usu_id })
                    .then(function (result) {
                      resolve({ verifica: { valido: 1, error: 'Su contraseña ha sido actualizada' } })
                    })
                })
              })
            } else {
              resolve({ verifica: { valido: 0, error: 'Codigo Invalido' } })
            }
          })
      } else if (arraydesencryptar[0] == 204) {
        // verifica el codigo de registro
        const usu_id = arraydesencryptar[1]
        const codigo_user = arraydesencryptar[2]
        UsuarioModel.getVerificaCodigoUsuario({ usu_id: usu_id, codigo_user: codigo_user })
          .then(function (result) {
            const datos = result.result
            if (result.result.length > 0) {
              if (result.result[0].usu_verificado == 0) {
                UsuarioModel.Activar_Cuenta({ usu_id: usu_id, codigo_user: codigo_user })
                  .then(function (result) {
                    resolve({ verifica: { valido: 1, error: 'Su Cuenta ha sido Activada!', usu: datos } })
                  })
              } else {
                resolve({ verifica: { valido: 1, error: 'Su cuenta ya esta activada', usu: result.result } })
              }
            } else {
              resolve({ verifica: { valido: 0, error: '204', err: 'Su codigo es Invalido' } })
            }
          })
      } else if (arraydesencryptar[0] == 205) {
        // BUSCAR
        const usu_id = arraydesencryptar[1]
        const emp_id = arraydesencryptar[2]
        const texto = arraydesencryptar[3]
        const idioma_id = arraydesencryptar[4]
        ProductoModel.BuscadorProducto({ usu_id: usu_id, emp_id: emp_id, texto: texto, idioma_id: idioma_id })
          .then(function (result) {
            resolve(!result.err ? { resultados: result } : { err: 'Se produjo un error en buscador producto Id :205' })
          })
      } else if (arraydesencryptar[0] == 206) {
        // usu_id|prod_id|idioma
        const usu_id = arraydesencryptar[1]
        const prod_id = arraydesencryptar[2]
        const idioma_id = arraydesencryptar[3]

        ProductoModel.getProductoDetalleByID({ usu_id: usu_id, prod_id: prod_id, idioma_id: idioma_id })
          .then(function (result) {
            const producto = result.result
            if (producto.length > 0) {
              // for(let x=0; x<producto.length; x++){
              //    let arr_metodopago = producto[x].cmetodo_id.toString().split('');
              //    producto[x].cmetodo_id = arr_metodopago.join(",");
              // }
              const emp_id = producto[0].emp_id
              EmpresaModel.getEmpresaDetalleByID({ emp_id: emp_id, idioma_id: idioma_id })
                .then(function (result) {
                  const empresa = result.result
                  if (empresa.length > 0) {
                    ProductoModel.getProductoFotosByID({ prod_id: prod_id })
                      .then(function (result) {
                        const fotos = result.result
                        resolve({ producto: producto, fotos: fotos, empresa: empresa })
                      })
                  }
                })
            } else {
              resolve({ producto: { valido: 0, error: '206', err: 'No se encontro el producto' } })
            }
          })
      } else if (arraydesencryptar[0] == 208) {
        const idioma = arraydesencryptar[1]
        const tipo = arraydesencryptar[2]

        CatTipoCertificacion.getCatTipoCertificacion({ idioma: idioma, tipo: tipo })
          .then(function (result) {
            const certs = result.result
            if (certs.length > 0) {
              resolve({ certs: certs })
            } else {
              resolve({ certs: { valido: 0, error: '208', err: 'No se encontro el catálogo de certificados' } })
            }
          })
      } else if (arraydesencryptar[0] == 209) {
        // detalle producto
        const prod_id = arraydesencryptar[1]
        let producto = ''
        let fotos = ''
        let translate = ''
        ProductoModel.getProductoByID({ prod_id: prod_id })
          .then(function (result) {
            producto = result.result
            if (producto.length > 0) {
              ProductoModel.getProductoTranslateByID({ prod_id: prod_id })
                .then(function (result) {
                  translate = result.result
                  if (translate.length > 0) {
                    ProductoModel.getProductoFotosByID({ prod_id: prod_id })
                      .then(function (result) {
                        fotos = result.result
                        resolve({ prod: producto, translates: translate, fotos: fotos })
                      })
                  }
                })
            } else {
              resolve({ prod: { valido: 0, error: '209', err: 'No se encontro el producto' } })
            }
          })
      } else if (arraydesencryptar[0] == 210) {
        const emp_id = arraydesencryptar[1]
        EmpresaModel.getPublicacionEmpresa({ emp_id: emp_id })
          .then(function (result) {
            const publicaciones = result.result
            resolve(!result.err ? { publicacion: publicaciones } : { publicacion: { valido: 0, error: 'Error al buscar publicaciones' } })
          })
      } else if (arraydesencryptar[0] == 211) {
        const emp_id = arraydesencryptar[1]
        EmpresaModel.getEmpresaByID({ emp_id: emp_id })
          .then(function (result) {
            const empresa = result.result
            EmpresaModel.getEmpresaTranslateByID({ emp_id: emp_id })
              .then(function (result) {
                const translates = result.result
                EmpresaModel.getEmpresaFotoByID({ emp_id: emp_id })
                  .then(function (result) {
                    const fotos = result.result
                    EmpresaModel.getEmpresaVideosByID({ emp_id: emp_id })
                      .then(function (result) {
                        const videos = result.result
                        EmpresaModel.getEmpresaExportaByID({ emp_id: emp_id })
                          .then(function (result) {
                            const exporta = result.result
                            EmpresaModel.getEmpresaEstadosByID({ emp_id: emp_id })
                              .then(function (result) {
                                const estados = result.result
                                resolve(!result.err ? { empresa: empresa, translates: translates, fotos: fotos, videos: videos, exporta: exporta, estados: estados } : { empresa: { valido: 0, error: 'Error al buscar la empresa' } })
                              })
                          })
                      })
                  })
              })
          })
      } else if (arraydesencryptar[0] == 212) {
        const emp_id = arraydesencryptar[1]
        const idioma_id = arraydesencryptar[2]
        EmpresaModel.getEmpresaByIDIdioma({ emp_id: emp_id, idioma_id: idioma_id })
          .then(function (result) {
            const empresa = result.result
            EmpresaModel.getEmpresaTranslateByID({ emp_id: emp_id })
              .then(function (result) {
                const translates = result.result
                EmpresaModel.getEmpresaFotoByID({ emp_id: emp_id })
                  .then(function (result) {
                    const fotos = result.result
                    EmpresaModel.getEmpresaVideosByID({ emp_id: emp_id })
                      .then(function (result) {
                        const videos = result.result
                        resolve(!result.err ? { empresa: empresa, translates: translates, fotos: fotos, videos: videos } : { empresa: { valido: 0, error: 'Error al buscar la empresa' } })
                      })
                  })
              })
          })
      } else if (arraydesencryptar[0] == 214) {
        const emp_id = arraydesencryptar[1]
        UsuarioModel.getUsuarioByEmpresa({ emp_id: emp_id })
          .then(function (result) {
            const usuarios = result.result
            resolve(!result.err ? { usuarios: usuarios } : { usuarios: { valido: 0, error: 'Error al buscar eventos 214' } })
          })
      } else if (arraydesencryptar[0] == 216) {
        const prod_ids = arraydesencryptar[1]
        const idioma_id = arraydesencryptar[2]
        console.log(prod_ids, idioma_id)
        ProductoModel.BuscadorProductoByID({ prod_ids: prod_ids, idioma_id: idioma_id })
          .then(function (result) {
            resolve(!result.err ? { resultados: result } : { err: 'Se produjo un error en buscador producto Id :205' })
          })
      } else if (arraydesencryptar[0] == 218) {
        let busca = arraydesencryptar[1]
        busca = busca.replace(/ /gi, '%')

        UsuarioModel.getUsuarioBySearch({ busca: busca })
          .then(function (result) {
            const busca = result.result
            resolve({ buscador: busca })
          })
      } else if (arraydesencryptar[0] == 219) {
        // BUSCAR
        const usu_id = arraydesencryptar[1]
        const idioma_id = arraydesencryptar[2]
        UsuarioModel.getFavoritosByUsuID({ usu_id: usu_id, idioma_id: idioma_id })
          .then(function (result) {
            resolve(!result.err ? { resultados: result.result } : { err: 'Se produjo un error en buscador producto Id :219' })
          })
      } else if (arraydesencryptar[0] == 225) {
        const usu_id = arraydesencryptar[1]
        UsuarioModel.getUsuarioBadges({ usu_id: usu_id })
          .then(function (result) {
            const badges = result.result[0]
            resolve(!result.err ? { login: { alertas: badges.num_alertas, network: badges.num_network, deals: badges.num_deals } } : { valido: '0', error: 'Error en el servicio 225', login: {} })
          })
      } else if (arraydesencryptar[0] == 226) {
        const usu_id = arraydesencryptar[1]
        const idioma_id = arraydesencryptar[2]
        AlertaModel.getAlertaByUsuID({ idioma_id: idioma_id, usu_id: usu_id })
          .then(function (result) {
            const arletas = result.result
            resolve(!result.err ? { valido: '1', error: '', arletas: arletas } : { valido: '0', error: 'Error en el servicio 226', alertas: [] })
          })
      } else if (arraydesencryptar[0] == 227) {
        const usu_id = arraydesencryptar[1]
        UsuarioModel.getEventosByUsuID({ usu_id: usu_id })
          .then(function (result) {
            const eventos = result.result
            resolve(!result.err ? { evento: eventos } : { evento: { valido: 0, error: 'Error al buscar eventos 227' } })
          })
      } else if (arraydesencryptar[0] == 302) {
        // titulo|nombre|desc|correo
        const titulo = arraydesencryptar[1]
        const nombre = arraydesencryptar[2]
        const desc = arraydesencryptar[3]
        const correo = arraydesencryptar[4]
        UsuarioModel.AddComentario({ cmt_titulo: titulo, cmt_desc: desc, cmt_nombre: nombre, cmt_correo: correo })
          .then(function (result) {
            if (!result.err) processReqFeatures.generateEmailsProcess302(correo.trim(), nombre, titulo, desc)
            resolve(!result.err ? { contacto: { valido: '1', error: 'Se agrego correctamente el comentario' } } : { contacto: { valido: '0', error: 'Error en el servicio 302' } })
          })
      } else if (arraydesencryptar[0] == 303) {
        // usu_id|prod_id|accion
        const usu_id = arraydesencryptar[1]
        const producto_id = arraydesencryptar[2]
        const accion = arraydesencryptar[3]
        UsuarioModel.AccionFavorito({ prod_id: producto_id, usu_id: usu_id, accion: accion })
          .then(function (result) {
            resolve(!result.err ? { favorito: { valido: '1', error: 'Funcion ejecutada correctamente' } } : { favorito: { valido: '0', error: 'Error en el servicio 303' } })
          })
      } else if (arraydesencryptar[0] == 305) {
        // AGREGAR MIS PRODUCTOS
        // emp_id|nom|desc|video|precio|moneda|envio|promocion|minimo|unidad|metodo|local|nac|int|idioma|nom2|desc2|video2|idioma2|disponible|marca
        const emp_id = arraydesencryptar[1]
        const prod_nombre = arraydesencryptar[2]
        const prod_desc = arraydesencryptar[3]
        const prod_video = arraydesencryptar[4]
        const prod_precio_lista = arraydesencryptar[5]
        const cmon_id = arraydesencryptar[6]
        const prod_precio_envio = arraydesencryptar[7]
        const prod_precio_promo = arraydesencryptar[8]
        const prod_compra_minima = arraydesencryptar[9]
        const cuni_id = arraydesencryptar[10]
        const cmetodo_id = arraydesencryptar[11]
        const prod_cobertura_loc = arraydesencryptar[12]
        const prod_cobertura_nac = arraydesencryptar[13]
        const prod_cobertura_int = arraydesencryptar[14]
        const idioma_id = arraydesencryptar[15]
        const prod_nombre_trad = arraydesencryptar[16]
        const prod_desc_trad = arraydesencryptar[17]
        const prod_video_trad = arraydesencryptar[18]
        const idioma_id_trad = arraydesencryptar[19]
        const prod_disponible = arraydesencryptar[20]
        const prod_marca = arraydesencryptar[21]
        const prod_precio_envio_nacional = arraydesencryptar[22]
        const prod_precio_envio_internacional = arraydesencryptar[23]
        const prod_categoria_id = arraydesencryptar[24]
        let prod_nuevo = '0'
        let prod_clearence = '0'
        if (prod_precio_promo == '') { prod_nuevo = '1'; prod_clearence = '0' } else { prod_nuevo = '0'; prod_clearence = '1' }
        ProductoModel.AddProductoMisProductos305({
          emp_id: emp_id,
          prod_precio_lista: prod_precio_lista,
          cmon_id: cmon_id,
          prod_precio_envio: prod_precio_envio,
          prod_precio_promo: prod_precio_promo,
          prod_compra_minima: prod_compra_minima,
          cuni_id: cuni_id,
          cmetodo_id: cmetodo_id,
          prod_cobertura_loc: prod_cobertura_loc,
          prod_cobertura_nac: prod_cobertura_nac,
          prod_cobertura_int: prod_cobertura_int,
          prod_nuevo: prod_nuevo,
          prod_clearance: prod_clearence,
          prod_disponible: prod_disponible,
          prod_marca: prod_marca,
          prod_precio_envio_nacional: prod_precio_envio_nacional,
          prod_precio_envio_internacional: prod_precio_envio_internacional,
          prod_categoria_id: prod_categoria_id
        })
          .then(function (result) {
            if (!result.err) {
              ProductoModel.getidmaxProducto()
                .then(function (result) {
                  if (!result.err) {
                    const prod_id = result.result[0].prod_id
                    ProductoModel.AddProductoTranslate({ prod_id: prod_id, prod_nombre: prod_nombre, prod_desc: prod_desc, idioma_id: idioma_id, prod_video: prod_video })
                      .then(function (result) {
                        if (!result.err) {
                          ProductoModel.AddProductoTranslate({ prod_id: prod_id, prod_nombre: prod_nombre_trad, prod_desc: prod_desc_trad, idioma_id: idioma_id_trad, prod_video: prod_video_trad })
                            .then(function (result) {
                              resolve(!result.err ? { prod: { valido: '1', error: 'Se agrego correctamente', prod_id: prod_id } } : { prod: { valido: '0', error: 'Error en el servicio 305' } })
                            })
                        } else {
                          resolve({ prod: { valido: '0', error: 'Error en el servicio 305' } })
                        }
                      })
                  } else {
                    resolve({ prod: { valido: '0', error: 'Error en el servicio 305' } })
                  }
                })
            } else {
              resolve({ prod: { valido: '0', error: 'Error en el servicio 305' } })
            }
          })
      } else if (arraydesencryptar[0] == 306) {
        const prod_id = arraydesencryptar[1]
        ProductoModel.DeleteProducto306({ prod_id: prod_id })
          .then(function (result) {
            if (!result.err) {
              resolve(!result.err ? { prod: { valido: '1', error: 'Se eliminó correctamente', prod_id: prod_id } } : { prod: { valido: '0', error: 'Error en el servicio 306' } })
            }
          })
      } else if (arraydesencryptar[0] == 307) {
        // prod_id|nom|desc|video|precio|moneda|envio|promocion|minimo|unidad|metodo|local|nac|int|idioma|nom2|desc2|video2|idioma2
        const prod_id = arraydesencryptar[1]
        const prod_nombre = arraydesencryptar[2]
        const prod_desc = arraydesencryptar[3]
        const prod_video = arraydesencryptar[4]
        const prod_precio_lista = arraydesencryptar[5]
        const cmon_id = arraydesencryptar[6]
        const prod_precio_envio = arraydesencryptar[7]
        let prod_precio_promo = arraydesencryptar[8]
        if (!prod_precio_promo) prod_precio_promo = '0'
        const prod_compra_minima = arraydesencryptar[9]
        const cuni_id = arraydesencryptar[10]
        const cmetodo_id = arraydesencryptar[11]
        const prod_cobertura_loc = arraydesencryptar[12]
        const prod_cobertura_nac = arraydesencryptar[13]
        if (!prod_cobertura_nac) prod_precio_promo = '0'
        const prod_cobertura_int = arraydesencryptar[14]
        if (!prod_cobertura_int) prod_precio_promo = '0'
        const idioma_id = arraydesencryptar[15]
        const prod_nombre_trad = arraydesencryptar[16]
        const prod_desc_trad = arraydesencryptar[17]
        const prod_video_trad = arraydesencryptar[18]
        const idioma_id_trad = arraydesencryptar[19]
        const prod_disponible = arraydesencryptar[20]
        const prod_marca = arraydesencryptar[21]
        const prod_precio_envio_nacional = arraydesencryptar[22]
        const prod_precio_envio_internacional = arraydesencryptar[23]
        const prod_categoria_id = arraydesencryptar[24]
        let prod_nuevo = '0'
        let prod_clearence = '0'
        if (prod_precio_promo == '') { prod_nuevo = '1'; prod_clearence = '0' } else { prod_nuevo = '0'; prod_clearence = '1' }
        ProductoModel.UpdateProducto307({
          prod_id: prod_id,
          prod_precio_lista: prod_precio_lista,
          cmon_id: cmon_id,
          prod_precio_envio: prod_precio_envio,
          prod_precio_promo: prod_precio_promo,
          prod_compra_minima: prod_compra_minima,
          cuni_id: cuni_id,
          cmetodo_id: cmetodo_id,
          prod_cobertura_loc: prod_cobertura_loc,
          prod_cobertura_nac: prod_cobertura_nac,
          prod_cobertura_int: prod_cobertura_int,
          prod_nuevo: prod_nuevo,
          prod_clearance: prod_clearence,
          prod_disponible: prod_disponible,
          prod_marca: prod_marca,
          prod_precio_envio_nacional: prod_precio_envio_nacional,
          prod_precio_envio_internacional: prod_precio_envio_internacional,
          prod_categoria_id: prod_categoria_id
        })
          .then(function (result) {
            if (!result.err) {
              ProductoModel.UpdateProductoTranslate({ prod_id: prod_id, prod_nombre: prod_nombre, prod_desc: prod_desc, idioma_id: idioma_id, prod_video: prod_video })
                .then(function (result) {
                  if (!result.err) {
                    ProductoModel.UpdateProductoTranslate({ prod_id: prod_id, prod_nombre: prod_nombre_trad, prod_desc: prod_desc_trad, idioma_id: idioma_id_trad, prod_video: prod_video_trad })
                      .then(function (result) {
                        resolve(!result.err ? { prod: { valido: '1', error: 'Se actualizó correctamente', prod_id: prod_id } } : { prod: { valido: '0', error: 'Error en el servicio 307' } })
                      })
                  } else {
                    resolve({ prod: { valido: '0', error: 'Error en el servicio 307' } })
                  }
                })
            } else {
              resolve({ prod: { valido: '0', error: 'Error en el servicio 307' } })
            }
          })
      } else if (arraydesencryptar[0] == 310) {
        // usu_id|nom|app|puesto|psw|boletin|idioma
        const usu_id = arraydesencryptar[1]
        const nombre = arraydesencryptar[2]
        const appaterno = arraydesencryptar[3]
        const puesto = arraydesencryptar[4]
        let psw = arraydesencryptar[5]
        const boletin = arraydesencryptar[6]
        const idioma = arraydesencryptar[7]
        UsuarioModel.getUsuarioByID({ usu_id: usu_id })
          .then(function (result) {
            if (result.result.length > 0) {
              if (psw == result.result[0].usu_psw) {
                UsuarioModel.updateUsuarioPerfil({ usu_id: usu_id, usu_nombre: nombre, usu_app: appaterno, usu_puesto: puesto, usu_boletin: boletin, usu_idioma: idioma, usu_psw: '1' })
                  .then(function (result) {
                    resolve(!result.err ? { persona: { valido: 1, err: 'Se Guardaron los Cambios Correctamente' } } : { persona: { err: 'Fallo al modificar Perfil ', valido: 0 } })
                  })
              } else {
                const saltRounds = 10

                bcrypt.genSalt(saltRounds, function (errSalt, salt) {
                  if (errSalt) return res.status(200).send({ message: 'Error no se pudo generar la contraseña (bcrypt) salt' })
                  bcrypt.hash(psw, salt, async function (errHash, hash) {
                    if (errHash) return res.status(200).send({ message: 'Error no se pudo generar la contraseña (bcrypt) hash' })
                    psw = hash
                    UsuarioModel.updateUsuarioPerfil({ usu_id: usu_id, usu_nombre: nombre, usu_app: appaterno, usu_puesto: puesto, usu_boletin: boletin, usu_idioma: idioma, usu_psw: psw })
                      .then(function (result) {
                        resolve(!result.err ? { valido: 1, err: 'Se Guardaron los Cambios Correctamente' } : { err: 'Fallo al modificar Perfil ', valido: 0 })
                      })
                  })
                })
              }
            }
          })
      } else if (arraydesencryptar[0] == 311) {
        // foto_id,foto_id,foto_id
        const fotos_id = arraydesencryptar[1]
        ProductoModel.DeleteProductoFoto({ producto_foto_id: fotos_id })
          .then(function (result) {
            resolve(!result.err ? { prod: { valido: '1', error: 'Se borraron correctamente las fotos' } } : { prod: { valido: '0', error: 'Error en el servicio 311' } })
          })
      } else if (arraydesencryptar[0] == 313) {
        // emp_id|usu_id|id_padre|desc
        const emp_id = arraydesencryptar[1]
        const usu_id = arraydesencryptar[2]
        const pub_id_padre = arraydesencryptar[3]
        const pub_desc = arraydesencryptar[4]
        EmpresaModel.addPublicacionEmpresa({ emp_id: emp_id, usu_id: usu_id, pub_id_padre: pub_id_padre, pub_desc: pub_desc })
          .then(function (result) {
            resolve(!result.err ? { publicacion: { valido: '1', error: 'Se inserto correctamente la publicación' } } : { publicacion: { valido: '0', error: 'Error en el servicio 313' } })
          })
      } else if (arraydesencryptar[0] == 314) {
        const usu_id = arraydesencryptar[1]
        const emp_id = arraydesencryptar[2]
        const pub_id = arraydesencryptar[3]
        const eve_id = arraydesencryptar[4]
        const tipo = arraydesencryptar[5]
        // @usu_id,@emp_id,@pub_id,@eve_id,@pea_tipo
        EmpresaModel.addAccionPublicacion({ usu_id: usu_id, emp_id: emp_id, pub_id: pub_id, eve_id: eve_id, pea_tipo: tipo })
          .then(function (result) {
            resolve(!result.err ? { publicacion: { valido: '1', error: 'Se inserto correctamente la accion de la publicacion' } } : { publicacion: { valido: '0', error: 'Error en el servicio 314' } })
          })
      } else if (arraydesencryptar[0] == 316) {
        // foto_id,foto_id,foto_id
        const fotos_id = arraydesencryptar[1]
        EmpresaModel.DeleteEmpresaFoto({ empresa_foto_id: fotos_id })
          .then(function (result) {
            resolve(!result.err ? { empresa: { valido: '1', error: 'Se borraron correctamente las fotos' } } : { empresa: { valido: '0', error: 'Error en el servicio 316' } })
          })
      } else if (arraydesencryptar[0] == 320) {
        const usu_id = arraydesencryptar[1]
        const usu_id_amigo = arraydesencryptar[2]
        const tipo = arraydesencryptar[3]
        UsuarioModel.uploadNetworkingUsuID({ usu_id: usu_id, usu_id_amigo: usu_id_amigo, net_status: tipo })
          .then(function (result) {
            resolve(!result.err ? { invitacion: { valido: '1', error: 'Se agrego correctamente el contacto' } } : { invitacion: { valido: '0', error: 'Error en el servicio 320' } })
          })
      } else if (arraydesencryptar[0] == 321) {
        const usu_id = arraydesencryptar[1]
        const usu_id_amigo = arraydesencryptar[2]
        const tipo = arraydesencryptar[3]
        UsuarioModel.checkNetwokring({ usu_id: usu_id, usu_id_amigo: usu_id_amigo })
          .then(function (result) {
            if (!result.err) {
              if (result.result[0].cuantos == '0') {
                UsuarioModel.addNetworking({ usu_id: usu_id, usu_id_amigo: usu_id_amigo, net_status: tipo })
                  .then(function (result) {
                    resolve(!result.err ? { invitacion: { valido: '1', error: 'Se agrego correctamente el contacto' } } : { invitacion: { valido: '0', error: 'Error en el servicio 321' } })
                  })
              } else {
                resolve({ invitacion: { valido: '0', error: 'Networking ya agregado' } })
              }
            } else {
              resolve({ invitacion: { valido: '0', error: 'Error, al consultar' } })
            }
          })
      } else if (arraydesencryptar[0] == 325) {
        const usu_id = arraydesencryptar[1]
        const titulo = arraydesencryptar[2]
        const desc = arraydesencryptar[3]
        UsuarioModel.setOpinion({ opinion_titulo: titulo, opinion_texto: desc, usu_id: usu_id, opinion_tipo: 1 })
          .then(function (result) {
            resolve(!result.err ? { comentario: { valido: '1', error: 'Se insertó correctamente' } } : { comentario: { valido: '0', error: 'Error en el servicio 325' } })
          })
      } else if (arraydesencryptar[0] == 326) {
        const usu_id = arraydesencryptar[1]
        const titulo = arraydesencryptar[2]
        const desc = arraydesencryptar[3]
        UsuarioModel.setOpinion({ opinion_titulo: titulo, opinion_texto: desc, usu_id: usu_id, opinion_tipo: 2 })
          .then(function (result) {
            resolve(!result.err ? { comentario: { valido: '1', error: 'Se insertó correctamente' } } : { comentario: { valido: '0', error: 'Error en el servicio 326' } })
          })
      } else if (arraydesencryptar[0] == 328) {
        const cot_id = arraydesencryptar[1]
        const prod_id = arraydesencryptar[2]
        const usu_id_destino = arraydesencryptar[3]
        // Enviar PUSH al usuario destino con la cotizacion para revision
        // resolve(!result.err ? { compartir:{ valido: "1", error: "Se envió correctamente"}} : { compartir:{ valido: "0", error: "Error en el servicio 328" }})
        resolve({ compartir: { valido: '1', error: 'Se envió correctamente' } })
      } else if (arraydesencryptar[0] == 331) {
        const usu_id = arraydesencryptar[1]
        AlertaModel.setAlertasVisto({ usu_id: usu_id })
          .then(function (result) {
            resolve(!result.err ? { visto: { valido: '1', error: 'Se actualizó correctamente' } } : { visto: { valido: '0', error: 'Error en el servicio 331' } })
          })
      } else if (arraydesencryptar[0] == 332) {
        const usu_id = arraydesencryptar[1]
        const emp_id = arraydesencryptar[2]
        const calif = arraydesencryptar[3]
        const calif_desc = arraydesencryptar[4]
        EmpresaModel.addCalificacionEmpresa({ usu_id: usu_id, emp_id: emp_id, calif: calif, calif_desc: calif_desc })
          .then(function (result) {
            const resultado = JSON.stringify(result.result[1])
            if (JSON.parse(resultado)[0].valido == 1) { resolve({ calificar: { valido: '1', error: 'Se guardó correctamente' } }) } else { resolve({ calificar: { calificar: '0', error: 'No puedes calificar dos veces a la empresa' } }) }
          })
      }
    }
  })
}
