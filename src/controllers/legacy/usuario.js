
'use strict'
const bcrypt = require('bcrypt')
const UsuarioModel = require('../../models/legacy/usuario')
const crypto = require('crypto')

const uploadImageS3 = require('../../utils/uploadImageS3')

module.exports = {
  LoginUsuario: LoginUsuario,
  GetUsuarios: GetUsuarios,
  GetMenus: GetMenus,
  UsuarioAdd: UsuarioAdd,
  UsuarioMenuAdd: UsuarioMenuAdd,
  UsuarioUpdate: UsuarioUpdate,
  ChngePw: ChngePw,
  UpdateDatos: UpdateDatos,
  UpdateMenus: UpdateMenus,
  DeleteMenus: DeleteMenus,
  GetAccesoByID: GetAccesoByID,
  getVerificaRegistro: getVerificaRegistro,
  getLoginUser: getLoginUser,
  getVerificaPassword: getVerificaPassword,
  setProductoFavorito: setProductoFavorito,
  setProductoNoFavorito: setProductoNoFavorito,
  getFavoritos: getFavoritos,
  getUsuarioByID: getUsuarioByID,
  updateUsuarioPerfilDatos: updateUsuarioPerfilDatos,
  getUsuarioEmpresa: getUsuarioEmpresa,
  subirImgPerfil
}

function subirImgPerfil (req) {
  return new Promise(function (resolve, reject) {
    const { params: { usu_id }, file } = req
    uploadImageS3(file).then(usu_foto => {
      UsuarioModel.uploadImgPerfil({ usu_id, usu_foto }).then(result => {
        if (!result.err) {
          resolve({ status: 1, descripcion: 'La imagen se subio correctamente', usu_foto, usu_id })
        } else {
          resolve({ status: 0, descripcion: 'Fallo  la carga de imagen ' })
        }
      })
    }).catch(() => {
      resolve({ status: 0, descripcion: 'Fallo  la carga de imagen ' })
    })
  })
}

function LoginUsuario (datos_usuario) {
  return new Promise(function (resolve, reject) {
    UsuarioModel.LoginUsuario(datos_usuario)
      .then(function (result) {
        if (result.result.length > 0) {
          bcrypt.compare(datos_usuario.usu_psw, result.result[0].usu_psw, function (err, res) {
            if (res == true) {
              resolve(!result.err ? { err: 'Bienvenido ' + result.result[0].usu_nombre + ' ', valido: 1, datos_usuario: result.result } : { err: 'Vulve a Intentarlo', valido: 0 })
            } else {
              resolve(!result.err ? { err: 'Contraseña o usuario Incorrecto', valido: 0 } : { err: 'Vulve a Intentarlo', valido: 1 })
            }
          })
        } else {
          resolve(!result.err ? { err: 'La cuenta No se encuentra registrada', valido: 0 } : { err: 'Vulve a Intentarlo', valido: 1 })
        }
      })
  })
}

function GetUsuarios () {
  return new Promise(function (resolve, reject) {
    UsuarioModel.GetUsuarios()
      .then(function (result) {
        resolve(!result.err ? { usuarios: result.result, valido: 1 } : { err: ' No se encontraron usuarios', valido: 0 })
      })
  })
}

function GetMenus (usu_id) {
  return new Promise(function (resolve, reject) {
    UsuarioModel.GetMenus(usu_id)
      .then(function (result) {
        resolve(!result.err ? { menus: result.result, valido: 1 } : { err: ' No se encontraron menus', valido: 0 })
      })
  })
}

