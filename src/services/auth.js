'use strict'
const debug = require('debug')('old-api:auth-service')
const mysqlLib = require('../lib/db')

class AuthServicesClass {
  constructor() {
    if (AuthServicesClass.instance == null) AuthServicesClass.instance = this
    return AuthServicesClass.instance
  }

  async addModulo(nombre) {
    try {
      const queryString = `INSERT INTO modulos (
      nombre
      ) 
      values (
       '${nombre}'
      )`
      const { result } = await mysqlLib.query(queryString)
      return result
    } catch (error) {
      return error
    }
  }

  async addSubModulo(submodulo) {
    const { nombre, id_modulo } = submodulo
    try {
      const queryString = `INSERT INTO submodulos (
      nombre,
      id_modulo
      ) 
      values (
       '${nombre}',
       ${id_modulo}
      )`
      const { result } = await mysqlLib.query(queryString)
      return result
    } catch (error) {
      return error
    }
  }

  async addComponente(componente) {
    const { nombre, id_submodulo } = componente
    try {
      const queryString = `INSERT INTO componentes (
      nombre,
      id_submodulo
      ) 
      values (
       '${nombre}',
       ${id_submodulo}
      )`
      const { result } = await mysqlLib.query(queryString)
      return result
    } catch (error) {
      return error
    }
  }

  async addSubComponente(componente) {
    const { nombre, id_componente } = componente
    try {
      const queryString = `INSERT INTO subcomponentes (
      nombre,
      id_componente
      ) 
      values (
       '${nombre}',
       ${id_componente}
      )`
      const { result } = await mysqlLib.query(queryString)
      return result
    } catch (error) {
      return error
    }
  }

  async addRol(rol) {
    const { nombre } = rol
    try {
      const queryString = `INSERT INTO roles (
      nombre
      ) 
      values (
       '${nombre}'
      )`
      const { result } = await mysqlLib.query(queryString)
      return result
    } catch (error) {
      return error
    }
  }


  async addRolPermiso(rol) {
    const {
      id_rol,
      id_modulo,
      id_submodulo,
      id_componente,
      id_subcomponente,
      acceso } = rol
    try {
      const queryString = `INSERT INTO roles_acceso (
      
      id_rol,
      id_modulo,
      id_submodulo,
      id_componente,
      id_subcomponente,
      acceso
      ) 
      values (
        ${id_rol},
        ${id_modulo},
        ${id_submodulo},
        ${id_componente},
        ${id_subcomponente},
        '${acceso}'
      )`
      const { result } = await mysqlLib.query(queryString)
      return result
    } catch (error) {
      return error
    }
  }

  async registerRefToken(usu, loginID, sessionId, refreshId, sessTok, refreshTok) {
    try {
      const queryString = `insert into 
      usuario_refresh_token(usu_id, urt_login_uuid, urt_sessionToken_uuid, urt_refreshToken_uuid,  urt_sessionToken, urt_refreshToken) 
      values (${usu}, '${loginID}', '${sessionId}', '${refreshId}', '${sessTok}', '${refreshTok}')`
      const { result } = await mysqlLib.query(queryString)
      return result
    } catch (error) {
      return error
    }
  }

  async deactivateByRefToken(usu, id) {
    try {
      const queryString = `update usuario_refresh_token set urt_active = false where urt_refreshToken_uuid = '${id}' and usu_id = ${usu}`
      const { result } = await mysqlLib.query(queryString)
      return result
    } catch (error) {
      return error
    }
  }

  async deactivateBySessToken(usu, id) {
    try {
      const queryString = `update usuario_refresh_token set urt_active = false where urt_sessionToken_uuid = '${id}' and usu_id = ${usu}`
      const { result } = await mysqlLib.query(queryString)
      return result
    } catch (error) {
      return error
    }
  }

  async getDataBySessTokId(id) {
    try {
      const queryString = `select urt.urt_sessionToken as urtSessionToken, urt.urt_active as urtActive from usuario_refresh_token urt where urt.urt_sessionToken_uuid = '${id}'`
      const { result } = await mysqlLib.query(queryString)
      return result
    } catch (error) {
      return error
    }
  }

  async getDataByRefTokId(id) {
    try {
      const queryString = `select urt.urt_active as urtActive from usuario_refresh_token urt where urt.urt_refreshToken_uuid = '${id}'`
      const { result } = await mysqlLib.query(queryString)
      return result
    } catch (error) {
      return error
    }
  }

  async getNuevosRegistrosSemanal() {
    try {
      const queryString = `
      SELECT
      	emp.emp_id,
      	emp.emp_rfc,
      	CONCAT(emp.emp_razon_social, ' ', cd.denominacion) AS 'emp_nombre',
      	emp.emp_fecha_creacion,
      	CASE
      		WHEN cevc.descripcion IS NULL THEN 'Sin definir'
      		ELSE cevc.descripcion
      	END AS 'tipo'
      FROM empresa AS emp
      LEFT JOIN empresa_usuario AS eu ON emp.emp_id = eu.emp_id
      LEFT JOIN cat_denominacion AS cd ON cd.id = emp.denominacion
      LEFT JOIN encuestas AS enc ON eu.usu_id = enc.usu_id
      LEFT JOIN cat_encuesta_venta_compra AS cevc ON enc.id_compras_ventas = cevc.id_cliente_credito
      WHERE emp.emp_fecha_creacion BETWEEN
            DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 17:00:00'), INTERVAL 7 DAY)
      	AND DATE_FORMAT(NOW(), '%Y-%m-%d 17:00:00')
      GROUP BY emp.emp_id, emp.emp_rfc, emp.emp_razon_social, emp.emp_fecha_creacion;
      `
      const { result } = await mysqlLib.query(queryString)
      return result
    } catch (error) {
      return error
    }
  }

  async getTotalRegistros() {
    try {
      const queryString = `
      SELECT COUNT(*) AS 'total_registros' FROM empresa;
      `
      const { result } = await mysqlLib.query(queryString)
      return result
    } catch (error) {
      return error
    }
  }
}

const inst = new AuthServicesClass()
Object.freeze(inst)

module.exports = inst
