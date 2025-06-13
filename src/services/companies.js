'use strict'
const debug = require('debug')('old-api:companies-service')
const mysqlLib = require('../lib/db')
const limitQueryRange = require('../utils/limit')

class CompaniesService {
  constructor() {
    if (CompaniesService.instance == null) {
      this.table = 'empresa'
      CompaniesService.instance = this
    }
    return CompaniesService.instance
  }

  async getEmpresas() {
    debug('companies->getEmpresas')

    const queryString = `
    SELECT
      e.*,
      h.horario_id,
      h.lunes_apertura, h.lunes_cierre, h.martes_apertura, h.martes_cierre,
      h.miercoles_apertura, h.miercoles_cierre, h.jueves_apertura, h.jueves_cierre,
      h.viernes_apertura, h.viernes_cierre, h.sabado_apertura, h.sabado_cierre,
      h.domingo_apertura, h.domingo_cierre
    FROM empresa AS e
    LEFT JOIN horario AS h
    ON h.emp_id = e.emp_id
    ORDER BY e.emp_id DESC LIMIT 13
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getUserEmailByIdEmpresa(id_empresa) {
    const queryString = `
      SELECT u.usu_email
      FROM empresa_usuario AS eu
      LEFT JOIN usuario AS u ON u.usu_id = eu.usu_id
      WHERE eu.emp_id = ${id_empresa}
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getEmpresaById(id) {
    const queryString = `
    SELECT
        e.emp_id,
        e.emp_nombre,
        d.denominacion,
        CONCAT(e.emp_razon_social, ' ', d.denominacion) AS empresa_nombre
    FROM empresa AS e
    LEFT JOIN cat_denominacion AS d ON d.id = e.denominacion
    WHERE e.emp_id = ${id};
    ;
        `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getEmpresaByIdCertification(id_certification) {
    const queryString = `
    SELECT
        c.id_empresa,
        CONCAT(e.emp_razon_social, ' ', d.denominacion) AS empresa_nombre,
        e.emp_rfc
    FROM certification AS c
    LEFT JOIN empresa AS e ON e.emp_id = c.id_empresa
    LEFT JOIN cat_denominacion AS d ON d.id = e.denominacion
    WHERE c.id_certification = ${id_certification};
    ;
        `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getEmpresaByIdContacto(id) {
    const queryString = `
   SELECT
        crc.razon_social,
        d.denominacion,
        CONCAT(crc.razon_social, ' ', d.denominacion) AS empresa_nombre
    FROM certification_referencia_comercial AS crc
    LEFT JOIN cat_denominacion AS d ON d.id = crc.denominacion
    WHERE crc.id_certification_referencia_comercial = ${id};
    ;
        `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getEmpresa(id) {
    debug('companies->getEmpresas')

    const queryString = `
    SELECT e.*,
      e.valores AS emp_valores,
       GROUP_CONCAT(CONCAT(IFNULL(rs.nombre_red_social, ''), '-', IFNULL(rs.enlace, ''), '-', IFNULL(rs.icono, '')) SEPARATOR '|') AS redes_sociales
    FROM empresa AS e
    LEFT JOIN redes_sociales AS rs ON e.emp_id = rs.emp_id
    WHERE e.emp_id = '${id}'
    GROUP BY e.emp_id;
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async editEmpresaCertification(id, cin_id) {
    const queryString = `
          UPDATE empresa
      SET
        cin_id = '${cin_id}'
      WHERE emp_id = ${id}
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getCodigoVigente(codigo) {
    const queryString = `
    SELECT id, codigo, vigencia, valor
    FROM CODIGOS_PROMOCION
    WHERE
      codigo = '${codigo}'
      AND NOW() BETWEEN vigencia_inicial AND vigencia;
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async validaCredito(nuevaEmpresa, code) {
    const id = (typeof code === 'object' && code !== null) ? code.id : code
    const empresaId = (typeof nuevaEmpresa === 'object' && nuevaEmpresa !== null)
      ? nuevaEmpresa.insertId || nuevaEmpresa.id
      : nuevaEmpresa
    const queryString = `
    SELECT *
    FROM CREDITOS_PLATAFORMA
    WHERE
      id_codigo = ${id}
      AND id_empresa = ${empresaId};
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async validaAsignacion(codigo, empresaId) {
    const queryString = `
    SELECT CP.codigo
    FROM CODIGOS_PROMOCION as CP
    LEFT JOIN CREDITOS_PLATAFORMA AS CPL ON CPL.id_codigo = CP.id
    WHERE
      CP.codigo = '${codigo}'
      AND CPL.id_empresa = ${empresaId};
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async asignaCodigo(id_codigo, id_empresa, valor) {
    const queryString = `
    INSERT INTO CREDITOS_PLATAFORMA
    (
    id_codigo,
    id_empresa,
    vigencia,
    valor_vigente
    )
    VALUES (
    ${id_codigo},
    ${id_empresa},
    DATE_ADD(NOW(), INTERVAL 90 DAY),
    ${valor}
    );
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async saveCredito(nuevaEmpresa, code) {
    const { id, valor } = code
    const empresaId = (typeof nuevaEmpresa === 'object' && nuevaEmpresa !== null)
      ? nuevaEmpresa.insertId || nuevaEmpresa.id
      : nuevaEmpresa
    const queryString = `
    INSERT INTO CREDITOS_PLATAFORMA
    (
    id_codigo,
    id_empresa,
    vigencia,
    valor_vigente
    )
    VALUES (
    ${id},
    ${empresaId},
    DATE_ADD(NOW(), INTERVAL 90 DAY),
    ${valor}
    );
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getUsuarioEmpresa(usuario_id, empresa_id) {
    const queryString = `
    SELECT u.*, e.*
    FROM usuario u
    JOIN empresa_usuario eu ON u.usu_id = eu.usu_id
    JOIN empresa e ON eu.emp_id = e.emp_id
    WHERE eu.emp_id = ${empresa_id} AND u.usu_id = ${usuario_id};

    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getEmpresasGeneral(text, page = 1, pageSize = 10) {
    const offset = (page - 1) * pageSize
    const queryString = `
      SELECT
            e.emp_id,
            e.emp_razon_social,
            e.emp_nombre,
            e.emp_rfc,
            e.emp_logo,
            e.emp_phone,
            e.emp_video,
            e.emp_banner,
            e.emp_website,
            e.emp_empleados,
            cd.denominacion
        FROM empresa e
        LEFT JOIN cat_denominacion cd ON cd.id = e.denominacion
        WHERE (
            e.emp_rfc LIKE CONCAT('%', '${text}', '%') 
            OR e.emp_razon_social LIKE CONCAT('%', '${text}', '%') 
            OR e.emp_nombre LIKE CONCAT('%', '${text}', '%')
        )
        LIMIT ${pageSize} OFFSET ${offset};
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getProductosGeneral(text) {
    const queryString = `
      SELECT
        p.prod_id,
        pt.prod_nombre,
        pt.prod_desc
      FROM producto p
      LEFT JOIN producto_translate pt ON pt.prod_id = p.prod_id
      WHERE pt.prod_nombre LIKE CONCAT('%', '${text}', '%') OR pt.prod_desc LIKE CONCAT('%', '${text}', '%');
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getProductosByEmpresaId(emp_id, text, page = 1, pageSize = 10) {
    const offset = (page - 1) * pageSize;
    const queryString = `
        SELECT
            p.emp_id,
            p.prod_id,
            pt.prod_nombre,
            pt.prod_desc
        FROM producto p
        LEFT JOIN producto_translate pt ON pt.prod_id = p.prod_id
        WHERE pt.idioma_id = 1 
          AND p.emp_id = ${emp_id}
          AND (pt.prod_nombre LIKE CONCAT('%', '${text}', '%') 
              OR pt.prod_desc LIKE CONCAT('%', '${text}', '%'))
        LIMIT ${pageSize} OFFSET ${offset};
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getProductosGeneralSearch(text, page = 1, pageSize = 10) {
    const offset = (page - 1) * pageSize;
    const queryString = `
        SELECT
            p.emp_id,
            p.prod_id,
            pt.prod_nombre,
            pt.prod_desc
        FROM producto p
        LEFT JOIN producto_translate pt ON pt.prod_id = p.prod_id
        WHERE pt.idioma_id = 1
          AND (pt.prod_nombre LIKE CONCAT('%', '${text}', '%') 
              OR pt.prod_desc LIKE CONCAT('%', '${text}', '%'))
        LIMIT ${pageSize} OFFSET ${offset};
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }


  async getUsuariosByGeneralSearch(text, page = 1, pageSize = 10) {
    const offset = (page - 1) * pageSize;
    const queryString = `
      SELECT
          eu.emp_id,
          u.usu_nombre,
          u.usu_app,
          u.usu_puesto,
          u.usu_email
      FROM usuario u
      LEFT JOIN empresa_usuario eu ON eu.usu_id = u.usu_id
      WHERE (
          u.usu_nombre LIKE CONCAT('%', '${text}', '%') 
          OR u.usu_app LIKE CONCAT('%', '${text}', '%') 
          OR u.usu_puesto LIKE CONCAT('%', '${text}', '%') 
          OR u.usu_email LIKE CONCAT('%', '${text}', '%')
        )
      LIMIT ${pageSize} OFFSET ${offset};
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getUsuariosByEmpresaId(emp_id, text, page = 1, pageSize = 10) {
    const offset = (page - 1) * pageSize;
    const queryString = `
      SELECT
          eu.emp_id,
          u.usu_nombre,
          u.usu_app,
          u.usu_puesto,
          u.usu_email
      FROM usuario u
      LEFT JOIN empresa_usuario eu ON eu.usu_id = u.usu_id
      WHERE eu.emp_id = ${emp_id}
        AND (
          u.usu_nombre LIKE CONCAT('%', '${text}', '%') 
          OR u.usu_app LIKE CONCAT('%', '${text}', '%') 
          OR u.usu_puesto LIKE CONCAT('%', '${text}', '%') 
          OR u.usu_email LIKE CONCAT('%', '${text}', '%')
        )
      LIMIT ${pageSize} OFFSET ${offset};
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getAllTaxIds() {
    debug('companies->getAllTaxIds')

    const queryString = 'select emp_rfc from empresa'

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getAllUsers() {
    const queryString = `
    SELECT
      u.usu_id,
			CONCAT(u.usu_nombre, ' ', u.usu_app) AS usuario_nombre,
			u.usu_foto,
      u.usu_email,
			CONCAT(e.emp_razon_social, ' ',cd.denominacion) AS empresa_nombre
    FROM usuario AS u
    LEFT JOIN empresa_usuario AS eu ON eu.usu_id = u.usu_id
    LEFT JOIN empresa AS e ON e.emp_id = eu.emp_id
    LEFT JOIN cat_denominacion AS cd ON cd.id = e.denominacion;
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getUsuariosById(id_usuario) {
    const queryString = `
    SELECT
      u.usu_tipo,
			CONCAT(u.usu_nombre, ' ', u.usu_app) AS usuario_nombre,
			u.usu_foto,
      u.usu_email,
      r.nombre
    FROM usuario AS u
    LEFT JOIN roles AS r ON r.id_rol = u.usu_tipo
    WHERE usu_id = ${id_usuario};

  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getCompanyByID(id_empresa) {
    const queryString = `
    SELECT
        e.emp_id,
        e.emp_nombre,
        d.denominacion,
        CONCAT(e.emp_razon_social, ' ', d.denominacion) AS empresa_nombre
    FROM empresa AS e
    LEFT JOIN cat_denominacion AS d ON d.id = e.denominacion
    WHERE e.emp_id = ${id_empresa};

  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async searchByTaxIEqual(taxId) {
    const queryString = `
      SELECT
          e.emp_id AS ID,
          e.emp_razon_social AS razon_social,
          e.denominacion,
          e.emp_rfc AS rfc
      FROM empresa AS e
      WHERE e.emp_rfc = '${taxId}' OR e.emp_razon_social = '${taxId}';

    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async searchByTaxId(taxId) {
    const queryString = `
      SELECT
          e.emp_id AS ID,
          e.emp_razon_social AS razon_social,
          e.denominacion,
          e.emp_rfc AS rfc
      FROM empresa AS e
      WHERE e.emp_rfc LIKE CONCAT('%', '${taxId}', '%') OR e.emp_razon_social LIKE CONCAT('%', '${taxId}', '%');

    `
    const result = await mysqlLib.query(queryString)
    return result
  }

  async searchByTaxIdAll(taxId) {
    const queryString = `
      SELECT
          e.emp_id AS ID,
          e.emp_razon_social AS razon_social,
          e.denominacion,
          e.emp_rfc AS rfc
      FROM empresa AS e
      WHERE e.emp_rfc LIKE CONCAT('%', '${taxId}', '%') OR e.emp_razon_social LIKE CONCAT('%', '${taxId}', '%');

    `
    const result = await mysqlLib.query(queryString)
    return result
  }


  async addEmpresa(body) {
    debug('companies->addEmpresa')
    const { denominacion, rfc, website, telefono } = body
    const queryString = `
    INSERT INTO empresa
    (denominacion, emp_rfc, emp_phone, emp_website ${body.industria ? ', cin_id' : ''} ${body.razon_social ? ', emp_razon_social' : ''} 
    )
    VALUES ('${denominacion}', '${rfc}', '${telefono}', '${website || ''}'
    ${body.industria ? `, '${body.industria}'` : ''}
    ${body.razon_social ? `, '${body.razon_social}'` : ''}
    )
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async findRFC(rfc) {
    debug('companies->findRFC')
    const queryString = `
      SELECT * FROM ${this.table} WHERE emp_rfc = '${rfc}'
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async editEmpresa(id, body) {
    debug('companies->editEmpresa')
    const queryString = `
          UPDATE ${this.table}
      SET
        giro = '${body.giro}',
        cin_id = '${body.industria}',
        denominacion = '${body.denominacion}',
        emp_razon_social = '${body.razon_social}',
        emp_rfc = '${body.rfc}',
        emp_website = '${body.website}',
        emp_banner = '${body.banner}',
        emp_ventas_gob = ${body.ventas_gobierno},
        emp_ventas_credito = ${body.ventas_credito},
        emp_ventas_contado = ${body.ventas_contado},
        emp_loc = ${body.local},
        emp_nac = ${body.nacional},
        emp_int = ${body.internacional},
        emp_exportacion = ${body.exportacion},
        emp_credito = ${body.credito},
        emp_empleados = ${body.empleados},
        emp_fecha_fundacion = ${body.fundacion ? `'${body.fundacion}'` : `${null}`},
        proposito = '${body.proposito}',
        tipo = ${body.tipo},
        emp_marcas = '${body.marcas}',
        valores = '${body.valores}',
        anios_experiencia = '${body.anios_experiencia}'

      WHERE emp_id = ${id}
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async addEmpresaDetalles(empresa, body) {
    debug('companies->addEmpresaDetalles')
    const { descripcion, lema, mision, vision } = body
    const queryString = `
    INSERT INTO empresa_translate
    (emp_id, idioma_id, emp_desc, emp_lema, emp_mision, emp_vision)
    VALUES
    (${empresa}, 1, '${descripcion}', '${lema}', '${mision}', '${vision}')
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async editEmpresaDetalles(empresa, body) {
    debug('companies->editEmpresaDetalles')
    const { descripcion, lema, mision, vision } = body
    const queryString = `
    UPDATE empresa_translate
    SET
      emp_desc = '${descripcion}',
      emp_lema = '${lema}',
      emp_mision = '${mision}',
      emp_vision = '${vision}'
    WHERE emp_id = ${empresa}
    AND idioma_id = 1
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async addEmpresaHorario(id, body) {
    debug('companies->addEmpresaHorario')
    const queryString = `
    INSERT INTO horario
    (emp_id, lunes_apertura, lunes_cierre, martes_apertura, martes_cierre, miercoles_apertura, miercoles_cierre, jueves_apertura, jueves_cierre, viernes_apertura, viernes_cierre, sabado_apertura, sabado_cierre, domingo_apertura, domingo_cierre)
    VALUES
    ('${id}',
    '${body.lunes_apertura ? `${body.lunes_apertura}` : null}', '${body.lunes_cierre ? `${body.lunes_cierre}` : null}',
    '${body.martes_apertura ? `${body.martes_apertura}` : null}', '${body.martes_cierre ? `${body.martes_cierre}` : null}',
    '${body.miercoles_apertura ? `${body.miercoles_apertura}` : null}', '${body.miercoles_cierre ? `${body.miercoles_cierre}` : null}',
    '${body.jueves_apertura ? `${body.jueves_apertura}` : null}', '${body.jueves_cierre ? `${body.jueves_cierre}` : null}',
    '${body.viernes_apertura ? `${body.viernes_apertura}` : null}', '${body.viernes_cierre ? `${body.viernes_cierre}` : null}',
    '${body.sabado_apertura ? `${body.sabado_apertura}` : null}', '${body.sabado_cierre ? `${body.sabado_cierre}` : null}',
    '${body.domingo_apertura ? `${body.domingo_apertura}` : null}', '${body.domingo_cierre ? `${body.domingo_cierre}` : null}')
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getEmpresaHorario(empresa) {
    debug('companies->getEmpresaHorario')
    const queryString = `
      SELECT *
      FROM horario
      WHERE emp_id = ${empresa}
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async updateEmpresaHorario(id, body) {
    debug('companies->updateEmpresaHorario')
    const queryString = `
    UPDATE horario
    SET
      lunes_apertura = ${body.lunes_apertura ? `'${body.lunes_apertura}'` : null},
      lunes_cierre = ${body.lunes_cierre ? `'${body.lunes_cierre}'` : null},
      martes_apertura = ${body.martes_apertura ? `'${body.martes_apertura}'` : null},
      martes_cierre = ${body.martes_cierre ? `'${body.martes_cierre}'` : null},
      miercoles_apertura = ${body.miercoles_apertura ? `'${body.miercoles_apertura}'` : null},
      miercoles_cierre = ${body.miercoles_cierre ? `'${body.miercoles_cierre}'` : null},
      jueves_apertura = ${body.jueves_apertura ? `'${body.jueves_apertura}'` : null},
      jueves_cierre = ${body.jueves_cierre ? `'${body.jueves_cierre}'` : null},
      viernes_apertura = ${body.viernes_apertura ? `'${body.viernes_apertura}'` : null},
      viernes_cierre = ${body.viernes_cierre ? `'${body.viernes_cierre}'` : null},
      sabado_apertura = ${body.sabado_apertura ? `'${body.sabado_apertura}'` : null},
      sabado_cierre = ${body.sabado_cierre ? `'${body.sabado_cierre}'` : null},
      domingo_apertura = ${body.domingo_apertura ? `'${body.domingo_apertura}'` : null},
      domingo_cierre = ${body.domingo_cierre ? `'${body.domingo_cierre}'` : null}
    WHERE emp_id = ${id}
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getEmpresaDomicilios(empresa) {
    debug('companies->getEmpresaDomicilios')
    const queryString = `
      SELECT
        d.*,
        e.pais_id
      FROM domicilio as d
      JOIN estado AS e ON e.estado_id = d.estado_id
      WHERE emp_id = ${empresa}
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async addEmpresaDomicilio(empresa, direccion) {
    debug('companies->addEmpresaDomicilio')
    const queryString = `
      INSERT INTO domicilio
      (emp_id, estado_id, nombre, direccion, google_id)
      VALUES(${mysqlLib.escape(empresa)}, ${mysqlLib.escape(direccion.estado)}, ${mysqlLib.escape(direccion.nombre)}, ${mysqlLib.escape(direccion.direccion)}, ${mysqlLib.escape(direccion.google_id)})
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getEmpresaCorporativo(empresa) {
    debug('companies->getEmpresaCorporativo')
    const queryString = `
      SELECT *
      FROM domicilio
      WHERE emp_id = ${empresa}
      AND domicilio_tipo = 1;
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async changeEmpresaTipoDomicilio(direccion, tipo, empresa) {
    debug('companies->changeEmpresaTipoDomicilio')
    const queryString = `
      UPDATE domicilio
      SET domicilio_tipo = ${tipo}
      WHERE domicilio_id = ${direccion}
      AND emp_id = ${empresa}
      LIMIT 1
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async editEmpresaDomicilio(direccion, body, empresa) {
    debug('companies->editEmpresaDomicilio')
    const queryString = `
      UPDATE domicilio
      SET
        estado_id = '${body.estado}',
        nombre = '${body.nombre}',
        direccion = '${body.direccion}',
        google_id = '${body.google_id}',
        fecha_actualizacion = NOW()
      WHERE
      domicilio_id = ${direccion}
      AND emp_id = ${empresa}
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async deleteEmpresaDomicilio(direccion, empresa) {
    debug('companies->deleteEmpresaDomicilio')
    const queryString = `
      DELETE FROM domicilio
      WHERE
      domicilio_id = ${direccion}
      AND emp_id = ${empresa}
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getEmpresaDomicilioPertenece(empresa, direccion) {
    debug('companies->getEmpresaDomicilioPertenece')
    const queryString = `
      SELECT *
      FROM domicilio
      WHERE emp_id = ${empresa}
      AND domicilio_id = ${direccion}
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async addEmpresaDomicilioTelefono(direccion, numero) {
    debug('companies->addEmpresaDomicilioTelefono')
    const queryString = `
      INSERT INTO telefono
      (domicilio_id, numero)
      VALUES
      (${mysqlLib.escape(direccion)}, ${mysqlLib.escape(numero)})
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async deleteEmpresaDomicilioTelefono(direccion, telefono) {
    debug('companies->deleteEmpresaDomicilioTelefono')
    const queryString = `
      DELETE FROM telefono
      WHERE
        telefono_id = ${telefono}
        AND domicilio_id = ${direccion}
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async editEmpresaDomicilioTelefono(telefonoId, numero, direccionId) {
    debug('companies->editEmpresaDomicilioTelefono')
    const queryString = `
      UPDATE telefono
      SET
        numero = ${mysqlLib.escape(numero)},
        fecha_actualizacion = NOW()
      WHERE
        telefono_id = ${mysqlLib.escape(telefonoId)}
        AND domicilio_id = ${mysqlLib.escape(direccionId)}
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getEmpresaDomicilioTelefonos(direccionId) {
    debug('companies->getEmpresaDomicilioTelefonos')
    const queryString = `
      SELECT *
      FROM telefono
      WHERE domicilio_id = ${direccionId}
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async addUserToCompany(empresa, usuario, tipo) {
    debug('companies->addUserToCompany')
    const queryString = `
      INSERT INTO empresa_usuario
      (emp_id, usu_id, tipo)
      VALUES
      (${empresa}, ${usuario}, ${tipo})
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getCompanyUsersV2(empresa) {
    const queryString = `
      SELECT
        u.usu_id,
        u.usu_nombre,
        u.usu_app,
        u.usu_puesto,
        u.usu_email,
        u.usu_foto,
        u.usu_tipo
      FROM empresa_usuario AS eu
      JOIN usuario AS u
      ON u.usu_id = eu.usu_id
      JOIN cat_usuario_tipo AS cut
      ON cut.usuario_tipo_id = u.usu_tipo
      WHERE eu.emp_id = ${empresa}
      AND u.usu_verificado = 1
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getCompanyUsers(empresa) {
    debug('companies->getCompanyUsers')
    const queryString = `
      SELECT
        u.usu_id,
        u.usu_nombre,
        u.usu_app,
        u.usu_puesto,
        u.usu_email,
        u.usu_foto,
        u.usu_tipo
      FROM empresa_usuario AS eu
      JOIN usuario AS u
      ON u.usu_id = eu.usu_id
      WHERE eu.emp_id = ${empresa}
      AND u.usu_verificado = 1
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getCompanyUsers(empresa) {
    debug('companies->getCompanyUsers')
    const queryString = `
      SELECT
        u.usu_id,
        u.usu_nombre,
        u.usu_app,
        u.usu_puesto,
        u.usu_email,
        u.usu_foto,
        u.usu_tipo
      FROM empresa_usuario AS eu
      JOIN usuario AS u
      ON u.usu_id = eu.usu_id
      WHERE eu.emp_id = ${empresa}
      AND u.usu_verificado = 1
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async updateUserToCompany(empresa, usuario, tipo) {
    debug('companies->addUserToCompany')
    const queryString = `
      UPDATE empresa_usuario
      SET tipo = ${tipo}
      WHERE
        emp_id = ${empresa}
      AND usu_id = ${usuario}
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getEmpresaFotos(empresa) {
    debug('companies->getEmpresaFotos')
    const queryString = `
      SELECT *
      FROM empresa_foto
      WHERE emp_id = ${empresa}
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getEmpresaValores(empresa) {
    debug('companies->getEmpresaValores')
    const queryString = `
      SELECT *
      FROM empresa_translate
      WHERE emp_id = ${empresa}
    `
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async postCompanyInvitations(empresa, usuarios) {
    debug('companies->postCompanyInvitations')
    let values = ''
    for (let i = 0; i < usuarios.length; i++) {
      values += `(${empresa}, '${usuarios[i].nombre}', '${usuarios[i].apellido}', '${usuarios[i].email}', ${usuarios[i].tipo}),`
    }
    values = values.replace(/.$/, '')
    const queryString = `
      INSERT INTO usuario_invitacion
      (emp_id, nombre, apellido, correo, tipo)
      VALUES ${values}
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getCompanyInvitations(empresa) {
    debug('companies->getCompanyInvitations')
    const queryString = `
      SELECT *
      FROM usuario_invitacion
      WHERE emp_id = ${empresa}
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async deleteCompanyInvitations(empresa, email) {
    debug('companies->deleteCompanyInvitations')
    const queryString = `
      DELETE FROM usuario_invitacion
      WHERE emp_id = ${empresa}
      AND correo = '${email}'
      LIMIT 1
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async updateCompanyInvitations(empresa, email, usuario) {
    debug('companies->updateCompanyInvitations')
    const queryString = `
      UPDATE usuario_invitacion
      SET nombre = '${usuario.nombre}',
      apellido = '${usuario.apellido}',
      correo = '${usuario.correo}',
      tipo = ${usuario.tipo}
      WHERE emp_id = ${empresa}
      AND correo = '${email}'
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getCompanyInvitationsDetails({ nombre, apellido, correo, empresa, tipo }) {
    debug('companies->getCompanyInvitationsDetails')
    const queryString = `
      SELECT *
      FROM usuario_invitacion
      WHERE emp_id = ${empresa}
      AND nombre = '${nombre}'
      AND apellido = '${apellido}'
      AND correo = '${correo}'
      AND tipo = ${tipo}
    `
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getCompanyUsers(empresa) {
    debug('companies->getCompanyInvitationsDetails')
    const queryString = `
      SELECT
        usu_id,
        usu_nombre,
        usu_app,
        usu_puesto,
        usu_email,
        usu_foto,
        usu_tipo,
        usu_status,
        usu_verificado
      FROM usuario
      WHERE usu_id in (
        SELECT usu_id from empresa_usuario where emp_id = ${empresa}
      )
    `
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getCompanyEmployeesByType(company, type) {
    debug('companies->getCompanyEmployeesByType')
    const queryString = `
      SELECT
        u.usu_id AS 'id'
      FROM empresa_usuario AS eu
      JOIN usuario AS u
      ON u.usu_id = eu.usu_id
      WHERE eu.emp_id = ${company}
      AND u.usu_tipo = ${type}
    `
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getCompanyAdmin(company) {
    debug('companies->getCompanyAdmin')
    const queryString = `
      SELECT usu_id AS "id"
      FROM empresa_usuario
      WHERE emp_id = ${company} AND tipo = 1
    `
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async checkCompanyIsFavorite(user, company) {
    debug('companies->checkCompanyIsFavorite')
    const queryString = `
      SELECT * FROM empresa_usuario_favorito
      WHERE usu_id = ${user} AND emp_id = ${company}
    `
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async createCompanyFavorite(user, company) {
    debug('companies->createCompanyFavorite')
    const queryString = `
      INSERT INTO empresa_usuario_favorito
      (usu_id, emp_id) VALUES(${user}, ${company})
    `
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async removeCompanyFavorite(user, company) {
    debug('companies->removeCompanyFavorite')
    const queryString = `
      DELETE FROM empresa_usuario_favorito
      WHERE usu_id = ${user} AND emp_id = ${company}
      LIMIT 1
    `
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getFavoriteCompaniesByUser(user, number, page) {
    debug('companies->getFavoriteCompaniesByUser')
    const queryString = `
      SELECT
      e.*,
      euf.created_at AS "like_date"
      FROM empresa_usuario_favorito AS euf
      JOIN empresa AS e USING(emp_id)
      WHERE euf.usu_id = ${user}
      ORDER BY e.emp_nombre ASC
      LIMIT ${limitQueryRange(page, number)}
    `
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getEmpresaDomiciliosConPaises(empresa) {
    debug('companies->getEmpresaDomiciliosConPaises')
    const queryString = `
      SELECT
        p.*,
        dt.*
      FROM domicilio AS d
      JOIN estado AS e USING (estado_id)
      JOIN pais AS p USING (pais_id)
      JOIN domicilio_tipo AS dt ON d.domicilio_tipo = dt.domicilio_tipo_id
      WHERE d.emp_id = ${empresa}
      ORDER BY d.domicilio_tipo ASC
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getCompanyRatings(companyID) {
    debug('companies->getCompanyRatings')
    const queryString = `
      select
      ce.tiempo AS "calificacion_tiempo",
      ce.calidad AS "calificacion_calidad",
      ce.servicio AS "calificacion_servicio",
      ce.comentario AS "calificacion_comentario",
      ce.fecha_creacion AS "calificacion_fecha_creacion",
      u.usu_id AS "usuario_id",
      u.usu_nombre AS "usuario_nombre",
      u.usu_app AS "usuario_apellido",
      u.usu_puesto AS "usuario_puesto",
      u.usu_foto AS "usuario_foto",
      e.emp_id AS "empresa_id",
      e.emp_nombre AS "empresa_nombre",
      e.emp_rfc AS "empresa_rfc",
      e.emp_website AS "empresa_website",
      e.emp_logo AS "empresa_logo",
      e.emp_banner AS "empresa_banner",
      e.emp_certificada AS "empresa_certificada"
      from cot_experiencia as ce
      join cotizacion as c using(cot_id)
      join usuario as u on u.usu_id = c.usu_id_comprador
      join empresa as e on e.emp_id = c.emp_id_comprador
      where
      c.emp_id_vendedor = ${companyID}
      and ce.estatus = 'Activo'
      order by ce.fecha_creacion desc
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async insertCompanyVideo(companyID, video) {
    debug('companies->insertCompanyVideo')
    const queryString = `
      UPDATE ${this.table}
      SET
      emp_video = '${video}'
      WHERE emp_id = ${companyID}
    `
    const { result: { affectedRows } } = await mysqlLib.query(queryString)
    return Boolean(affectedRows)
  }

  async insertRequestOrigin(companyId, metaFrom, metaId) {
    debug('companies->insertRequestOrigin')
    const queryString = `insert into empresa_origen_registro (emp_id, meta_from, meta_id) VALUES (${companyId},'${metaFrom}',${metaId})`
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getDomicilioById(domId) {
    debug('companies->getDomicilioById')
    const queryString = `select * from domicilio where domicilio_id = ${domId}`
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async updateEstadoIdByDomicilioId(domId, edoId) {
    debug('companies->updateEstadoIdByDomicilioId')
    const queryString = `update domicilio set estado_id = ${mysqlLib.escape(Number(edoId))} where domicilio_id = ${mysqlLib.escape(Number(domId))}`
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async updateNombreByDomicilioId(domId, nombre) {
    debug('companies->updateNombreByDomicilioId')
    const queryString = `update domicilio set nombre = ${mysqlLib.escape(nombre)} where domicilio_id = ${mysqlLib.escape(Number(domId))}`
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async updateDireccionByDomicilioId(domId, dir) {
    debug('companies->updateDireccionByDomicilioId')
    const queryString = `update domicilio set direccion = ${mysqlLib.escape(dir)} where domicilio_id = ${mysqlLib.escape(Number(domId))}`
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async updateGoogleIdByDomicilioId(domId, googleId) {
    debug('companies->updateGoogleIdByDomicilioId')
    const queryString = `update domicilio set google_id = ${mysqlLib.escape(googleId)} where domicilio_id = ${mysqlLib.escape(Number(domId))}`
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getTelefonoById(telId, domId) {
    debug('companies->getTelefonoById')
    const queryString = `select * from telefono where telefono_id = ${mysqlLib.escape(Number(telId))} and domicilio_id = ${mysqlLib.escape(Number(domId))}`
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getEmpresaCliente(id_cliente) {
    debug('companies->getCliente')
    const queryString = `
      SELECT *
      FROM empresa
      WHERE emp_id = ${id_cliente}
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getProveedor(id_proveedor) {
    debug('companies->getCliente')
    const queryString = `
      SELECT *
      FROM empresa
      WHERE emp_id = ${id_proveedor}
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }
}

module.exports = Object.freeze(new CompaniesService())