function UsuarioAdd (datos) {
  return new Promise(function (resolve, reject) {
    UsuarioModel.GetUsuByGpid({ usu_gpid: datos.usu_gpid, usu_correo: datos.usu_correo })
      .then(function (result) {
        if (result.result.length > 1) {
          resolve(!result.err ? { err: 'El Gpid o correo ya estan en uso', valido: 0 } : { err: ' No se encontraron usuarios', valido: 1 })
        } else {
          const saltRounds = 10

          bcrypt.genSalt(saltRounds, function (errSalt, salt) {
            if (errSalt) return res.status(200).send({ message: 'Error no se pudo generar la contraseña (bcrypt) salt' })
            bcrypt.hash(datos.usu_psw, salt, async function (errHash, hash) {
              if (errHash) return res.status(200).send({ message: 'Error no se pudo generar la contraseña (bcrypt) hash' })
              datos.usu_psw = hash
              UsuarioModel.UsuarioAdd(datos)
                .then(function (result) {
                  if (!result.err) {
                    UsuarioModel.MaxUsuId()
                      .then(function (result) {
                        datos.usu_id = result.result[0].usu_id
                        const usu_id = result.result[0].usu_id
                        resolve(!result.err ? { usu_id: usu_id, usuario: datos, err: 'Se guardo correctamente el usuario', valido: 1 } : { err: ' No se encontraron usuarios', valido: 0 })
                      })
                  }
                })
            })
          })
        }
      })
  })
}

function UsuarioMenuAdd (datos) {
  return new Promise(function (resolve, reject) {
    UsuarioModel.UsuarioMenuAdd(datos)
      .then(function (result) {
        resolve(!result.err ? { usuarios: result.result, valido: 1 } : { err: ' No se encontraron usuarios', valido: 0 })
      })
  })
}

function UsuarioUpdate (datos) {
  return new Promise(function (resolve, reject) {
    UsuarioModel.UsuarioUpdate(datos)
      .then(function (result) {
        resolve(!result.err ? { err: 'Usuario Eliminado', valido: 1 } : { err: 'no se pudo actualizar', valido: 0 })
      })
  })
}

function ChngePw (datos) {
  return new Promise(function (resolve, reject) {
    const saltRounds = 10

    bcrypt.genSalt(saltRounds, function (errSalt, salt) {
      if (errSalt) return res.status(200).send({ message: 'Error no se pudo generar la contraseña (bcrypt) salt' })
      bcrypt.hash(datos.usu_psw, salt, async function (errHash, hash) {
        if (errHash) return res.status(200).send({ message: 'Error no se pudo generar la contraseña (bcrypt) hash' })
        datos.usu_psw = hash
        UsuarioModel.ChngePw(datos)
          .then(function (result) {
            resolve(!result.err ? { err: 'La contraseña se ha actualizado Correctamente', valido: 1 } : { err: 'no se pudo actualizar', valido: 0 })
          })
      })
    })
  })
}

function UpdateDatos (datos) {
  return new Promise(function (resolve, reject) {
    UsuarioModel.GetUsuByGpidandUsuId({ usu_gpid: datos.usu_gpid, usu_correo: datos.usu_correo, usu_id: datos.usu_id })
      .then(function (result) {
        if (result.result.length == 0) {
          resolve(!result.err ? { err: 'El Gpid o correo ya estan en uso', valido: 0 } : { err: ' No se encontraron usuarios', valido: 1 })
        } else {
          UsuarioModel.UserByID(datos)
            .then(function (result) {
              if (!result.err) {
                const usu_psw = result.result[0].usu_psw
                if (usu_psw == datos.usu_psw) {
                  UsuarioModel.UpdateDatosUsuario(datos)
                    .then(function (result) {
                      resolve(!result.err ? { datos: datos, err: 'Se ha actualizado los datos', valido: 1 } : { err: 'no se pudo actualizar', valido: 0 })
                    })
                } else {
                  const saltRounds = 10

                  bcrypt.genSalt(saltRounds, function (errSalt, salt) {
                    if (errSalt) return res.status(200).send({ message: 'Error no se pudo generar la contraseña (bcrypt) salt' })
                    bcrypt.hash(datos.usu_psw, salt, async function (errHash, hash) {
                      if (errHash) return res.status(200).send({ message: 'Error no se pudo generar la contraseña (bcrypt) hash' })
                      datos.usu_psw = hash
                      UsuarioModel.UpdateDatosUsuario(datos)
                        .then(function (result) {
                          resolve(!result.err ? { datos: datos, err: 'Se ha actualizado los datos', valido: 1 } : { err: 'no se pudo actualizar', valido: 0 })
                        })
                    })
                  })
                }
              }
            })
        }
      })
  })
}

