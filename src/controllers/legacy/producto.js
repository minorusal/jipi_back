
'use strict'

const ProductoModel = require('../../models/legacy/producto')
const uploadImageS3 = require('../../utils/uploadImageS3')
const S3 = require('../../utils/uploadImageS3')

module.exports = {
  getProducto: getProducto,
  getProductoByID: getProductoByID,
  AddProducto: AddProducto,
  UpdateProducto: UpdateProducto,
  BuscadorProducto: BuscadorProducto,
  getProductoDetalle: getProductoDetalle,
  BuscadorProductoEmpresa: BuscadorProductoEmpresa,
  DeleteProducto: DeleteProducto,
  getProductoFoto: getProductoFoto,
  DeleteImageProducto: DeleteImageProducto,
  subirFotoProducto
}

async function subirFotoProducto (req, res, next) {
  const { prod_id } = req.params
  const { imagen } = req.body

  const sqlErr = []
  const photos = []
  
  const errMsg = { status: 0, descripcion: 'Fallo  la carga de imagen ' }
  if (!imagen) return res.json(errMsg)
  
  const location = await S3.uploadImage2(imagen, 'fotoProducto')
  const { err } = await ProductoModel.uploadProductoRequiere({ prod_id, foto_url: location })
  photos.push(location)
  sqlErr.push(err)

 
  const isErr = sqlErr.find(e => true)
  if (isErr) return res.json(errMsg)

  return res.json({
    status: 1,
    descripcion: 'Las imagenes se han subido correctamente',
    foto_url: photos,
    prod_id
  })
}

function getProducto () {
  return new Promise(function (resolve, reject) {
    ProductoModel.getProducto()
      .then(function (result) {
        resolve(!result.err ? { valido: 1, productos: result.result } : { valido: 0, err: 'Error en obtener Paises' })
      })
  })
}

function getProductoByID (prod_id) {
  return new Promise(function (resolve, reject) {
    ProductoModel.getProductoByID(prod_id)
      .then(function (result) {
        resolve(!result.err ? { valido: 1, producto: result.result } : { valido: 0, err: 'Error en obtener Pais' })
      })
  })
}

function AddProducto (producto) {
  return new Promise(function (resolve, reject) {
    let prod_nuevo = '0'
    let prod_clearence = '0'
    let idioma_id_trad = 0
    if (producto.prod_precio_promo == '') { prod_nuevo = '1'; prod_clearence = '0' } else { prod_nuevo = '0'; prod_clearence = '1' }

    ProductoModel.AddProductoMisProductos305(producto, { prod_nuevo: prod_nuevo, prod_clearance: prod_clearence })
      .then(function (result) {
        if (!result.err) {
          ProductoModel.getidmaxProducto()
            .then(function (result) {
              if (!result.err) {
                const prod_id = result.result[0].prod_id
                producto.prod_id = prod_id
                ProductoModel.AddProductoTranslate(producto)
                  .then(function (result) {
                    if (!result.err) {
                      producto.prod_nombre = producto.prod_nombre_translate,
                      producto.prod_desc = producto.prod_desc_translate,
                      producto.prod_video = producto.prod_video_translate

                      if (producto.idioma_id == 1) {
                        idioma_id_trad = 2
                      } else {
                        idioma_id_trad = 1
                      }
                      producto.idioma_id = idioma_id_trad

                      ProductoModel.AddProductoTranslate(producto)
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
  })
}

function UpdateProducto (producto) {
  return new Promise(function (resolve, reject) {
    let idioma_id_trad = 0
    if (producto.prod_precio_promo == '') { prod_nuevo = '1'; prod_clearence = '0' } else { prod_nuevo = '0'; prod_clearence = '1' }
    ProductoModel.UpdateProducto307(producto)
      .then(function (result) {
        if (!result.err) {
          ProductoModel.UpdateProductoTranslate(producto)
            .then(function (result) {
              if (!result.err) {
                producto.prod_nombre = producto.prod_nombre_translate,
                producto.prod_desc = producto.prod_desc_translate,
                producto.prod_video = producto.prod_video_translate

                if (producto.idioma_id == 1) {
                  idioma_id_trad = 2
                } else {
                  idioma_id_trad = 1
                }
                producto.idioma_id = idioma_id_trad
                ProductoModel.UpdateProductoTranslate(producto)
                  .then(function (result) {
                    resolve(!result.err ? { prod: { valido: '1', error: 'Se actualizó correctamente', prod_id: producto.prod_id } } : { prod: { valido: '0', error: 'Error en el servicio 307' } })
                  })
              } else {
                resolve({ prod: { valido: '0', error: 'Error en el servicio 307' } })
              }
            })
        } else {
          resolve({ prod: { valido: '0', error: 'Error en el servicio 307' } })
        }
      })
  })
}

function BuscadorProducto (dato) {
  return new Promise(function (resolve, reject) {
    ProductoModel.BuscadorProducto(dato)
      .then(function (result) {
        resolve(!result.err ? { valido: 1, buscador: result.result } : { valido: 0, error: 'Son resultados err bsucador' })
      })
  })
}

function getProductoDetalle (prod_id) {
  return new Promise(function (resolve, reject) {
    let producto = ''
    let fotos = ''
    let translate = ''
    ProductoModel.getProductoByID(prod_id)
      .then(function (result) {
        producto = result.result
        if (producto.length > 0) {
          ProductoModel.getProductoTranslateByID(prod_id)
            .then(function (result) {
              translate = result.result
              if (translate.length > 0) {
                ProductoModel.getProductoFotosByID(prod_id)
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
  })
}

function BuscadorProductoEmpresa (producto) {
  return new Promise(function (resolve, reject) {
    ProductoModel.BuscadorProductoEmpresa(producto)
      .then(function (result) {
        resolve({ prod: { valido: 1, mis_productos: result.result } })
      })
  })
}

function DeleteProducto (dato) {
  return new Promise(function (resolve, reject) {
    ProductoModel.DeleteProducto306(dato)
      .then(function (result) {
        resolve(!result.err ? { prod: { valido: '1', error: 'Se eliminó correctamente', prod_id: dato.prod_id } } : { prod: { valido: '0', error: 'Error en el servicio 306 Web' } })
      })
  })
}

function getProductoFoto (prod_id) {
  return new Promise(function (resolve, reject) {
    ProductoModel.getProductoFoto(prod_id)
      .then(function (result) {
        resolve(!result.err ? { fotos_prod: { valido: '1', fotos_prod: result.result } } : { valido: '0', error: 'Error al obtener fotos producto' })
      })
  })
}

function DeleteImageProducto (datos) {
  return new Promise(function (resolve, reject) {
    ProductoModel.DeleteImageProducto(datos)
      .then(function (result) {
        resolve(!result.err ? { error: 'Se elimino Correctamente la imagen', valido: 1 } : { valido: 0, error: 'Error al eliminar imagen' })
      })
  })
}
