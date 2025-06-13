'use strict'
const debug = require('debug')('old-api:user-service')
const mysqlLib = require('../lib/db')

class UserService {
  constructor() {
    if (UserService.instance == null) {
      this.table = 'usuario'
      this.vendedor = 2
      this.comprador = 3
      this.admin = 1
      this.demo = 4
      UserService.instance = this
    }
    return UserService.instance
  }

  async get() {
    const columns = [
      'usu_id',
      'usu_nombre',
      'usu_app',
      'usu_puesto',
      'usu_email',
      'usu_boletin',
      'usu_foto',
      'usu_tipo',
      'usu_status',
      'usu_update'
    ]
    const queryString = `SELECT ${columns.join()} FROM usuario ORDER BY usu_id DESC`
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getUserByEmail(email) {
    const queryString = `select eu.tipo, e.emp_id, e.emp_certificada, u.* from usuario u
    join empresa_usuario eu on u.usu_id = eu.usu_id
    join empresa e on eu.emp_id = e.emp_id
    where u.usu_email = '${email}' and u.usu_status != 0`
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async updateContadorLogin(contador, usuId) {
    const queryString = `
      UPDATE usuario SET login_contador = ${contador} WHERE usu_id = ${usuId}
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getAllDataById(userId) {
    const columns = [
      'usu_id',
      'usu_nombre',
      'usu_app',
      'usu_puesto',
      'usu_email',
      'usu_boletin',
      'usu_foto',
      'usu_tipo',
      'usu_status',
      'usu_update'
    ]
    const queryString = `SELECT ${columns.join()} FROM ${this.table} WHERE usu_id = ${userId}`
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getCompanyByIdUser(usu_id) {
    const columns = [
      'e.emp_id',
      'e.emp_nombre',
      'cd.denominacion',
      'CONCAT(e.emp_razon_social, " ", cd.denominacion) AS empresa_nombre'
    ]
    const queryString = `SELECT ${columns.join()} FROM empresa AS e
    LEFT JOIN empresa_usuario AS eu ON eu.emp_id = e.emp_id
    LEFT JOIN cat_denominacion AS cd ON cd.id = e.denominacion
    WHERE eu.usu_id = '${usu_id}';`
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  /**
   * Anteriormente se recibia userId 
   * @param {*} usu_id  
   * @returns 
   */
  async getById(usu_id) {
    const columns = [
      'usu_id',
      'usu_nombre',
      'usu_app',
      'usu_puesto',
      'usu_email',
      'usu_boletin',
      'usu_foto',
      'usu_tipo',
      'usu_status',
      'usu_update',
      'token'
    ]
    const queryString = `SELECT ${columns.join()} FROM ${this.table} WHERE usu_id = '${usu_id}';`
    const { result } = await mysqlLib.query(queryString)
    return result
  }


  async getPublicacionesCB() {
    const columns = [
      'p.usuario_id',
      'p.descripcion',
      'p.video',
      'p.imagen',
      'p.empresa_id'
    ]
    const queryString = `
      SELECT ${columns.join()}
      FROM publicaciones AS p
      JOIN usuario AS u
      ON u.usu_id = p.usuario_id
      WHERE u.usu_tipo = 5;`
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getEmpresaByUserId(userId) {
    const queryString = `SELECT * FROM empresa_usuario WHERE usu_id = ${userId};`
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async update(userId, userData) {
    userData.usu_update = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const setParams = Object.keys(userData).reduce((prev, curr, index) => {
      prev += `${curr} = "${userData[curr]}"${(Object.keys(userData).length !== index + 1) ? ', ' : ''}`;
      return prev;
    }, 'SET ');
    const queryString = `UPDATE ${this.table} ${setParams} WHERE usu_id = ${userId};`;
    await mysqlLib.query(queryString);
    return this.getById(userId);
  }


  async saveCodeUser(usuId, code) {
    const queryString = `
      UPDATE usuario SET token = "${code}" WHERE usu_id = ${usuId}
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async verifyCode(user, code) {
    let queryString = `
      SELECT * FROM usuario WHERE token = "${code}" AND usu_id = ${user}
    `
    const { result: existToken } = await mysqlLib.query(queryString)
    debug(existToken)
    if (existToken === undefined || existToken.length === 0) {
      debug('existToken empty')
      return null
    }
    queryString = `
      UPDATE usuario SET usu_verificado=1,token = NULL WHERE usu_id = ${user}
    `
    await mysqlLib.query(queryString)
    return (existToken && existToken[0] && existToken[0].length !== 0)
  }

  async updateCode(user, code) {
    const queryString = `
      UPDATE usuario SET token = "${code}" WHERE usu_id = ${user}
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getByEmail(email) {
    debug('userService -> getByEmail')
    const queryString = `SELECT * FROM ${this.table} WHERE usu_email = '${email}'`
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getTokenByToken(token) {
    const queryString = `SELECT count(*) AS registros FROM usuario_token_password_reset WHERE token = '${token}' AND estatus = '0';`
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async updateTokenEstatusReset(token) {
    const queryString = `
      UPDATE usuario_token_password_reset SET estatus = '1' WHERE token = '${token}';
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async createAdminUser(user) {
    let queryString = `
    INSERT INTO ${this.table}
    (usu_nombre, usu_app, usu_email, usu_psw, usu_tipo, token, perfil_permisos_id)
    VALUES
    ('${user.nombre}', '${user.apellido}', '${user.email}', '${user.password}', ${this.admin}, '${user.token}', '1')
    `
    const { result } = await mysqlLib.query(queryString)

    queryString = `INSERT INTO usuario_telefono (usu_id, usu_phone) VALUES ('${result.insertId}' ,'${user.telefono}')`
    await mysqlLib.query(queryString)

    return result
  }

  async getEmpresaAdmin(company, user) {
    const queryString = `
      SELECT *
      FROM empresa_usuario
      WHERE emp_id = ${company}
      AND usu_id = ${user}
      AND tipo = 1
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async createUser(user, perfil) {
    try {
      debug('users -> createUser')
      const queryString = `
      INSERT INTO usuario
      (usu_nombre, usu_app, usu_puesto, usu_email, usu_psw, usu_boletin, usu_tipo, token, perfil_permisos_id)
      VALUES
      ('${user.nombre || ''}',
      '${user.apellido || ''}',
      '${user.puesto || ''}',
      '${user.email || ''}',
      '${user.password || ''}',
      ${user.boletin || 0},
      ${user.tipo || 4},
      '${user.token || ''}',
      '${perfil || ''}')
  `;

      const { result } = await mysqlLib.query(queryString)
      return result

    } catch (error) {
      console.log(error);
    }
  }

  async confirmUser(id) {
    const queryString = `
      UPDATE usuario
      SET
        estatus_registro = 'confirmado'
      WHERE usu_id = ${id}
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getJefeArea(company, tipo) {
    const queryString = `
      SELECT
        u.usu_id,
        u.usu_nombre,
        u.usu_app,
        u.usu_puesto,
        u.usu_email,
        u.usu_foto,
        u.usu_tipo,
        u.usu_status,
        u.usu_verificado
      FROM empresa_usuario AS eu
      JOIN usuario AS u
      ON u.usu_id = eu.usu_id
      WHERE emp_id = ${company}
      AND tipo = ${tipo}
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async updateUser(user) {
    const queryString = `
      UPDATE usuario
      SET
        usu_nombre = '${user.nombre}',
        usu_app = '${user.apellido}',
        usu_puesto = '${user.puesto}',
        usu_email = '${user.email}'
      WHERE usu_id = ${user.id}
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getUsersIds(users) {
    const queryString = `
      SELECT
        usu_id AS "id"
      FROM usuario
      WHERE usu_id IN (${users.join(',')})
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async updatePassword(userID, newPassword) {
    const queryString = `
      UPDATE usuario
      SET usu_psw = '${newPassword}'
      WHERE usu_id = ${userID}
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getUserPassword(user) {
    const queryString = `
      SELECT * FROM ${this.table}
      WHERE usu_id = ${user}
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getChatCompanyNotSeenMessages(user) {
    const queryString = `
      SELECT sala_uuid, count(*) as 'not_seen'
      FROM chat_empresa_salas AS ces
      JOIN chat_empresa_mensajes AS cem USING(sala_uuid)
      WHERE
      (ces.usuario_comprador = ${user}
      OR ces.usuario_vendedor = ${user})
      AND cem.visto = 0
      AND cem.usuario <> ${user}
      GROUP BY sala_uuid
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getUserAndCompanyDetailsForStatistics(user) {
    const queryString = `
      SELECT
        u.usu_tipo AS "userType",
        e.emp_id AS "userCompanyID"
      FROM usuario AS u
      JOIN empresa_usuario AS eu USING(usu_id)
      JOIN empresa AS e USING(emp_id)
      WHERE u.usu_id = ${user}
    `
    const { result: resultRaw } = await mysqlLib.query(queryString)
    const [result] = resultRaw
    return result
  }

  async getUserAndCompanyDetails(user) {
    const queryString = `
      SELECT *
      FROM usuario AS u
      JOIN empresa_usuario AS eu USING(usu_id)
      JOIN empresa AS e USING(emp_id)
      WHERE u.usu_id = ${user}
    `
    const { result: resultRaw } = await mysqlLib.query(queryString)
    const [result] = resultRaw
    return result
  }

  async makeUsr2Admin(usrId) {
    const queryString = `
    UPDATE 
      ${this.table} u, 
      empresa_usuario eu 
    SET 
      u.usu_tipo = 3, 
      eu.tipo = 1 
    WHERE u.usu_id = eu.usu_id 
    AND u.usu_id = ${usrId}
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getUserTypeById(usrId) {
    const queryString = `
    SELECT 
      u.usu_tipo, eu.tipo 
    FROM 
      usuario u,empresa_usuario eu 
    WHERE u.usu_id = eu.usu_id 
    AND u.usu_id = ${usrId}
    `
    const { result: resultRaw } = await mysqlLib.query(queryString)
    const [result] = resultRaw
    return result
  }

  async getUserPhoneByUsuId(usrId) {
    const queryString = `select ut.usu_phone from usuario_telefono ut where ut.usu_id = ${usrId}`
    const { result: resultRaw } = await mysqlLib.query(queryString)
    const [result] = resultRaw
    return result
  }

  async getById2(userId) {
    const columns = [
      'usu_id',
      'usu_nombre',
      'usu_app',
      'usu_email',
      'usu_foto'
    ]
    const queryString = `SELECT ${columns.join()} FROM ${this.table} WHERE usu_id = ${userId};`
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getUsersByIdCompanie(id_companie) {
    const columns = [
      'u.usu_id',
      'u.usu_nombre',
      'u.usu_app',
      'u.usu_email',
      'u.usu_foto',
      'u.usu_tipo',
      'u.perfil_permisos_id',
      'r.nombre AS nombre_rol',
      'pp.array_permisos',
      'pp.descripcion AS perfil',
    ]

    const queryString = `
      SELECT ${columns.join()}
      FROM ${this.table} AS u
      LEFT JOIN empresa_usuario AS eu ON eu.usu_id = u.usu_id
      LEFT JOIN roles AS r ON r.id_rol = u.usu_tipo
      LEFT JOIN perfil_permisos AS pp ON pp.id = u.perfil_permisos_id
      WHERE eu.emp_id = ${id_companie};`
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getUserById(id) {
    const columns = [
      'u.usu_id',
      'u.usu_nombre',
      'u.usu_app',
      'u.usu_email',
      'u.usu_foto',
      'u.usu_tipo',
      'r.nombre AS nombre_rol'
    ]

    const queryString = `
      SELECT ${columns.join()}
      FROM ${this.table} AS u
      LEFT JOIN empresa_usuario AS eu ON eu.usu_id = u.usu_id
      LEFT JOIN roles AS r ON r.id_rol = u.usu_tipo 
      WHERE u.usu_id = ${id};`
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async createRol(rol) {
    let queryString = `
      INSERT INTO roles
      (nombre)
      VALUES
      ('${rol.nombre}')
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async createModule(module) {
    let queryString = `
      INSERT INTO modulos
      (nombre)
      VALUES
      ('${module.nombre}')
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async createAction(action) {
    let queryString = `
      INSERT INTO acciones
      (nombre, descripcion, fk_id_modulo, id_accion_padre, id_accion_hijo)
      VALUES
      ('${action.nombre}', '${action.descripcion}', ${action.modulo}, ${action.padre}, ${action.hijo})
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getModuleById(modulo) {
    const queryString = `
      SELECT *
      FROM modulos 
      WHERE id_modulo = ${modulo}
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }
  async getCatCredito() {
    const queryString = `
      SELECT *
      FROM cat_cant_clientes_credito
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async updateCronosEmpresa(id_empesa) {
    const queryString = `
      UPDATE empresa SET cronos = 'true' WHERE emp_id = ${id_empesa}
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getCatMeGustaria() {
    const queryString = `
      SELECT *
      FROM cat_encuesta_venta_compra;`
    const { result } = await mysqlLib.query(queryString)
    return result
  }
  async getCatClientesCredito() {
    const queryString = `
      SELECT *
      FROM cat_encuesta_ventas_credito;`
    const { result } = await mysqlLib.query(queryString)
    return result
  }
  async getCatRangoVentas() {
    const queryString = `
      SELECT *
      FROM cat_encuesta_rango_ventas;`
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getSurvey(usu_id) {
    const queryString = `
    SELECT
			 CONCAT(u.usu_nombre, ' ', u.usu_app) AS nombre_completo,
			 emp.emp_phone AS telefono_empresa,
			 ut.usu_phone AS telefono_usuario,
			 eu.emp_id,
       e.usu_id,
       evco.descripcion AS me_gustaria,
       evcr.descripcion AS numero_clientes_a_credito,
       er.descripcion AS rango_ventas_credito_mensual
    FROM
        encuestas AS e
        LEFT JOIN cat_encuesta_venta_compra AS evco ON evco.id_cliente_credito = e.id_compras_ventas
        LEFT JOIN cat_encuesta_ventas_credito AS evcr ON evcr.id_compras_ventas = e.id_compras_ventas
        LEFT JOIN cat_encuesta_rango_ventas AS er ON er.id_rango_venta = e.id_rango_ventas
				LEFT JOIN usuario AS u ON u.usu_id = e.usu_id
				LEFT JOIN empresa_usuario AS eu ON eu.usu_id = e.usu_id
				LEFT JOIN empresa AS emp ON emp.emp_id = eu.emp_id
				LEFT JOIN usuario_telefono AS ut ON ut.usu_id = e.usu_id
    WHERE e.usu_id = ${usu_id};`
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async saveSurvey(usu_id, body) {
    const { id_compras_ventas, id_cliente_credito, id_rango_ventas } = body
    const queryString = `
      INSERT INTO encuestas
      (usu_id, id_compras_ventas, id_cliente_credito, id_rango_ventas)
      VALUES
      (${usu_id}, ${id_compras_ventas}, ${id_cliente_credito}, ${id_rango_ventas})
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getPermisos(id_rol) {
    const queryString = `
    SELECT
        r.id_rol,
        r.nombre AS nombre_rol,
        m.id_modulo,
        m.nombre AS nombre_modulo,
        sm.id_submodulo,
        sm.nombre AS nombre_submodulo,
        c.id_componente,
        c.nombre AS nombre_componente,
        sc.id_subcomponente,
        sc.nombre AS nombre_subcomponente,
        ra.acceso
    FROM
        roles AS r
    LEFT JOIN
        roles_acceso AS ra ON ra.id_rol = r.id_rol
    LEFT JOIN
        modulos AS m ON m.id_modulo = ra.id_modulo
    LEFT JOIN
        submodulos AS sm ON sm.id_submodulo = ra.id_submodulo
    LEFT JOIN
        componentes AS c ON c.id_componente = ra.id_componente
    LEFT JOIN
        subcomponentes AS sc ON sc.id_subcomponente = ra.id_subcomponente
    WHERE r.id_rol = ${id_rol}
    ORDER BY
        r.id_rol, m.id_modulo, sm.id_submodulo, c.id_componente, sc.id_subcomponente;`
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getModulos() {
    const queryString = `
    SELECT *
    FROM modulos
    WHERE id_modulo > 99
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async creatPermisos(emp_id, descripcion, array_permisos, info_perfil) {
    const queryString = `
    INSERT INTO perfil_permisos (emp_id, descripcion, array_permisos, info_perfil)
    VALUES (${emp_id}, ${JSON.stringify(descripcion)}, ${JSON.stringify(JSON.stringify(array_permisos))}, ${JSON.stringify(info_perfil)});
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getPerfilesPermisosByEmpresa(emp_id) {
    const queryString = `
    SELECT *
      FROM perfil_permisos
      WHERE emp_id = ${emp_id};
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  getPermisosById(id) {
    const queryString = `
    SELECT
      array_permisos
    FROM
      usuario
    WHERE id = ${id}
    `
    return mysqlLib.query(queryString)
  }

  getPermisosByEmail(email) {
    const queryString = `
    SELECT 
    	pp.array_permisos AS usu_permisos
      FROM usuario AS u
      LEFT JOIN perfil_permisos AS pp ON u.perfil_permisos_id = pp.id
      WHERE usu_email = ${JSON.stringify(email)};
    `
    return mysqlLib.query(queryString)
  }

  async updatePermisos(userId, perfil_permisos_id) {
    const queryString = `
    UPDATE usuario
    SET perfil_permisos_id = '${perfil_permisos_id}'
    WHERE usu_id = ${userId}
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async updatePerfilPermisos(id, array_permisos, descripcion, info_perfil) {
    const queryString = `
    UPDATE perfil_permisos
    SET descripcion = '${descripcion}',
        array_permisos = '${JSON.stringify(array_permisos)}',
        info_perfil = '${info_perfil}'
    WHERE id = ${id}
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getUserToken(usu_id) {
    const queryString = `
    SELECT
    token
    FROM usuario
    WHERE usu_id =  ${usu_id}`
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async changeStatus(userId, estatus) {
    const queryString = `
      UPDATE usuario SET estatus_registro = '${estatus}' WHERE usu_id = ${userId}
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async saveTokenNewPass(token, usuario) {
    const { usu_id } = usuario
    const queryString = `
      INSERT INTO usuario_token_password_reset
      (usu_id, token) VALUES(${usu_id}, '${token}')
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }


}

module.exports = Object.freeze(new UserService())