function UpdateMenus (datos) {
  return new Promise(function (resolve, reject) {
    UsuarioModel.UsuarioMenuAdd(datos)
      .then(function (result) {
        resolve(!result.err ? { datos: datos, err: 'Se ha actualizado los datos', valido: 1 } : { err: 'no se pudo actualizar', valido: 0 })
      })
  })
}

function DeleteMenus (datos) {
  return new Promise(function (resolve, reject) {
    const usu_id = datos.usu_id
    UsuarioModel.DeleteMenu({ usu_id: usu_id })
      .then(function (result) {
        resolve(!result.err ? { datos: datos, err: 'Se ha actualizado los datos', valido: 1 } : { err: 'no se pudo actualizar', valido: 0 })
      })
  })
}

function GetAccesoByID (usu_id) {
  return new Promise(function (resolve, reject) {
    UsuarioModel.GetAccesoByID(usu_id)
      .then(function (result) {
        resolve(!result.err ? { valido: 1, permisos: result.result } : { err: 'Error en Accessos' })
      })
  })
}

function getVerificaRegistro (registro) {
  return new Promise(function (resolve, reject) {
    try {
      var decrypt_id = decrypt(registro.usu_id).toString('utf8')
      function decrypt (usu_id) {
        const algorithm = 'aes-256-ctr'
        const secretKey = '6d7956657279546f'
        const decipher = crypto.createDecipher(algorithm, secretKey)
        let dec = decipher.update(usu_id, 'hex', 'utf8')
        dec += decipher.final('utf8')
        return dec
      }
    } catch (e) {
      resolve({ valido: 0, error: 'Tu codigo es invalido' })
    }
    registro.usu_id = decrypt_id
    UsuarioModel.getVerificaCodigoUsuario(registro)
      .then(function (result) {
        if (result.result.length > 0) {
          if (result.result[0].usu_verificado == 0) {
            const usu_nom = result.result[0].usu_nom
            UsuarioModel.Activar_Cuenta(registro)
              .then(function (result) {
                resolve({ valido: 1, error: 'Su Cuenta ha sido Activada', usuario: usu_nom })
              })
          } else {
            resolve({ valido: 1, error: 'Su cuenta ya esta activada' })
          }
        } else {
          resolve({ valido: 0, error: 'Su codigo es Invalido' })
        }
      })
  })
}

function getVerificaPassword (datos) {
  return new Promise(function (resolve, reject) {
    try {
      var decrypt_id = decrypt(datos.usu_id).toString('utf8')
      function decrypt (usu_id) {
        const algorithm = 'aes-256-ctr'
        const secretKey = '6d7956657279546f'
        const decipher = crypto.createDecipher(algorithm, secretKey)
        let dec = decipher.update(usu_id, 'hex', 'utf8')
        dec += decipher.final('utf8')
        return dec
      }
    } catch (e) {
      resolve({ valido: 0, error: 'Tu codigo es invalido' })
    }
    datos.usu_id = decrypt_id
    UsuarioModel.getVerificaCodigoUsuario(datos)
      .then(function (result) {
        if (result.result.length > 0) {
          const saltRounds = 10

          bcrypt.genSalt(saltRounds, function (errSalt, salt) {
            if (errSalt) return res.status(200).send({ message: 'Error no se pudo generar la contraseña (bcrypt) salt' })
            bcrypt.hash(datos.usu_pw, salt, async function (errHash, hash) {
              if (errHash) return res.status(200).send({ message: 'Error no se pudo generar la contraseña (bcrypt) hash' })
              datos.usu_pw = hash

              UsuarioModel.UpdatePwUser(datos)
                .then(function (result) {
                  resolve({ valido: 1, error: 'Su contraseña ha sido actualizada' })
                })
            })
          })
        } else {
          resolve({ valido: 0, error: 'Codigo Invalido' })
        }
      })
  })
}
function getLoginUser (datos_login) {
  return new Promise(function (resolve, reject) {
    UsuarioModel.getUsuarioByMail(datos_login)
      .then(function (result) {
        if (result.result.length > 0) {
          bcrypt.compare(datos_login.usu_psw, result.result[0].usu_psw, function (err, res) {
            if (res == true) {
              resolve({ login: { valido: '1', error: 'Accesso Correctos', usu: result.result[0] } })
            } else {
              resolve({ login: { valido: '0', error: 'Datos Incorrectos', usu: '' } })
            }
          })
        } else {
          resolve({ login: { valido: '0', error: 'No se encuentra registrado el correo' } })
        }
      })
  })
}

