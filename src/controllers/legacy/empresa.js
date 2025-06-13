'use strict'

const EmpresaModel = require('../../models/legacy/empresa')
const uploadImageS3 = require('../../utils/uploadImageS3')
const companiesService = require('../../services/companies')

module.exports = {
  getEmpresas: getEmpresas,
  GetImagenesEmpresa: GetImagenesEmpresa,
  GetEmpresaConsultarByID: GetEmpresaConsultarByID,
  DeleteImgCaruselEmpresaPerfil: DeleteImgCaruselEmpresaPerfil,
  getPublicacionesByEmpresa: getPublicacionesByEmpresa,
  getEmpresaContadores: getEmpresaContadores,
  getEmpresaVideobyID: getEmpresaVideobyID,
  DeleteVideo: DeleteVideo,
  subirLogoDeEmpresa,
  subirBannerDeEmpresa
}

async function subirBannerDeEmpresa(req, res, next) {
  try {
    const { emp_id,  imagen} = req.body
    const errMsg = { empresa: { valido: '0', error: 'Fallo  la carga de imagen' } }

    if (!imagen) return res.json(errMsg)

    const photos = []
    const sqlErr = []

    const location = await uploadImageS3.uploadImage2(imagen, 'bannerEmpresa')
    const { err } = await EmpresaModel.uploadEmpresaRequiere({ emp_id, ef_url: location })
    photos.push(location)
    sqlErr.push(err)

    const isErr = sqlErr.find(e => true)
    if (isErr) return res.json(errMsg)

    return res.json({
      empresa: {
        valido: '1',
        error: 'Las imagenes se subieron correctamente',
        foto_url: photos,
        emp_id
      }
    })

  } catch (error) {
    console.log(error);
    res.status(500).json.json({
      empresa: {
        error: '0',
        error: 'Fallo la carga de las imagenes',
      }
    })
  }
}

async function subirLogoDeEmpresa(req) {
  try {
    const { imagen } = req.body;
    const { params: { emp_id } } = req

    if (!imagen) return next(boom.badRequest('Empty imagen'))

    if (imagen) {
      const pathBucket = 'logoEmpresa';
      const Location = await uploadImageS3.uploadImage2(imagen, pathBucket)
      await EmpresaModel.uploadLogoEmpresaRequiere(emp_id, Location)
    }

    const uploadImagen = await companiesService.getEmpresa(emp_id)

    return uploadImagen
  } catch (err) {
    return { error: true }
  }
}

function getEmpresas() {
  return new Promise(function (resolve, reject) {
    EmpresaModel.getEmpresas()
      .then(function (result) {
        resolve(!result.err ? { valido: 1, empresas: result.result } : { valido: 0, err: 'Error al consultar empresas' })
      })
  })
}

function GetImagenesEmpresa(datos) {
  return new Promise(function (resolve, reject) {
    EmpresaModel.getEmpresaByIDIdioma(datos)
      .then(function (result) {
        const empresa = result.result
        EmpresaModel.getEmpresaTranslateByID(datos)
          .then(function (result) {
            const translates = result.result
            EmpresaModel.getEmpresaFotoByID(datos)
              .then(function (result) {
                const fotos = result.result
                EmpresaModel.getEmpresaVideosByID(datos)
                  .then(function (result) {
                    const videos = result.result
                    resolve(!result.err ? { empresa: empresa, translates: translates, fotos: fotos, videos: videos } : { empresa: { valido: 0, error: 'Error al buscar la empresa' } })
                  })
              })
          })
      })
  })
}

function getPublicacionesByEmpresa(emp_id, usu_id) {
  return new Promise(function (resolve, reject) {
    EmpresaModel.getPublicacionEmpresa({ emp_id: emp_id, usu_id: usu_id })
      .then(function (result) {
        const publicaciones = result.result
        resolve(!result.err ? { publicacion: publicaciones } : { publicacion: { valido: 0, error: 'Error al buscar publicaciones' } })
      })
  })
}

function GetEmpresaConsultarByID(emp_id) {
  return new Promise(function (resolve, reject) {
    EmpresaModel.getEmpresaByID(emp_id)
      .then(function (result) {
        const empresa = result.result
        EmpresaModel.getEmpresaTranslateByID(emp_id)
          .then(function (result) {
            const translates = result.result
            EmpresaModel.getEmpresaFotoByID(emp_id)
              .then(function (result) {
                const fotos = result.result
                EmpresaModel.getEmpresaVideosByID(emp_id)
                  .then(function (result) {
                    const videos = result.result
                    EmpresaModel.getEmpresaExportaByID(emp_id)
                      .then(function (result) {
                        const exporta = result.result
                        EmpresaModel.getEmpresaEstadosByID(emp_id)
                          .then(function (result) {
                            const estados = result.result
                            EmpresaModel.getIndustria({ cind_id: empresa[0].cind_id })
                              .then(function (result) {
                                const industria = result.result
                                EmpresaModel.NumeroEmpleados(emp_id)
                                  .then(function (result) {
                                    const numero_empleados = result.result[0].numero_empleado
                                    EmpresaModel.Productos(emp_id)
                                      .then(function (result) {
                                        const productos = result.result
                                        EmpresaModel.getImagenPublicaciones(emp_id)
                                          .then(function (result) {
                                            const publicaciones = result.result
                                            EmpresaModel.getImagenProducto(emp_id)
                                              .then(function (result) {
                                                const productos_foto = result.result
                                                resolve(!result.err ? { productos_foto: productos_foto, empresa: empresa, translates: translates, fotos: fotos, videos: videos, exporta: exporta, estados: estados, publicaciones: publicaciones, industria: industria, numero_empleados: numero_empleados, productos: productos } : { empresa: { valido: 0, error: 'Error al buscar la empresa' } })
                                              })
                                          })
                                      })
                                  })
                              })
                          })
                      })
                  })
              })
          })
      })
  })
}

function DeleteImgCaruselEmpresaPerfil(ef_id) {
  return new Promise(function (resolve, reject) {
    EmpresaModel.DeleteImgCaruselEmpresaPerfil(ef_id)
      .then(function (result) {
        resolve(!result.err ? { valido: 1, error: 'Se ha eliminado correctamente' } : { valido: 0, error: 'No se ha podido eliminar la imagen' })
      })
  })
}

function getEmpresaContadores(emp_id) {
  return new Promise(function (resolve, reject) {
    EmpresaModel.getEmpresaContadores(emp_id)
      .then(function (result) {
        resolve(!result.err ? { valido: 1, contadores: result.result, error: '' } : { valido: 0, error: 'No se ha podido buscar contadores' })
      })
  })
}

function getEmpresaVideobyID(emp_id) {
  return new Promise(function (resolve, reject) {
    EmpresaModel.getEmpresaVideobyID(emp_id)
      .then(function (result) {
        if (!result.err) {
          resolve({ valido: 1, videos: result.result })
        } else {
          reject({ valido: 0, error: 'getEmpresaVideobyID' })
        }
      })
  })
}

function DeleteVideo(datos_video) {
  return new Promise(function (resolve, reject) {
    EmpresaModel.DeleteVideo(datos_video)
      .then(function (result) {
        if (!result.err) {
          resolve({ valido: 1, error: 'Se elimino correctamente el video' })
        } else {
          reject({ valido: 0, error: 'getEmpresaVideobyID' })
        }
      })
  })
}
