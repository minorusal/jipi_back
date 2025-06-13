'use strict'
const UsuarioModel = require('../../models/legacy/usuario')
module.exports = {
  getNetworks: getNetworks,
  getNetwork: getNetwork,
  AddNetwork: AddNetwork,
  DeleteNetwork: DeleteNetwork,
  GetBuscadorNetwork: GetBuscadorNetwork,
  GetFiendsNetwork: GetFiendsNetwork,
  GetAddUserNetwork: GetAddUserNetwork

}

function getNetworks () {
  return new Promise(function (resolve, reject) {
    NetworkModel.getNetworks()
      .then(function (result) {
        resolve(!result.err ? { valido: 1, networks: result.result } : reject({ error: 'no se pudo traer network', valido: 0 }))
      })
  })
}
function getNetwork (usu_id) {
  return new Promise(function (resolve, reject) {
    UsuarioModel.getNetworkingByType({ usu_id: usu_id.usu_id, net_tipo: '1', net_status: '1' })
      .then(function (result) {
        const clientes = result.result
        UsuarioModel.getNetworkingByType({ usu_id: usu_id.usu_id, net_tipo: '2', net_status: '1' })
          .then(function (result) {
            const proveedores = result.result
            UsuarioModel.getNetworkingByType({ usu_id: usu_id.usu_id, net_tipo: '1,2', net_status: '2' })
              .then(function (result) {
                const invitaciones = result.result
                resolve({ clientes: clientes, proveedores: proveedores, invitaciones: invitaciones })
              })
          })
      })
  })
}
function AddNetwork (datos) {
  return new Promise(function (resolve, reject) {
    UsuarioModel.checkNetwokring(datos)
      .then(function (result) {
        if (!result.err) {
          if (result.result[0].cuantos == '0') {
            UsuarioModel.addNetworking(datos)
              .then(function (result) {
                resolve(!result.err ? { invitacion: { valido: '1', error: 'Se agrego correctamente el contacto' } } : { invitacion: { valido: '0', error: 'Error en el servicio 320' } })
              })
          } else {
            resolve({ invitacion: { valido: '0', error: 'Networking ya agregado' } })
          }
        } else {
          resolve({ invitacion: { valido: '0', error: 'Error, al consultar' } })
        }
      })
  })
}

function DeleteNetwork (datos) {
  return new Promise(function (resolve, reject) {
    NetworkModel.DeleteNetwork(datos)
      .then(function (result) {
        resolve(!result.err ? { valido: 1, datos: datos, error: 'Se elimino correctamente de su red' } : reject({ valido: 0, error: 'No se pudo elimianr de su red' }))
      })
  })
}

function GetBuscadorNetwork (nombre) {
  return new Promise(function (resolve, reject) {
    let busca = nombre
    busca = busca.nombre.replace(/ /gi, '%')
    UsuarioModel.getUsuarioBySearch({ busca: busca })
      .then(function (result) {
        const busca = result.result

        resolve({ buscador: busca })
      })
  })
}

function GetFiendsNetwork (usu_id) {
  return new Promise(function (resolve, reject) {
    UsuarioModel.GetFiendsNetwork({ usu_id_origen: usu_id.usu_id })
      .then(function (result) {
        resolve(!result.err ? { valido: 1, amigos: result.result } : { valido: 0, error: 'No se pudo consultar' })
      })
  })
}

function GetAddUserNetwork (datos) {
  return new Promise(function (resolve, reject) {
    UsuarioModel.uploadNetworkingUsuID(datos)
      .then(function (result) {
        resolve(!result.err ? { invitacion: { valido: '1', error: 'Se agrego correctamente el contacto' } } : { invitacion: { valido: '0', error: 'Error en el servicio 320' } })
      })
  })
}