function setProductoFavorito (datos) {
  const prod_id = datos.prod_id
  const usu_id = datos.usu_id

  return new Promise(function (resolve, reject) {
    UsuarioModel.AccionFavorito({ prod_id: prod_id, usu_id: usu_id, accion: '1' })
      .then(function (result) {
        resolve(!result.err ? { favorito: { valido: '1', error: 'Funcion ejecutada correctamente' } } : { favorito: { valido: '0', error: 'Error al insertar el favorito' } })
      })
  })
}

function setProductoNoFavorito (datos) {
  const prod_id = datos.prod_id
  const usu_id = datos.usu_id

  return new Promise(function (resolve, reject) {
    UsuarioModel.AccionFavorito({ prod_id: prod_id, usu_id: usu_id, accion: '0' })
      .then(function (result) {
        resolve(!result.err ? { favorito: { valido: '1', error: 'Funcion ejecutada correctamente' } } : { favorito: { valido: '0', error: 'Error al insertar el favorito' } })
      })
  })
}

function getFavoritos (usuario) {
  const usu_id = usuario.usu_id
  const idioma_id = usuario.idioma_id
  return new Promise(function (resolve, reject) {
    UsuarioModel.getFavoritosByUsuID({ usu_id: usu_id, idioma_id: idioma_id })
      .then(function (result) {
        resolve(!result.err ? { favorito: result.result, valido: 1 } : { favorito: { valido: '0', error: 'Error al insertar el favorito' } })
      })
  })
}

function getUsuarioByID (usu_id) {
  return new Promise(function (resolve, reject) {
    UsuarioModel.getUsuarioByID(usu_id)
      .then(function (result) {
        resolve(!result.err ? { valido: 1, usuario: result.result } : { error: 'Error al consultar usuario perfil ', valido: 0 })
      })
  })
}

function updateUsuarioPerfilDatos (datos_usuario) {
  return new Promise(function (resolve, reject) {
    UsuarioModel.getUsuarioByID({ usu_id: datos_usuario.usu_id })
      .then(function (result) {
        if (!result.err) {
          const usu_psw = result.result[0].usu_psw
          if (usu_psw == datos_usuario.usu_psw) {
            UsuarioModel.updateUsuarioPerfilDatos(datos_usuario)
              .then(function (result) {
                resolve(!result.err ? { valido: 1, error: 'Se ha actulizado Correctamente', usuario: datos_usuario } : { valido: 0, error: 'Error al actualizar' })
              })
          } else {
            const saltRounds = 10

            bcrypt.genSalt(saltRounds, function (errSalt, salt) {
              if (errSalt) return res.status(200).send({ message: 'Error no se pudo generar la contraseña (bcrypt) salt' })
              bcrypt.hash(datos_usuario.usu_psw, salt, async function (errHash, hash) {
                if (errHash) return res.status(200).send({ message: 'Error no se pudo generar la contraseña (bcrypt) hash' })
                datos_usuario.usu_psw = hash
                UsuarioModel.updateUsuarioPerfilDatos(datos_usuario)
                  .then(function (result) {
                    resolve(!result.err ? { valido: 1, error: 'Se ha actulizado Correctamente', usuario: datos_usuario } : { valido: 0, error: 'Error al actualizar' })
                  })
              })
            })
          }
        }
      })
  })
}

function getUsuarioEmpresa (usu_id) {
  return new Promise(function (resolve, reject) {
    UsuarioModel.getUsuarioEmpresa(usu_id)
      .then(function (result) {
        resolve(!result.err ? { valido: 1, usuario_empresa: result.result } : { error: 'Error al consultar usuario perfil ', valido: 0 })
      })
  })
}
