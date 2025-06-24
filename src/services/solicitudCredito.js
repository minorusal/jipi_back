'use strict'
const debug = require('debug')('old-api:industries-service')
const mysqlLib = require('../lib/db')

class SolicituCreditoService {
  constructor() {

  }

  async obtenerSaldoCodigosMayorCero(id_emp) {
    const queryString = `
    SELECT
       CPL.id,
       CPL.valor_vigente,
       CPL.vigencia AS vigencia_codigo,
       CP.vigencia_inicial,
       CP.vigencia
     FROM CREDITOS_PLATAFORMA AS CPL
     LEFT JOIN CODIGOS_PROMOCION AS CP ON CP.id = CPL.id_codigo
     WHERE CPL.id_empresa = ${id_emp}
     AND NOW() BETWEEN CPL.created_at AND DATE_ADD(CPL.created_at, INTERVAL CP.dias_uso DAY)
     AND CPL.valor_vigente > 0
     ORDER BY CP.created_at ASC;
   `;

    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async obtenerSaldoCodigos(id_emp) {
    const queryString = `
    SELECT
      CPL.valor_vigente,
      CPL.vigencia AS vigencia_codigo,
      CP.vigencia_inicial,
      CP.vigencia,
			CPL.created_at,
			DATE_ADD(CPL.created_at, INTERVAL IFNULL(CP.dias_uso, 0) DAY) AS calculated_end_date
    FROM CREDITOS_PLATAFORMA AS CPL
    LEFT JOIN CODIGOS_PROMOCION AS CP ON CP.id = CPL.id_codigo
    WHERE CPL.id_empresa = ${id_emp}
    AND NOW() BETWEEN CPL.created_at AND DATE_ADD(CPL.created_at, INTERVAL CP.dias_uso DAY);
    `;

    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async obtenerCodigosPromociones(id_empresa) {
    const queryString = `
      SELECT
        CPL.id_codigo,
        CP.codigo,
        CPL.id_empresa,
        CP.valor,
        CPL.valor_vigente,
        CPL.created_at AS fecha_asignacion,
        CP.vigencia_inicial,
        CP.vigencia AS vigencia_final,
        CP.dias_uso AS dias_vigencia,
        GREATEST(CP.dias_uso - DATEDIFF(CURDATE(), CPL.created_at), 0) AS dias_restantes,
        CASE 
            WHEN GREATEST(CP.dias_uso - DATEDIFF(CURDATE(), CPL.created_at), 0) > 0 THEN 'activo'
            ELSE 'caducado'
        END AS estatus
    FROM CREDITOS_PLATAFORMA AS CPL
    LEFT JOIN CODIGOS_PROMOCION AS CP ON CP.id = CPL.id_codigo
    WHERE CPL.id_empresa = ${id_empresa};
    `
    const result = await mysqlLib.query(queryString)
    return result
  }

  async obtenerSaldo(id_emp) {
    const queryString = `
      SELECT
          creditos,
          ultima_recarga,
          vigencia
      FROM empresa_creditos WHERE emp_id = ${id_emp};
    `
    const result = await mysqlLib.query(queryString)
    return result
  }

  async actualizarSaldoCodigosPromocion(id, creditos) {
    const queryString = `
        UPDATE CREDITOS_PLATAFORMA SET valor_vigente = ${creditos} WHERE id = ${id};
      `

    const result = await mysqlLib.query(queryString)
    return result
  }

  async actualizarSaldo(id_emp, creditos) {
    const queryString = `
        UPDATE empresa_creditos SET creditos = ${creditos} WHERE emp_id = ${id_emp};
      `;

    const result = await mysqlLib.query(queryString)
    return result
  }

  async insertarSaldo(id_emp, creditos) {

    console.log('Insertar Saldo ', id_emp);
    const queryString = `
        INSERT INTO empresa_creditos(emp_id, creditos, ultima_recarga, vigencia)
        VALUES(${id_emp}, ${creditos}, NOW(), NOW());
      `;

    console.log(queryString);

    const result = await mysqlLib.query(queryString)
    return result

  }

  async getRecibidas(id_emp) {

    //debug('SoliictudCredit->getClientes')

    console.log('getRecibidas ', id_emp);

    // nombre
    // RFC

    // reporte_pdf
    //     ciudad
    //     linea_credito
    //     consumo_mensual
    //     metodo_pago 

    // certification

    // emp_id,
    // emp_rfc,
    // emp_razon_social

    // const queryString = `
    // SELECT
    //     emp.emp_rfc,
    //     emp.emp_website,
    //     emp.emp_razon_social,
    //     cert.id_certification ,
    //     rc.reporte_pdf ,
    //     "" as ciudad,
    //     "" as linea_credito,
    //     "" as consumo_mensual,
    //     "" as metodo_pago
    // FROM comprador_vendedor cv
    // INNER JOIN empresa emp ON emp.emp_id = cv.id_cliente
    // LEFT JOIN certification cert ON emp.emp_id = cert.id_empresa
    // LEFT join reporte_credito rc ON cert.id_certification = rc.id_certification
    // WHERE cv.id_proveedor = ${id_emp};
    // `;

    const queryString = `
      SELECT
          sol.id_solicitud_credito,
          sol.id_cliente,
          sol.id_proveedor,
          emp.emp_rfc,
          emp.emp_website,
          emp.emp_razon_social,
          emp.emp_logo,
          cert.id_certification,
          "" as ciudad,
          "" as linea_credito,
          "" as consumo_mensual,
          "" as metodo_pago,
          sol.estatus,
          COALESCE(sol.created_at, '') AS fecha_solicitud
      FROM solicitud_credito sol
      LEFT JOIN empresa emp ON emp.emp_id = sol.id_proveedor
      LEFT JOIN certification cert ON cert.id_empresa = sol.id_cliente AND cert.estatus_certificacion <> 'cancelada'
      WHERE sol.id_cliente = ${id_emp};
    `;

    // LEFT JOIN certification cert ON emp.emp_id = cert.id_empresa AND cert.estatus_certificacion <> 'cancelada'

    // console.log(queryString);

    const result = await mysqlLib.query(queryString)
    return result


  }


  // COALESCE(rc.created_at, '') AS fecha_reporte

   async getEnviadas(id_emp, idCliente = 0) {

    const queryString = `
    SELECT
    sol.id_solicitud_credito,
    sol.id_cliente,
    sol.id_proveedor,
    emp.emp_rfc,
    emp.emp_website,
    emp.emp_razon_social,
    emp.emp_logo,
    cert.id_certification,
	 COALESCE(rc.reporte_pdf, rcd.reporte_pdf) AS reporte_pdf,
    COALESCE(rc.monto_solicitado, rcd.monto_solicitado) AS linea_credito_solicitada,
    COALESCE(rc.plazo, rcd.plazo) AS plazo,
    COALESCE(rc.score, '') AS score,
    COALESCE(rc.monto_sugerido , '') AS linea_credito_sugerida,
    "" AS ciudad,
    "" AS consumo_mensual,
    "" AS metodo_pago,
    sol.estatus,
    cert.estatus_certificacion,
    COALESCE(sol.created_at, '') AS fecha_solicitud,
    COALESCE(rc.created_at, rcd.created_at) AS fecha_reporte
FROM solicitud_credito sol 
LEFT JOIN empresa emp ON emp.emp_id = sol.id_cliente 
LEFT JOIN certification cert ON emp.emp_id = cert.id_empresa AND cert.estatus_certificacion <> 'cancelada' 
LEFT JOIN reporte_credito rc ON rc.id_reporte_credito = sol.id_solicitud_credito AND rc.id_reporte_credito IS NOT NULL 
LEFT JOIN reporte_credito_descriptivo rcd 
  ON rcd.id_reporte_credito = sol.id_solicitud_credito 
  AND rcd.id_reporte_credito IS NOT NULL 
WHERE sol.id_proveedor = ${id_emp}
UNION
SELECT 
    NULL AS id_solicitud_credito,
    NULL AS id_cliente,
    NULL AS id_proveedor,
    sce.tax_id AS emp_rfc,
    NULL AS emp_website,
    sce.nombre_empresa AS emp_razon_social,
    NULL AS emp_logo,
    NULL AS id_certification,
    NULL AS reporte_pdf,
    NULL AS linea_credito_solicitada,
    NULL AS plazo,
    NULL AS score,
    NULL AS linea_credito_sugerida,
    "" AS ciudad,
    "" AS consumo_mensual,
    "" AS metodo_pago,
    'no registrada' AS estatus,
    NULL AS estatus_certificacion,
    COALESCE(sce.created_at, '') AS fecha_solicitud,
    NULL AS fecha_reporte
FROM solicitud_credito_externos sce
WHERE sce.emp_id = ${id_emp}
AND NOT EXISTS (
    SELECT 1 
    FROM solicitud_credito sol 
    LEFT JOIN empresa emp ON emp.emp_id = sol.id_cliente
    WHERE emp.emp_rfc = sce.tax_id)
    `;

    const result = await mysqlLib.query(queryString)
    return result


  }

  async getEnviadasCliente(emp_id) {
    const queryString = `
      SELECT DISTINCT id_cliente
      FROM solicitud_credito
      WHERE id_proveedor = ${id_emp}
    `;

    const result = await mysqlLib.query(queryString)
    return result
  }

  async guardarSolicitudCreditoExterno(emp_id, nombre_empresa, tax_id, nombre_contacto, telefono, email_corporativo) {

    //console.log('Obtener Saldo ', id_emp);
    const queryString = `
        INSERT INTO solicitud_credito_externos(emp_id, nombre_empresa, tax_id, nombre_contacto, telefono, email_corporativo, created_at)
        VALUES(${emp_id}, '${nombre_empresa}', '${tax_id}', '${nombre_contacto}', '${telefono}', '${email_corporativo}', NOW());
      `;

    console.log(queryString);

    const result = await mysqlLib.query(queryString)
    return result
  }

  async obtenerSolitudesCreditoExternasPendientes(tax_id) {

    //console.log('Obtener Saldo ', id_emp);
    const queryString = `
        SELECT
            id, 
            emp_id,
            nombre_empresa,
            tax_id,
            nombre_contacto,
            telefono,
            email_corporativo,
            estatus,
            created_at
        FROM solicitud_credito_externos WHERE tax_id = '${tax_id}' AND estatus = 'enviado';
      `;

    console.log(queryString);

    const result = await mysqlLib.query(queryString)
    return result
  }

  async actualizarEstatusSolicitudCreditoExterno(id, estatus) {

    //console.log('Obtener Saldo ', id_emp);
    const queryString = `
        UPDATE solicitud_credito_externos SET estatus = '${estatus}' WHERE id = ${id};
      `;

    console.log(queryString);

    const result = await mysqlLib.query(queryString)
    return result
  }

  async getSCE(sce_id) {

    //console.log('Obtener Saldo ', id_emp);
    const queryString = `
        SELECT * FROM solicitud_credito_externos WHERE id = ${sce_id};
      `;

    console.log(queryString);

    const result = await mysqlLib.query(queryString)
    return result
  }

  async getSaldoEmpresasResporte() {
    const queryString = `
      SELECT 
      	CONCAT(e.emp_razon_social, ' ',  COALESCE(cd.denominacion, '')) AS empresa,
          CASE
      		WHEN cp.vigencia > NOW()
      	    	THEN (COALESCE(ec.creditos, 0) + COALESCE(cp.valor_vigente, 0))
      		ELSE 0
      	END AS saldo_disponible,
      	(
      		SELECT COUNT(*)
              	FROM solicitud_credito AS sc
              	WHERE sc.id_proveedor = COALESCE(cp.id_empresa, ec.emp_id)
      	) 
      		+
      	(
      		SELECT COUNT(*)
              	FROM solicitud_credito_externos AS sce
              	WHERE sce.emp_id = COALESCE(cp.id_empresa, ec.emp_id)
      	) AS saldo_consumido
      FROM empresa_creditos AS ec
      LEFT JOIN CREDITOS_PLATAFORMA AS cp ON cp.id_empresa = ec.emp_id
      LEFT JOIN empresa AS e ON e.emp_id = cp.id_empresa OR e.emp_id = ec.emp_id
      LEFT JOIN cat_denominacion AS cd ON cd.id = e.denominacion
        
      UNION
        
      SELECT 
      	CONCAT(e.emp_razon_social, ' ',  COALESCE(cd.denominacion, '')) AS empresa,
          CASE
      		WHEN cp.vigencia > NOW()
      	    	THEN (COALESCE(ec.creditos, 0) + COALESCE(cp.valor_vigente, 0))
      		ELSE 0
      	END AS saldo_disponible,
      	(
      		SELECT COUNT(*)
              	FROM solicitud_credito AS sc
              	WHERE sc.id_proveedor = COALESCE(cp.id_empresa, ec.emp_id)
      	) 
      		+
      	(
      		SELECT COUNT(*)
              	FROM solicitud_credito_externos AS sce
              	WHERE sce.emp_id = COALESCE(cp.id_empresa, ec.emp_id)
      	) AS saldo_consumido
      FROM empresa_creditos AS ec
      RIGHT JOIN CREDITOS_PLATAFORMA AS cp ON cp.id_empresa = ec.emp_id
      LEFT JOIN empresa AS e ON e.emp_id = cp.id_empresa OR e.emp_id = ec.emp_id
      LEFT JOIN cat_denominacion AS cd ON cd.id = e.denominacion;
    `;

    const result = await mysqlLib.query(queryString)
    return result
  }

}



const inst = new SolicituCreditoService()
Object.freeze(inst)

module.exports = inst
