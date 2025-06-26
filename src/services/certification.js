'use strict'

const debug = require('debug')('old-api:certification-service')
const mysqlLib = require('../lib/db')
const logger = require('../utils/logs/logger')
const cipher = require('../utils/cipherService')

// Utilidades y servicios


// Tablas locales de score y clases para los correos de reporte de crédito
const SCORE_CLASSES_DATA_A = [

  { score_min: 0, score_max: 9.725915398, class: 10 },
  { score_min: 9.713098427, score_max: 7.88034726, class: 9 },
  { score_min: 7.831715491, score_max: 6.782972613, class: 8 },
  { score_min: 6.755250475, score_max: 5.650838683, class: 7 },
  { score_min: 5.635277269, score_max: 4.682780276, class: 6 },
  { score_min: 4.673229116, score_max: 3.899932539, class: 5 },
  { score_min: 3.893451896, score_max: 3.102750063, class: 4 },
  { score_min: 3.09834002, score_max: 2.271915396, class: 3 },
  { score_min: 2.268914882, score_max: 0.764434256, class: 2 },
  { score_min: 0.748495599, score_max: 100, class: 1 }
]


const SCORE_CLASSES_DATA_B = [
  { score_min: 0, score_max: 0.005971215, class: 10 },
  { score_min: 0.006048235, score_max: 0.037795883, class: 9 },
  { score_min: 0.039678644, score_max: 0.113162019, class: 8 },
  { score_min: 0.1163393, score_max: 0.3502259, class: 7 },
  { score_min: 0.355698999, score_max: 0.916841386, class: 6 },
  { score_min: 0.925558799, score_max: 1.984161767, class: 5 },
  { score_min: 1.996804571, score_max: 4.299395997, class: 4 },
  { score_min: 4.317577944, score_max: 9.347577891, class: 3 },
  { score_min: 9.373034696, score_max: 31.76843163, class: 2 },
  { score_min: 32.11491905, score_max: 100, class: 1 }
]


class CertificationService {
  constructor() {
    if (CertificationService.instance == null) {
      this.table = 'certificaciones'
      this.pricesTable = 'precios_plataforma'
      CertificationService.instance = this
    }
    return CertificationService.instance
  }


  async updateCertification(certificationData) {
    const { empresa, nrp, herramienta_proteccion, capital_social, empleados } = certificationData;

    // Construir la consulta SQL para actualizar la certificación
    const queryString = `
        UPDATE certificaciones AS c
        INNER JOIN (
            SELECT MAX(certificacion_id) AS max_certificacion_id
            FROM certificaciones
            WHERE empresa_id = ${empresa}
        ) AS m ON c.certificacion_id = m.max_certificacion_id
        SET c.nrp = '${nrp}',
            c.herramienta_proteccion_id = ${herramienta_proteccion},
            c.capital_social = ${capital_social},
            c.empleados = ${empleados}
    `;

    // Ejecutar la consulta y retornar el resultado
    const result = await mysqlLib.query(queryString);
    return result;
  }


  async createCertification({ empresa, n_certificacion, nrp, herramienta_proteccion, capital_social, empleados }) {
    debug('certification->createCertification')

    const queryString = `
      INSERT INTO certificaciones
      (empresa_id, n_certificacion, nrp, herramienta_proteccion_id, capital_social, empleados)
      VALUES
      (${empresa}, ${n_certificacion}, '${nrp}', ${herramienta_proteccion}, ${capital_social}, ${empleados})
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }
  async createCertification(body) {

    const queryString = `
      INSERT INTO certification
      (id_empresa, id_usuario, id_pais, rfc, direccion_fiscal, pagina_web, id_sector, razon_social, nrp, id_actividad_economica, plantilla_laboral)
      VALUES
      (${id_empresa}, ${id_usuario}, ${id_pais}, '${direccion_fiscal}', '${pagina_web}', ${id_sector}, '${razon_social}', '${nrp}', ${id_actividad_economica}, ${plantilla_laboral})
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }


  async createCertificationRegister({ empresa, n_certificacion }) {
    debug('certification->createCertification')

    const queryString = `
      INSERT INTO certificaciones
      (empresa_id, n_certificacion)
      VALUES
      (${empresa}, ${n_certificacion})
    `;
    const { result } = await mysqlLib.query(queryString);

    return result;
  }

  async getInmueblesCertificacion(certificacion_id) {
    const queryString = `
    SELECT 
      *
    FROM certificaciones_inmueble
    WHERE certificacion_id = ${certificacion_id}
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }


  async getCertificationBySection(idEmpresa, seccion) {
    debug('certification->getCertification')
    let queryString = '';
    switch (seccion) {
      case '1':
        queryString = `
          SELECT 
          certificaciones.*,
          certificaciones_inmueble.*,
          certificaciones_referencias_comerciales.*
          FROM 
          certificaciones
          LEFT JOIN 
          certificaciones_inmueble ON certificaciones.certificacion_id = certificaciones_inmueble.certificacion_id
          LEFT JOIN 
          certificaciones_referencias_comerciales ON certificaciones.certificacion_id = certificaciones_referencias_comerciales.certificacion_id
          WHERE 
          certificaciones.certificacion_id = (
          SELECT 
          MAX(certificacion_id)
          FROM 
          certificaciones
          WHERE 
          empresa_id = ${idEmpresa}
          )

          `
        break;
      case '2':
        queryString = `
          SELECT 
          certificaciones_representantes.*,
          certificaciones.*
          FROM 
          certificaciones_representantes
          LEFT JOIN 
          certificaciones ON certificaciones_representantes.certificacion_id = certificaciones.certificacion_id
          WHERE 
          certificaciones.certificacion_id = (
          SELECT MAX(certificacion_id) 
          FROM certificaciones 
          WHERE empresa_id = ${idEmpresa}
          );
    
            `
        break;
      case '3':
        queryString = `
        SELECT
	cer.certificacion_id,
	cer.empresa_id,
    cer.nrp,
    cer.herramienta_proteccion_id,
    cer.capital_social,
    cer.empleados,
    cer.created_at,
    emp.id_emp_rel,
    emp.nombre,
    emp.razon_social,
    emp.pais_id
FROM certificaciones cer
INNER JOIN certificaciones_empresas_relacionadas emp ON cer.certificacion_id = emp.certificacion_id
WHERE cer.certificacion_id = (
  SELECT MAX(certificacion_id) 
  FROM certificaciones 
  WHERE empresa_id = ${idEmpresa}
          );
              `
        break;
      case '4':
        queryString = `
        SELECT cp.*, cd.*
        FROM certificaciones c
        LEFT JOIN certificaciones_partidad_financieras cp ON c.certificacion_id = cp.certificacion_id
        LEFT JOIN certificaciones_documentos cd ON c.certificacion_id = cd.certificacion_id
        WHERE c.certificacion_id =  (
          SELECT MAX(certificacion_id) 
          FROM certificaciones 
          WHERE empresa_id = ${idEmpresa}
          );
      `;
        break;
      default:
        break;
    }

    const { result } = await mysqlLib.query(queryString)

    return result;
  }


  async updateRepresentative(representative, isLegal) {
    debug('certification->updateRepresentative');
    const { certificacion_id, nombre, representante_legal, directivo, consejo, inversionista, accionista, porcentaje } = representative;

    // Realizar la actualización según corresponda
    const fieldToUpdate = isLegal ? 'representante_legal' : 'directivo';
    const newValue = isLegal ? '1' : '0';

    await mysqlLib.query(`
      UPDATE certificaciones_representantes 
      SET ${fieldToUpdate} = '${newValue}', 
          consejo = '${consejo}', 
          inversionista = '${inversionista}', 
          accionista = '${accionista}', 
          porcentaje = ${porcentaje}
      WHERE certificacion_id = ${certificacion_id} AND nombre = '${nombre}'
  `);
  }


  async insertRepresentative(certificationID, nombre, representanteLegal, directivo, consejo, inversionista, accionista, porcentaje) {
    // Lógica de inserción
    const insertQuery = `INSERT INTO certificaciones_representantes (certificacion_id, nombre, representante_legal, directivo, consejo, inversionista, accionista, porcentaje) VALUES (${certificationID}, '${nombre}', '${representanteLegal}', '${directivo}', '${consejo}', '${inversionista}', '${accionista}', ${porcentaje})`;
    await mysqlLib.query(insertQuery);
  }

  async deleteRepresentative(representative) {
    try {
      const { certificacion_id, nombre } = representative;
      const deleteQuery = `DELETE FROM certificaciones_representantes WHERE certificacion_id = ${certificacion_id} AND nombre = '${nombre}'`;
      await mysqlLib.query(deleteQuery);
    } catch (error) {
      console.error('Error al eliminar el representante:', error);
      throw error;
    }
  }


  async getRepresentatives(certificacion_id) {
    const queryString = `
    SELECT * FROM certificaciones_representantes
    WHERE certificacion_id = ${certificacion_id};
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async updateOrCreateRepresentatives(body, certificationID) {
    debug('certification->updateOrCreateRepresentatives');
    const { accionistas, nombre } = body;

    // Consultar representantes existentes
    const existingRepresentativesResult = await mysqlLib.query(`
      SELECT * FROM certificaciones_representantes WHERE certificacion_id = ${certificationID}
  `);

    // Verificar si la consulta fue exitosa
    if (!existingRepresentativesResult || !existingRepresentativesResult.result) {
      console.error('Error al consultar representantes existentes.');
      return;
    }

    const existingRepresentatives = existingRepresentativesResult.result;

    // Buscar el representante legal actual
    const currentLegalRepresentative = existingRepresentatives.find(rep => rep.representante_legal === '1');

    // Verificar si se encontró un representante legal actual
    if (currentLegalRepresentative) {
      // Actualizar el nombre del representante legal si es diferente al nuevo nombre
      if (currentLegalRepresentative.nombre !== nombre) {
        await mysqlLib.query(`
              UPDATE certificaciones_representantes
              SET nombre = '${nombre}'
              WHERE certificacion_id = ${certificationID} AND representante_legal = '1'
          `);
      }
    } else {
      // Insertar un nuevo representante legal si no existe
      await this.insertRepresentative(certificationID, nombre, '1', '0', '0', '0', '0', 0);
    }

    // Actualizar o insertar los demás accionistas...
    for (const accionista of accionistas) {
      const existingRep = existingRepresentatives.find(rep => rep.nombre === accionista.nombre);
      if (existingRep) {
        // Actualizar el accionista existente
        await this.updateRepresentative(existingRep, false);
      } else {
        // Insertar un nuevo accionista
        await this.insertRepresentative(certificationID, accionista.nombre, accionista.representante_legal, accionista.directivo, accionista.consejo, accionista.inversionista, accionista.accionista, accionista.porcentaje);
      }
    }

    // Eliminar representantes que ya no están en la nueva información
    const newRepresentativesNames = accionistas.map(d => d.nombre);
    for (const existingRep of existingRepresentatives) {
      if (existingRep.representante_legal === '0' && !newRepresentativesNames.includes(existingRep.nombre)) {
        await this.deleteRepresentative(existingRep);
      }
    }
  }

  async updateRelatedCompany(certificationID, company, id_emp_rel) {
    const { nombre, razon_social, pais } = company;
    console.log('Valores recibidos:', company);
    try {
      const updateQuery = `
            UPDATE certificaciones_empresas_relacionadas 
            SET nombre = '${nombre}', razon_social = '${razon_social}', pais_id = ${pais}
            WHERE certificacion_id = ${certificationID} AND id_emp_rel = ${id_emp_rel}`;
      console.log(updateQuery);
      await mysqlLib.query(updateQuery);
    } catch (error) {
      console.error(`Error al actualizar empresa relacionada: ${error}`);
      throw error;
    }
  }

  async deleteRelatedCompany(company) {
    const { id_emp_rel } = company;
    try {
      const deleteQuery = `
            DELETE FROM certificaciones_empresas_relacionadas 
            WHERE id_emp_rel = ?`;
      await mysqlLib.query(deleteQuery, [id_emp_rel]);
      console.log(`Empresa relacionada eliminada: ${id_emp_rel}`);
    } catch (error) {
      console.error(`Error al eliminar empresa relacionada: ${error}`);
      throw error;
    }
  }

  async insertRelatedCompany(certificationID, company) {
    const { nombre, razon_social, pais } = company;
    try {
      const insertQuery = `
          INSERT INTO certificaciones_empresas_relacionadas (certificacion_id, nombre, razon_social, pais_id) 
          VALUES (${certificationID}, '${nombre}', '${razon_social}', ${pais})`;
      await mysqlLib.query(insertQuery);
      console.log(`Nueva empresa relacionada insertada para la certificación ${certificationID}: ${nombre}`);
    } catch (error) {
      console.error(`Error al insertar nueva empresa relacionada: ${error}`);
      throw error;
    }
  }

  async getRelatedCompanies(certificacion_id) {
    const queryString = `
    SELECT * FROM certificaciones_empresas_relacionadas WHERE certificacion_id = ${certificacion_id};
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async updateOrCreateRelatedCompanies(body, certificationID) {
    const { empresas_relacionadas } = body;

    try {
      // Consultar empresas relacionadas existentes
      const existingRelatedCompaniesResult = await mysqlLib.query(`
            SELECT * FROM certificaciones_empresas_relacionadas WHERE certificacion_id = ${certificationID}
        `);

      if (!existingRelatedCompaniesResult || !existingRelatedCompaniesResult.result) {
        console.error('Error al consultar empresas relacionadas existentes.');
        return;
      }

      const existingRelatedCompanies = existingRelatedCompaniesResult.result;
      const existingCount = existingRelatedCompanies.length;
      const incomingCount = empresas_relacionadas.length;

      if (existingCount === 0) {
        // Insertar todas las empresas relacionadas del objeto entrante
        for (const empresa of empresas_relacionadas) {
          await this.insertRelatedCompany(certificationID, empresa);
        }
      } else if (incomingCount === existingCount) {
        // Actualizar cada registro existente con los datos del objeto
        for (let i = 0; i < existingCount; i++) {
          console.log(certificationID, empresas_relacionadas[i]);
          const { id_emp_rel } = existingRelatedCompanies[i];
          await this.updateRelatedCompany(certificationID, empresas_relacionadas[i], id_emp_rel);
        }
      } else {
        // Actualizar registros existentes con datos del objeto y luego insertar los restantes
        for (let i = 0; i < Math.min(existingCount, incomingCount); i++) {
          console.log(certificationID, empresas_relacionadas[i]);
          const { id_emp_rel } = existingRelatedCompanies[i];
          await this.updateRelatedCompany(certificationID, empresas_relacionadas[i], id_emp_rel);
        }

        for (let i = existingCount; i < incomingCount; i++) {
          await this.insertRelatedCompany(certificationID, empresas_relacionadas[i]);
        }
      }

      console.log('Actualización completada exitosamente.');
    } catch (error) {
      console.error(`Error al actualizar o insertar empresas relacionadas: ${error}`);
    }
  }

  // Método para insertar una propiedad en la tabla de inmuebles
  async insertProperty(certificacionID, property) {
    const queryString = `
      INSERT INTO certificaciones_inmueble (certificacion_id, direccion, propio, comodato, renta, precio, oficinas_administrativas, almacen, area_produccion)
      VALUES (${certificacionID}, '${property.direccion}', '${property.propio}', '${property.comodato}', '${property.renta}', ${property.precio ? property.precio : 'NULL'}, '${property.oficinas_administrativas}', '${property.almacen}', '${property.area_produccion}')
  `;
    await mysqlLib.query(queryString);
  }

  // Método para actualizar una propiedad en la tabla de inmuebles
  async updateProperty(property, inmuebles) {
    const queryString = `
      UPDATE certificaciones_inmueble
      SET direccion = '${inmuebles.direccion}', propio = '${inmuebles.propio}', comodato = '${inmuebles.comodato}', renta = '${inmuebles.renta}', precio = ${inmuebles.precio ? inmuebles.precio : 'NULL'}, oficinas_administrativas = '${inmuebles.oficinas_administrativas}', almacen = '${inmuebles.almacen}', area_produccion = '${inmuebles.area_produccion}'
      WHERE id_cert_inmueble = ${property.id_cert_inmueble}
  `;
    await mysqlLib.query(queryString);
  }

  // Método para insertar una referencia comercial en la tabla de referencias comerciales
  async insertReference(certificacionID, reference) {
    // Verificar si reference.pais_id está definido, si no, asignar un valor predeterminado
    const pais_id = reference.pais_id !== undefined ? reference.pais_id : 0;

    const queryString = `
      INSERT INTO certificaciones_referencias_comerciales (certificacion_id, empresa, nombre, correo, telefono, pais_id)
      VALUES (${certificacionID}, '${reference.empresa}', '${reference.nombre}', '${reference.correo}', '${reference.telefono}', ${reference.pais})
  `;
    await mysqlLib.query(queryString);
  }


  // Método para actualizar una referencia comercial en la tabla de referencias comerciales
  async updateReference(references, reference) {
    const queryString = `
      UPDATE certificaciones_referencias_comerciales
      SET empresa = '${reference.empresa}', nombre = '${reference.nombre}', correo = '${reference.correo}', telefono = '${reference.telefono}', pais_id = ${reference.pais}
      WHERE id_cert_ref_com = ${references.id_cert_ref_com}
  `;
    await mysqlLib.query(queryString);
  }

  async updateOrCreatePropertiesAndReferences(body, certificationID) {
    const { inmuebles, referencia_comercial } = body;

    try {
      // Consultar inmuebles existentes
      const existingPropertiesResult = await mysqlLib.query(`
            SELECT * FROM certificaciones_inmueble WHERE certificacion_id = ${certificationID}
        `);

      if (!existingPropertiesResult || !existingPropertiesResult.result) {
        console.error('Error al consultar inmuebles existentes.');
        return;
      }

      const existingProperties = existingPropertiesResult.result;
      const existingCountProperties = existingProperties.length;
      const incomingCountProperties = inmuebles.length;

      // Actualizar o insertar inmuebles
      if (incomingCountProperties === existingCountProperties) {
        // Actualizar todos los registros en la BD con los datos del array
        for (let i in existingProperties) {
          await this.updateProperty(existingProperties[i], inmuebles[i]);
        }

      } else if (incomingCountProperties > existingCountProperties) {
        // Actualizar registros existentes con los datos del array y luego insertar los nuevos
        for (let i = 0; i < existingCountProperties; i++) {
          await this.updateProperty(existingProperties[i], inmuebles[i]);
        }
        // Insertar inmuebles adicionales
        for (let i = existingCountProperties; i < incomingCountProperties; i++) {
          await this.insertProperty(certificationID, inmuebles[i]);
        }
      } else {
        // Actualizar registros en la BD con los datos del array y eliminar excedentes en la BD
        for (let i = 0; i < incomingCountProperties; i++) {
          await this.updateProperty(existingProperties[i], inmuebles[i]);
        }

      }

      // Consultar referencias comerciales existentes
      const existingReferencesResult = await mysqlLib.query(`
            SELECT * FROM certificaciones_referencias_comerciales WHERE certificacion_id = ${certificationID}
        `);

      if (!existingReferencesResult || !existingReferencesResult.result) {
        console.error('Error al consultar referencias comerciales existentes.');
        return;
      }

      const existingReferences = existingReferencesResult.result;
      const existingCountReferences = existingReferences.length;
      const incomingCountReferences = referencia_comercial.length;

      // Actualizar o insertar referencias comerciales
      if (incomingCountReferences === existingCountReferences) {
        // Actualizar todos los registros en la BD con los datos del array
        for (let i = 0; i < incomingCountReferences; i++) {
          await this.updateReference(existingReferences[i], referencia_comercial[i]);
        }
      } else if (incomingCountReferences > existingCountReferences) {
        // Actualizar registros existentes con los datos del array y luego insertar los nuevos
        for (let i = 0; i < existingCountReferences; i++) {
          await this.updateReference(existingReferences[i], referencia_comercial[i]);
        }
        // Insertar referencias comerciales adicionales
        for (let i = existingCountReferences; i < incomingCountReferences; i++) {
          await this.insertReference(certificationID, referencia_comercial[i]);
        }
      } else {
        // Actualizar registros en la BD con los datos del array y eliminar excedentes en la BD
        for (let i = 0; i < incomingCountReferences; i++) {
          await this.updateReference(existingReferences[i], referencia_comercial[i]);
        }
        // Eliminar registros excedentes en la BD
        for (let i = incomingCountReferences; i < existingCountReferences; i++) {
          // Lógica para eliminar registros de la base de datos
        }
      }

      console.log('Actualización completada exitosamente.');
    } catch (error) {
      console.error(`Error al actualizar o insertar propiedades y referencias comerciales: ${error}`);
    }
  }

  async duplicateRepresentatives(certificacion_id) {
    try {
      // Obtener el último certificacion_id
      const queryLastCertificationId = `
            SELECT MAX(certificacion_id) AS last_certificacion_id
            FROM certificaciones_representantes
        `;
      const lastCertificationIdResult = await mysqlLib.query(queryLastCertificationId);
      const lastCertificacionId = lastCertificationIdResult.result[0].last_certificacion_id;

      // Obtener los registros a duplicar con el último certificacion_id
      const queryGetRepresentatives = `
            SELECT *
            FROM certificaciones_representantes
            WHERE certificacion_id = ${lastCertificacionId}
        `;
      const representativesToDuplicate = await mysqlLib.query(queryGetRepresentatives);

      // Duplicar los registros con el nuevo certificacion_id
      for (const representative of representativesToDuplicate.result) {
        const queryDuplicateRepresentative = `
                INSERT INTO certificaciones_representantes (certificacion_id, nombre, representante_legal, directivo, consejo, inversionista, accionista, porcentaje)
                VALUES (${certificacion_id}, '${representative.nombre}', '${representative.representante_legal}', '${representative.directivo}', '${representative.consejo}', '${representative.inversionista}', '${representative.accionista}', ${representative.porcentaje})
            `;
        await mysqlLib.query(queryDuplicateRepresentative);
      }

      // Obtener los registros duplicados
      const queryGetDuplicatedRepresentatives = `
            SELECT *
            FROM certificaciones_representantes
            WHERE certificacion_id = ${certificacion_id}
        `;
      const duplicatedRepresentatives = await mysqlLib.query(queryGetDuplicatedRepresentatives);

      return duplicatedRepresentatives;
    } catch (error) {
      throw error;
    }
  }

  async duplicateCertificationDocuments(newCertificationId) {
    try {
      // Obtener el último certificacion_id
      const queryString = `SELECT MAX(certificacion_id) AS max_certificacion_id FROM certificaciones_documentos`;
      const { result: maxCertificationIdResult } = await mysqlLib.query(queryString);
      const maxCertificationId = maxCertificationIdResult[0].max_certificacion_id;

      // Obtener los documentos con el último certificacion_id
      const documentsQueryString = `
            SELECT * FROM certificaciones_documentos
            WHERE certificacion_id = ${maxCertificationId}
        `;
      const { result: documentsResult } = await mysqlLib.query(documentsQueryString);

      // Duplicar los documentos con el nuevo certificacion_id
      for (const document of documentsResult) {
        const { nombre_documento, ruta, vencimiento, status, peso } = document;
        const insertQueryString = `
                INSERT INTO certificaciones_documentos (certificacion_id, nombre_documento, ruta, fecha_carga, vencimiento, status, peso)
                VALUES (${newCertificationId}, '${nombre_documento}', '${ruta}', NOW(), '${vencimiento}', '${status}', '${peso}')
            `;
        await mysqlLib.query(insertQueryString);
      }

      // Obtener los documentos duplicados
      const duplicatedDocumentsQueryString = `
            SELECT * FROM certificaciones_documentos
            WHERE certificacion_id = ${newCertificationId}
        `;
      const { result: duplicatedDocuments } = await mysqlLib.query(duplicatedDocumentsQueryString);

      return duplicatedDocuments;
    } catch (error) {
      throw error;
    }
  }

  async duplicateFinancialRecords(newCertificationId) {
    try {
      // Obtener el último certificacion_id
      const queryLastCertificationId = `
            SELECT MAX(certificacion_id) AS max_certificacion_id
            FROM certificaciones_partidad_financieras;
        `;
      const lastCertificationIdResult = await mysqlLib.query(queryLastCertificationId);
      const lastCertificationId = lastCertificationIdResult.result[0].max_certificacion_id;

      // Obtener los registros a duplicar con el último certificacion_id
      const querySelectRecords = `
            SELECT *
            FROM certificaciones_partidad_financieras
            WHERE certificacion_id = ${lastCertificationId};
        `;
      const recordsToDuplicate = await mysqlLib.query(querySelectRecords);

      // Insertar registros duplicados con el nuevo certificacion_id
      const insertQueries = recordsToDuplicate.result.map(record => {
        return `
                INSERT INTO certificaciones_partidad_financieras 
                (certificacion_id, seccion, fecha, periodo_activo, periodo_pasivo, unidad_neta, ventas, created_at, capital, divisa, expresado_en)
                VALUES (${newCertificationId}, ${record.seccion}, '${record.fecha}', ${record.periodo_activo}, 
                ${record.periodo_pasivo}, ${record.unidad_neta}, ${record.ventas}, ${record.capital}, '${record.divisa}', '${record.expresado_en}', NOW());
            `;
      });

      const insertedRecords = [];
      for (const query of insertQueries) {
        const result = await mysqlLib.query(query);
        insertedRecords.push(result);
      }

      return insertedRecords;
    } catch (error) {
      throw error;
    }
  }

  async duplicateRelatedCompanies(certificacion_id) {
    try {
      // Obtener el último certificacion_id
      const lastCertificationIdQuery = `
            SELECT MAX(certificacion_id) AS max_certificacion_id
            FROM certificaciones_empresas_relacionadas;
        `;
      const { result: maxResult } = await mysqlLib.query(lastCertificationIdQuery);
      const lastCertificationId = maxResult[0].max_certificacion_id;

      // Obtener los registros que tienen el último certificacion_id
      const relatedCompaniesQuery = `
            SELECT *
            FROM certificaciones_empresas_relacionadas
            WHERE certificacion_id = ${lastCertificationId};
        `;
      const { result: companiesResult } = await mysqlLib.query(relatedCompaniesQuery);

      // Insertar los registros duplicados con el nuevo certificacion_id
      const insertQueries = companiesResult.map(company => {
        return `
                INSERT INTO certificaciones_empresas_relacionadas (certificacion_id, nombre, razon_social, pais_id)
                VALUES (${certificacion_id}, '${company.nombre}', '${company.razon_social}', ${company.pais_id});
            `;
      });

      for (const query of insertQueries) {
        await mysqlLib.query(query);
      }

      return companiesResult; // Devolver los datos de los registros duplicados
    } catch (error) {
      throw error;
    }
  }

  async duplicateCertificationReferences(certificacion_id) {
    try {
      // Obtener el último certificacion_id
      const queryLastCertificationId = `
            SELECT MAX(certificacion_id) AS last_certificacion_id
            FROM certificaciones_referencias_comerciales;
        `;
      const resultLastCertificationId = await mysqlLib.query(queryLastCertificationId);
      const lastCertificationId = resultLastCertificationId.result[0].last_certificacion_id;

      // Obtener los registros que coinciden con el último certificacion_id
      const query = `
            SELECT *
            FROM certificaciones_referencias_comerciales
            WHERE certificacion_id = ${lastCertificationId};
        `;
      const result = await mysqlLib.query(query);

      // Duplicar los registros y asignarles el nuevo certificacion_id
      const duplicatedRecords = [];
      for (const record of result.result) {
        const { empresa, nombre, correo, telefono, pais_id } = record;
        const queryDuplicateRecord = `
                INSERT INTO certificaciones_referencias_comerciales (certificacion_id, empresa, nombre, correo, telefono, pais_id)
                VALUES (${certificacion_id}, '${empresa}', '${nombre}', '${correo}', '${telefono}', ${pais_id});
            `;
        await mysqlLib.query(queryDuplicateRecord);
        duplicatedRecords.push({ certificacion_id, empresa, nombre, correo, telefono, pais_id });
      }

      return duplicatedRecords;
    } catch (error) {
      throw error;
    }
  }

  async duplicateCertificationInmueble(certificacion_id_nuevo) {
    try {
      // Obtener el último certificacion_id
      const queryLastCertificacionId = `
            SELECT MAX(certificacion_id) AS ultimo_certificacion_id
            FROM certificaciones_inmueble;
        `;
      const resultLastCertificacionId = await mysqlLib.query(queryLastCertificacionId);
      const ultimo_certificacion_id = resultLastCertificacionId.result[0].ultimo_certificacion_id;

      // Obtener los registros a duplicar
      const queryGetRecordsToDuplicate = `
      SELECT *
      FROM certificaciones_inmueble
      WHERE certificacion_id = ${ultimo_certificacion_id};
      `;
      const recordsToDuplicate = await mysqlLib.query(queryGetRecordsToDuplicate);
      console.log(JSON.stringify(recordsToDuplicate.result))

      // Duplicar los registros con el nuevo certificacion_id
      for (const record of recordsToDuplicate.result) {
        const queryDuplicateRecord = `
                INSERT INTO certificaciones_inmueble 
                (certificacion_id, direccion, propio, comodato, renta, precio, oficinas_administrativas, almacen, area_produccion)
                VALUES 
                (${certificacion_id_nuevo}, '${record.direccion}', '${record.propio}', '${record.comodato}', '${record.renta}', ${record.precio}, '${record.oficinas_administrativas}', '${record.almacen}', '${record.area_produccion}');
            `;
        await mysqlLib.query(queryDuplicateRecord);
      }

      // Obtener los registros duplicados
      const queryGetDuplicatedRecords = `
            SELECT *
            FROM certificaciones_inmueble
            WHERE certificacion_id = ${certificacion_id_nuevo};
        `;
      const duplicatedRecords = await mysqlLib.query(queryGetDuplicatedRecords);

      return duplicatedRecords;
    } catch (error) {
      throw error;
    }
  }

  async duplicateCertification(body, certificacion_id) {
    try {
      // Obtener la certificacion a duplicar
      const certificacion = await this.getLatestCertificationByCompanyId(body.empresa);

      if (!certificacion) {
        throw new Error('No se encontró la certificación');
      }

      // Incrementar el valor de n_certificacion en 1
      const nuevoNroCertificacion = certificacion.n_certificacion + 1;

      // Insertar el nuevo registro duplicado
      const query = `
            INSERT INTO certificaciones (empresa_id, n_certificacion, nrp, herramienta_proteccion_id, capital_social, empleados, created_at)
            SELECT empresa_id, ${nuevoNroCertificacion}, nrp, herramienta_proteccion_id, capital_social, empleados, NOW()
            FROM certificaciones
            WHERE empresa_id = ${certificacion.empresa_id}
            ORDER BY certificacion_id DESC
            LIMIT 1;
        `;

      // Ejecutar la consulta
      const result = await mysqlLib.query(query);

      // Obtener el ID del último registro insertado
      const insertId = result.result.insertId;

      // Obtener y devolver el registro insertado
      const insertedCertification = await this.getCertificationById(insertId);
      return insertedCertification;
    } catch (error) {
      throw error;
    }
  }

  async getCertificationById(certificacionId) {
    try {
      const queryString = `
            SELECT *
            FROM certificaciones
            WHERE certificacion_id = ${certificacionId}
            LIMIT 1;
        `;
      const { result } = await mysqlLib.query(queryString);
      return result[0]; // Devuelve el primer resultado o null si no se encuentra
    } catch (error) {
      throw error;
    }
  }

  async getLatestCertificationByCompanyId(empresa_id) {
    try {
      const query = `
            SELECT * FROM certificaciones
            WHERE empresa_id = ${empresa_id}
            ORDER BY certificacion_id DESC
            LIMIT 1;
        `;

      const { result } = await mysqlLib.query(query);

      // Si hay resultados, retornar la primera fila
      if (result.length > 0) {
        return result[0];
      } else {
        return null; // Retornar null si no se encontró ninguna certificación para la empresa
      }
    } catch (error) {
      throw error;
    }
  }

  async getCertification(company) {
    debug('certification->getLatestCertification');
    const queryString = `
      SELECT * FROM ${this.table}
      WHERE empresa_id = ${company}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const { result } = await mysqlLib.query(queryString);

    return result.length > 0 ? result[0] : null;
  }

  async createProperties({ direccion, propio, comodato, renta, precio, oficinas_administrativas, almacen, area_produccion }, certificationID) {
    debug('certification->createProperties')
    const queryString = `
      INSERT INTO certificaciones_inmueble
      (certificacion_id, direccion, propio, comodato, renta, precio, oficinas_administrativas, almacen, area_produccion)
      VALUES
      (${certificationID}, '${direccion}', '${propio}', '${comodato}', '${renta}', ${precio}, '${oficinas_administrativas}', '${almacen}', '${area_produccion}')
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async createReferences({ empresa, nombre, correo, telefono, pais }, certificationID) {
    debug('certification->createReferences')
    const queryString = `
      INSERT INTO certificaciones_referencias_comerciales
      (certificacion_id, empresa, nombre, correo, telefono, pais_id)
      VALUES
      (${certificationID}, '${empresa}', '${nombre}', '${correo}', '${telefono}', ${pais})
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async createRepresentative({ nombre, directivo, consejo, inversionista, accionista, porcentaje }, certificationID) {
    debug('certification->createRepresentative')
    const queryString = `
      INSERT INTO certificaciones_representantes
      (certificacion_id, nombre, directivo, consejo, inversionista, accionista, porcentaje)
      VALUES
      (${certificationID}, '${nombre}', '${directivo}', '${consejo}', '${inversionista}', '${accionista}', ${porcentaje})
    `
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async createRelatedCompany({ nombre, razon_social, pais }, certificationID) {
    debug('certification->createRelatedCompany')
    const queryString = `
      INSERT INTO certificaciones_empresas_relacionadas
      (certificacion_id, nombre, razon_social, pais_id)
      VALUES
      (${certificationID}, '${nombre}', '${razon_social}', ${pais})
    `
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getCountries() {
    debug('certification->getCountries')
    const queryString = `
      SELECT
        pais_id,
        nombre
      FROM certificaciones_pais
      ORDER by nombre ASC
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getCountryById(id) {
    debug('certification->getCountryById')
    const queryString = `
      SELECT
        pais_id,
        nombre
      FROM certificaciones_pais
      WHERE pais_id = ${id}
    `
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getTools() {
    debug('certification->getTools')
    const queryString = `
      SELECT *
      FROM certificaciones_herramienta
      ORDER BY herramienta ASC
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async updateStatus(empresa, estatus) {
    debug('certification->updateStatus')
    const queryString = `
      UPDATE empresa
      SET
        emp_certificada = ${estatus}
      WHERE emp_id = ${empresa}
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getCertificationPrice() {
    debug('certification->getCertificationPrice')
    const queryString = `
      SELECT * FROM ${this.pricesTable}
      WHERE concepto = 'Certificacion'
    `
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async certificateMyCompanyForTest(company) {
    debug('certification->certificateMyCompanyForTest')
    const queryString = `
      UPDATE empresa
      SET emp_certificada = 1
      WHERE emp_id = ${company}
      LIMIT 1
    `
    const { result: { affectedRows } } = await mysqlLib.query(queryString)
    return Boolean(affectedRows)
  }

  async resetCertificationsForTest() {
    debug('certification->resetCertificationsForTest')
    const query = `
      UPDATE empresa
      SET emp_certificada = 0
      WHERE emp_certificada = 1
    `
    const { result: { affectedRows } } = await mysqlLib.query(query)
    return Boolean(affectedRows)
  }

  async getCertificationDetails(certificationID) {
    debug('certification->getCertificationDetails')
    const query = `
      SELECT c.*,
      e.emp_nombre,
      e.emp_razon_social,
      e.emp_rfc,
      e.emp_website,
      ch.herramienta as "herramienta_proteccion"
      FROM certificaciones AS c
      JOIN empresa AS e ON e.emp_id = c.empresa_id
      JOIN certificaciones_herramienta AS ch ON ch.herramienta_id = c.herramienta_proteccion_id
      WHERE c.certificacion_id = ${certificationID}
    `
    const { result: resultCertificationRaw } = await mysqlLib.query(query)
    const [certification] = resultCertificationRaw
    if (!certification) return null

    const queryRelatedCompanies = `
      SELECT cer.nombre, cer.razon_social, cp.nombre as 'pais'
      FROM certificaciones_empresas_relacionadas AS cer
      JOIN certificaciones_pais AS cp USING(pais_id)
      WHERE cer.certificacion_id = ${certificationID}
    `
    const { result: resultCompanies } = await mysqlLib.query(queryRelatedCompanies)

    const queryProperties = `
      SELECT * FROM certificaciones_inmueble WHERE certificacion_id = ${certificationID}
    `
    const { result: resultProperties } = await mysqlLib.query(queryProperties)

    const queryReferences = `
      SELECT crc.nombre, crc.empresa, crc.correo, crc.telefono, cp.nombre AS "pais"
      FROM certificaciones_referencias_comerciales AS crc
      JOIN certificaciones_pais AS cp USING(pais_id)
      WHERE certificacion_id = ${certificationID}
    `
    const { result: resultReferences } = await mysqlLib.query(queryReferences)

    const queryRepresentatives = `
      SELECT nombre, directivo, consejo, inversionista, accionista, porcentaje FROM certificaciones_representantes WHERE certificacion_id = ${certificationID}
    `
    const { result: resultRepresentatives } = await mysqlLib.query(queryRepresentatives)

    certification.empresas_relacionadas = resultCompanies
    certification.inmuebles = resultProperties
    certification.referencias_comerciales = resultReferences
    certification.representates_legales = resultRepresentatives

    const { empresa_id: companyID } = certification

    const queryCompanyAndUserDetails = `
      select
      CONCAT(u.usu_nombre, u.usu_app) AS "contactName",
      u.usu_email AS "mail",
      e.emp_nombre AS "name", e.emp_rfc AS "rfc"
      from empresa_usuario as eu
      join empresa as e using(emp_id)
      join usuario as u using(usu_id)
      where emp_id = ${companyID}
      and eu.tipo = 1 
    `
    const { result: companyAndUserDetailsRaw } = await mysqlLib.query(queryCompanyAndUserDetails)
    const [companyAndUserDetails] = companyAndUserDetailsRaw

    const queryAddress = `
      select
      d.direccion, d.domicilio_id,
      p.nombre as 'pais'
      from domicilio as d
      join estado as e using(estado_id)
      join pais_translate as p using(pais_id)
      WHERE p.idioma_id = 1 AND d.emp_id = ${companyID} AND d.domicilio_tipo = 1
    `
    const { result: resultAddressRaw } = await mysqlLib.query(queryAddress)
    const [resultAddress] = resultAddressRaw
    const { domicilio_id: domicilioID } = resultAddress

    const queryPhone = `
      select numero from telefono
      where domicilio_id = ${domicilioID} limit 1
    `
    const { result: resultPhoneRaw } = await mysqlLib.query(queryPhone)
    const [resultPhone] = resultPhoneRaw
    let numero = null
    if (resultPhone) {
      numero = resultPhone.numero
    }

    const basica = {
      id: certificationID,
      ...companyAndUserDetails,
      address: resultAddress.direccion,
      country: resultAddress.pais,
      phone: numero
    }

    const response = {
      basica,
      complete: certification
    }

    return response
  }

  async getCompanyPhone(companyID) {
    debug('certification->getCompanyPhone')
    const queryAddress = `
      select *
      from domicilio
      where emp_id = ${companyID} and domicilio_tipo = 1
    `
    const { result: resultAddressRaw } = await mysqlLib.query(queryAddress)
    const [resultAddress] = resultAddressRaw
    if (!resultAddress) return null
    const { domicilio_id: domicilioID } = resultAddress

    const queryPhone = `
      select numero from telefono
      where domicilio_id = ${domicilioID} limit 1
    `
    debug(queryPhone)
    const { result: resultPhoneRaw } = await mysqlLib.query(queryPhone)
    const [resultPhone] = resultPhoneRaw
    let numero = null
    if (resultPhone) {
      numero = resultPhone.numero
    }
    return numero
  }

  async insertFinancialRecord(certificacionID, financialData) {
    const { seccion, fecha, periodo_activo, periodo_pasivo, unidad_neta, ventas, capital, divisa, expresado_en } = financialData;
    const queryString = `
      INSERT INTO certificaciones_partidad_financieras 
        (certificacion_id, seccion, fecha, periodo_activo, periodo_pasivo, unidad_neta, ventas, capital, divisa, expresado_en) 
      VALUES 
        (${certificacionID}, ${seccion}, '${fecha}', ${periodo_activo}, ${periodo_pasivo}, ${unidad_neta}, ${ventas}, ${capital}, '${divisa}', '${expresado_en}')
    `;
    await mysqlLib.query(queryString);
  }

  async updateFinancialRecord(certificacion_id, financialData) {
    const { seccion, fecha, periodo_activo, periodo_pasivo, unidad_neta, ventas, capital, divisa, expresado_en } = financialData;
    const queryString = `
    UPDATE certificaciones_partidad_financieras 
    SET seccion = ${seccion}, 
        periodo_activo = ${periodo_activo}, 
        periodo_pasivo = ${periodo_pasivo}, 
        unidad_neta = ${unidad_neta}, 
        ventas = ${ventas},
        capital = ${capital},
        fecha = '${fecha}',
        divisa = '${divisa}',
        expresado_en = '${expresado_en}'
    WHERE certificacion_id = ${certificacion_id}
  `;
    await mysqlLib.query(queryString);
  }

  async getFinancialRecord(certificacionID) {
    const queryString = `
      SELECT * FROM certificaciones_partidad_financieras
      WHERE certificacion_id = ${certificacionID}
    `;
    const result = await mysqlLib.query(queryString);
    return result;
  }

  async insertDocument(certificationID, body, rutaArchivo) {
    // Extraer los datos del cuerpo de la solicitud
    const { nombreArchivo, fechaVigenciaArchivo, sizeArchivo } = body;

    // Formatear la fecha de vencimiento a formato de MySQL (YYYY-MM-DD)
    const fechaVigenciaMySQL = new Date(fechaVigenciaArchivo).toISOString().slice(0, 10);

    // Lógica de inserción
    const insertQuery = `
        INSERT INTO certificaciones_documentos 
        (certificacion_id, nombre_documento, ruta, vencimiento, status, peso) 
        VALUES 
        (${certificationID}, '${nombreArchivo}', '${rutaArchivo}', '${fechaVigenciaMySQL}', 'pendiente', ${sizeArchivo})
    `;

    // Ejecutar la consulta de inserción en la base de datos
    await mysqlLib.query(insertQuery);
  }

  async createCertificationDocument(body, rutaArchivo) {

    try {
      logger.info(`Parametros de entrada del metodo  createCertificationDocument(): ${JSON.stringify(body)}, ${rutaArchivo}`);
      // Verificar si existe un registro en la tabla certificaciones con los IDs proporcionados
      const certificationExistsQuery = `
          SELECT certificacion_id
          FROM certificaciones
          WHERE empresa_id = ${body.empresa}
      `;
      const certificationExistsResult = await mysqlLib.query(certificationExistsQuery);
      logger.info(`Valida sí existe certificación: ${JSON.stringify(certificationExistsResult)}`);

      let certificationID;

      // Si existe un registro de certificación con los IDs proporcionados
      if (certificationExistsResult.result.length > 0) {
        certificationID = certificationExistsResult.result[0].certificacion_id;
        logger.info(`Genera el ID de la certificación: ${certificationID}`);
      } else {
        // Insertar un nuevo registro de certificación y obtener el certificacion_id generado
        const createCertificationQuery = `
              INSERT INTO certificaciones (empresa_id)
              VALUES (${body.empresa})
          `;
        const createCertificationResult = await mysqlLib.query(createCertificationQuery);
        logger.info(`Certificación creada: ${JSON.stringify(createCertificationResult)}`);
        certificationID = createCertificationResult.insertId;
      }

      // Insertar el documento en la tabla certificaciones_documentos
      // Extraer los datos del cuerpo de la solicitud
      const { nombreArchivo, fechaVigenciaArchivo, sizeArchivo } = body;

      // Formatear la fecha de vencimiento a formato de MySQL (YYYY-MM-DD)
      const fechaVigenciaMySQL = new Date(fechaVigenciaArchivo).toISOString().slice(0, 10);

      // Lógica de inserción del documento
      const insertDocumentQuery = `
          INSERT INTO certificaciones_documentos 
          (certificacion_id, nombre_documento, ruta, vencimiento, status, peso) 
          VALUES 
          (${certificationID}, '${nombreArchivo}', '${rutaArchivo}', '${fechaVigenciaMySQL}', 'pendiente', ${sizeArchivo})
      `;
      await mysqlLib.query(insertDocumentQuery);
    } catch (error) {
      logger.error(`Error al realizar el proceso de inserción de certificación de  documento pdf: ${JSON.stringify(error)}`);
    }
  }

  async getIndustries() {
    const queryString = `
      SELECT id_cat_sector_riesgo_sectorial AS industria_id,
      nombre AS clave,
      nombre_arcsa
      FROM cat_sector_riesgo_sectorial_algoritmo
      ORDER BY nombre ASC;
    `;
    const result = await mysqlLib.query(queryString);
    return result;
  }

  async getPaises(tipo) {
    const queryString = `
       SELECT
       id,
      CASE 
        WHEN ${tipo} = 1 THEN pais_es
        WHEN ${tipo} = 2 THEN pais_en
      END AS pais
    FROM cat_pais;
    `;
    const result = await mysqlLib.query(queryString);
    return result
  }

  async getPaisesAlgoritmo() {
    const queryString = `
      SELECT
        id_pais_algoritmo,
        nombre,
        valor_algoritmo
      FROM cat_pais_algoritmo
      ORDER BY valor_algoritmo ASC;
    `;
    const result = await mysqlLib.query(queryString);
    return result;
  }

  async getDenominaciones() {
    const queryString = `
      SELECT
        id,
        denominacion
      FROM cat_denominacion
      ORDER BY denominacion ASC;
    `;
    const result = await mysqlLib.query(queryString);
    return result;
  }

  async getPuestos() {
    const queryString = `
      SELECT
        id,
        puesto
      FROM cat_puesto
      ORDER BY puesto ASC;
    `;
    const result = await mysqlLib.query(queryString);
    return result;
  }

  async getPoderes() {
    const queryString = `
      SELECT
        id,
        poder
      FROM cat_poder
      ORDER BY poder ASC;
    `;
    const result = await mysqlLib.query(queryString);
    return result;
  }

  async getBienesAsegurados() {
    const queryString = `
      SELECT
        id,
        bien_asegurado
      FROM cat_bien_asegurado
      ORDER BY bien_asegurado ASC;
    `;
    const result = await mysqlLib.query(queryString);
    return result;
  }

  async getSectorRiesgoSectorialAlgoritmo() {
    const queryString = `
      SELECT
        id_cat_sector_riesgo_sectorial,
        nombre,
        nombre_arcsa,
        valor_algoritmo
      FROM cat_sector_riesgo_sectorial_algoritmo
      ORDER BY nombre ASC;
    `;
    const result = await mysqlLib.query(queryString);
    return result;
  }

  async getSectorClientesFinalesAlgoritmo() {
    const queryString = `
      SELECT
        id_cat_sector_clientes_finales,
        nombre,
        nombre_arcsa,
        valor_algoritmo
      FROM cat_sector_clientes_finales_algoritmo
      ORDER BY valor_algoritmo ASC;
    `;
    const result = await mysqlLib.query(queryString);
    return result;
  }

  async getTiempoActividadComercialAlgoritmo() {
    const queryString = `
      SELECT
        id_cat_tiempo_actividad_comercial,
        nombre,
        valor_algoritmo,
        limite_inferior,
        limite_superior
      FROM cat_tiempo_actividad_comercial_algoritmo
      ORDER BY valor_algoritmo ASC;
    `;
    const result = await mysqlLib.query(queryString);
    return result;
  }

  async getDirectores(id_certification) {
    const queryString = `
    SELECT
      cd.id_certification,
      cd.nombre,
      cpu.puesto AS puesto_nombre, -- Obtiene el nombre del puesto desde cat_puesto
      cd.puesto AS id_puesto,      -- Mantiene el ID del puesto
      cpo.poder AS poder_nombre,   -- Obtiene el nombre del poder desde cat_poder
      cd.poder AS id_poder         -- Mantiene el ID del poder
    FROM certification_directores AS cd
    LEFT JOIN cat_puesto AS cpu 
      ON cpu.id = cd.puesto       -- Relacionamos correctamente puesto con su ID
    LEFT JOIN cat_poder AS cpo 
      ON cpo.id = cd.poder        -- Relacionamos correctamente poder con su ID
    WHERE cd.id_certification = ${id_certification};
    `;
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getEstructuraPersonal(id_certification) {
    const queryString = `
    SELECT
      *
    FROM certification_estructura_personal
    WHERE id_certification = ${id_certification};
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getEquipoTransporte(id_certification) {
    const queryString = `
    SELECT
      *
    FROM certification_equipo_transporte
    WHERE id_certification = ${id_certification};
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getSeguros(id_certification) {
    const queryString = `
    SELECT
      cs.id_certification,
      cs.nombre_aseguradora,
      cs.bien_asegurado AS id_bien_asegurado,
      cba.bien_asegurado
    FROM certification_seguros AS cs
    LEFT JOIN cat_bien_asegurado AS cba ON cba.id = cs.bien_asegurado
    WHERE cs.id_certification = ${id_certification};  
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getDemandas(id_certification) {
    const queryString = `
    SELECT
      *
    FROM certification_demandas
    WHERE id_certification = ${id_certification};
    `
    const result = await mysqlLib.query(queryString)
    return result
  }


  async insertDemandas(body, id_certification) {
    const { tipo_demanda, fecha_demanda, comentarios, demandante, entidad, juzgado } = body;
    const queryString = `
      INSERT INTO certification_demandas 
        (id_certification,
        tipo_demanda,
        fecha_demanda,
        comentarios,
        demandante,
        entidad,
        juzgado
        ) 
      VALUES 
        (${id_certification},
        '${tipo_demanda}',
        '${fecha_demanda}',
        '${comentarios}',
        '${demandante}',
        '${entidad}',
        '${juzgado}');
    `;
    const result = await mysqlLib.query(queryString);
    return result;
  }

  async insertEmpresasRel(id, body) {
    const { razon_social, pais } = body
    const queryString = `
    INSERT INTO certification_empresas_relacionadas
      (id_certification,
      razon_social,
      pais
      )
    VALUES
      (${id},
      '${razon_social}',
      '${pais}')
  `
    const result = await mysqlLib.query(queryString)
    return result
  }

  async iniciaCertification(body) {
    const { id_empresa,
      id_usuario,
      id_pais,
      nrp,
      industria_id,
      id_cat_sector_riesgo_sectorial,
      id_cat_sector_clientes_finales,
      plantilla_laboral,
      id_cat_tiempo_actividad_comercial,
      _69b,
      representante_legal,
      denominacion,
      ventas_gobierno } = body
    const queryString = `
      INSERT INTO certification 
          (id_empresa,
          id_usuario,
          id_pais,
          nrp,
          industria_id,
          id_cat_sector_riesgo_sectorial,
          id_cat_sector_clientes_finales,
          plantilla_laboral,
          id_cat_tiempo_actividad_comercial,
          _69b,
          representante_legal,
          denominacion,
          ventas_gobierno) 
      VALUES 
          (${id_empresa},
          ${id_usuario},
          ${id_pais},
          '${nrp !== undefined ? nrp : null}',  
          ${industria_id !== undefined ? industria_id : null},  
          ${id_cat_sector_riesgo_sectorial !== undefined ? id_cat_sector_riesgo_sectorial : null},  
          ${id_cat_sector_clientes_finales !== undefined ? id_cat_sector_clientes_finales : null},  
          ${plantilla_laboral},
          ${id_cat_tiempo_actividad_comercial},
          '${_69b !== undefined ? _69b : ''}',  
          '${representante_legal !== undefined ? representante_legal : ''}',  
          '${denominacion !== undefined ? denominacion : ''}',  
          '${ventas_gobierno !== undefined ? ventas_gobierno : ''}');  
  `;

    // Asegúrate de que todos los valores que se insertan sean seguros para evitar inyección SQL.

    const result = await mysqlLib.query(queryString);
    return result;
  }

  async insertDomicilioFiscal(id_empresa, tipo, data) {
    const { calle,
      numero,
      ciudad,
      estado,
      codigo_postal,
      pais } = data
    const queryString = `
      INSERT INTO domicilio 
        (emp_id,
        domicilio_tipo,
        calle,
        numero,
        ciudad,
        estado,
        codigo_postal,
        pais
        ) 
      VALUES 
        (${id_empresa},
        ${tipo},
        '${calle}',
        '${numero}',
        '${ciudad}',
        '${estado}',
        '${codigo_postal}',
        ${pais});
    `;
    const { result } = await mysqlLib.query(queryString);
    return result;
  }

  async updateEmpresaInfo(body) {
    const { id_empresa, razon_social, rfc, pagina_web, denominacion } = body

    const queryString = `
    UPDATE empresa
    SET
    emp_rfc = '${rfc}',
    emp_website = '${pagina_web}',
    emp_razon_social = '${razon_social}',
    denominacion = '${denominacion}'
    WHERE
    emp_id = ${id_empresa};
    `;
    const result = await mysqlLib.query(queryString)
    return result
  }

  async consultaVariacionSignificativa() {
    const queryString = `
    SELECT
    *
    FROM cat_variaciones_significativas;
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async consultaEmpresaInfo(id_emp) {
    const queryString = `
    SELECT
    emp_rfc,
    emp_website,
    emp_razon_social,
    denominacion,
    emp_nombre,
    contador_konesh,
    valores
    FROM empresa
    WHERE emp_id = ${id_emp};
    `;
    const result = await mysqlLib.query(queryString)
    return result
  }

  async consultaEmpresaPerfil(id_emp) {
    const queryString = `
      SELECT 
        e.emp_id,
        e.giro,
        e.valores,
        e.proposito,
        et.emp_desc,
        et.emp_mision,
        et.emp_vision
      FROM empresa e
      JOIN empresa_translate et ON e.emp_id = et.emp_id
      WHERE e.emp_id = ${id_emp};
    `;
    const result = await mysqlLib.query(queryString)
    return result
  }

  async consultaDireccionFiscal(id_emp) {
    const queryString = `
    SELECT
    *
    FROM domicilio
    WHERE emp_id = ${id_emp}  AND domicilio_tipo = 3
    ORDER BY domicilio_id DESC
    LIMIT 1;
    `;
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async updateDomicilioCertificacion(body) {
    const { id_empresa, id_estado, tipo_direccion, direccion_fiscal } = body;

    // Verifica si hay un domicilio tipo 3
    const checkQueryString = `
        SELECT COUNT(*) AS count
        FROM domicilio
        WHERE emp_id = ${id_empresa} AND domicilio_tipo = 3
    `;
    const checkResult = await mysqlLib.query(checkQueryString);
    const count = checkResult.result[0].count;

    if (count > 0) {
      // Sí existe un domicilio tipo 3 este se actualiza con la informacion que viene
      const updateQueryString = `
            UPDATE domicilio
            SET
                estado_id = '${id_estado}',
                domicilio_tipo = '3',
                direccion = '${direccion_fiscal}'
            WHERE
                emp_id = ${id_empresa} AND domicilio_tipo = 3;
        `;
      const result = await mysqlLib.query(updateQueryString);
      return result;
    } else {
      // No existe un domicillio tipo 3 se inserta uno nuevo
      const insertQueryString = `
        INSERT INTO domicilio (emp_id, domicilio_tipo, estado_id, direccion)
        VALUES (${id_empresa}, 3, '${id_estado}', '${direccion_fiscal}');
        `;

      const result = await mysqlLib.query(insertQueryString);
      return result;
    }
  }

  async insertaAccionista(insertIdCert, accionista) {
    const queryString = `
      INSERT INTO certification_accionistas
        (id_certification, razon_social, denominacion, rfc, controlante, conteo_error_rfc, razon_sat_rfc)
      VALUES
        (${insertIdCert}, '${accionista.razon_social}', ${accionista.denominacion}, '${accionista.rfc}', ${accionista.controlante}, ${accionista.conteo_error_rfc ?? null}, ${mysqlLib.escape(accionista.razon_sat_rfc)})
    `;
    const result = await mysqlLib.query(queryString);
    return result;
  }


  async insertDirectores(director, idcertification) {
    const { nombre, puesto, poder } = director
    const queryString = `
      INSERT INTO certification_directores 
        (id_certification, nombre, puesto, poder ) 
      VALUES 
        (${idcertification}, '${nombre}', ${puesto}, ${poder})
    `;
    const result = await mysqlLib.query(queryString);
    return result;
  }

  async insertEstructuraPersonal(personal, idcertification) {
    const { personal_operativo, personal_administrativo, personal_directivo } = personal
    const queryString = `
      INSERT INTO certification_estructura_personal 
        (id_certification, personal_operativo, personal_administrativo, personal_directivo ) 
      VALUES 
        (${idcertification}, ${personal_operativo}, ${personal_administrativo}, ${personal_directivo} )
    `;
    const result = await mysqlLib.query(queryString);
    return result;
  }

  async insertEquipoTransporte(equipo_trasporte, idcertification) {
    const { flotilla_transporte_carga_transporte_especializado, flotilla_otros_vehiculos } = equipo_trasporte
    const queryString = `
      INSERT INTO certification_equipo_transporte
        (id_certification, flotilla_carga_especializado, flotilla_otros_vehiculos ) 
      VALUES 
        (${idcertification}, ${flotilla_transporte_carga_transporte_especializado}, ${flotilla_otros_vehiculos} )
    `;
    const result = await mysqlLib.query(queryString);
    return result;
  }


  async insertSeguros(seguro, idcertification) {
    const { nombre_aseguradora, bien_asegurado } = seguro
    const queryString = `
      INSERT INTO certification_seguros 
        (id_certification, nombre_aseguradora, bien_asegurado ) 
      VALUES 
        (${idcertification}, '${nombre_aseguradora}', ${bien_asegurado} )
    `;
    const result = await mysqlLib.query(queryString);
    return result;
  }

  async getTipoCifrasAlgoritmo() {
    const queryString = `
      SELECT
        id_cat_tipo_cifras,
        nombre,
        valor_algoritmo
      FROM cat_tipo_cifras_algoritmo
      ORDER BY valor_algoritmo ASC;
    `;
    const result = await mysqlLib.query(queryString);
    return result;
  }

  async getAllAlgorithmRanges() {
    const tables = [
      'cat_pais_algoritmo',
      'cat_sector_riesgo_sectorial_algoritmo',
      'cat_sector_clientes_finales_algoritmo',
      'cat_tiempo_actividad_comercial_algoritmo',
      'cat_plantilla_laboral_algoritmo',
      'cat_ventas_anuales_algoritmo',
      'cat_apalancamiento_algoritmo',
      'cat_flujo_neto_caja_algoritmo',
      'cat_capital_contable_algoritmo',
      'cat_incidencias_legales_algoritmo',
      'cat_influencia_controlante_algoritmo',
      'cat_influencia_controlante',
      'cat_resultado_referencias_proveedores_algoritmo',
      'cat_payback_algoritmo',
      'cat_rotacion_cuentas_cobrar_algoritmo',
      'cat_tipo_cifras_algoritmo',
      'cat_evolucion_ventas_algoritmo',
      'cat_score_descripcion_algoritmo'
    ];

    const results = {};

    for (const table of tables) {
      try {
        const queryString = `SELECT * FROM ${table};`;
        const { result } = await mysqlLib.query(queryString);
        results[table] = result;
      } catch (error) {
        logger.error(`Error fetching ranges for table ${table}: ${error.message}`);
        results[table] = [];
      }
    }

    return results;
  }


  async getCertificacion(id_certification) {
    const queryString = `
      SELECT
        id_certification
      FROM certification
      WHERE id_certification = ${id_certification};
    `;
    const result = await mysqlLib.query(queryString);
    return result;
  }

  async partidasEstadoBalancePrevioAnterior(id_certification) {
    const queryString = `
     SELECT
        cpeb.id_tipo_cifra,
        cpeb.tipo AS tipo_partida_estado_balance,
        cpeb.caja_bancos AS caja_bancos_estado_balance,
        cpeb.saldo_cliente_cuenta_x_cobrar AS saldo_cliente_cuenta_x_cobrar_estado_balance,
        cpeb.saldo_inventarios AS saldo_inventarios_estado_balance,
        cpeb.deuda_corto_plazo AS deuda_corto_plazo_estado_balance,
        cpeb.deuda_total AS deuda_total_estado_balance,
        cpeb.capital_contable AS capital_contable_estado_balance,
        cpeb.periodo_actual,
        cpeb.periodo_anterior,
        cpeb.periodo_previo_anterior
      FROM certification_partidas_estado_balance AS cpeb
      WHERE cpeb.id_certification = ${id_certification} AND cpeb.tipo = 'previo_anterior';
    `;
    const result = await mysqlLib.query(queryString);
    return result;
  }

  async getDatosBasicosEmpty(id_certification) {
    const queryString = `
      SELECT
        id_certification,
        CASE
        WHEN 
        id_pais IS NOT NULL
        AND
        id_pais != 'null'
        AND
        representante_legal IS NOT NULL
        AND
        representante_legal != 'null'
        AND
        TRIM(representante_legal) != ''
        AND
        id_cat_tiempo_actividad_comercial IS NOT NULL
        AND
        id_cat_sector_riesgo_sectorial IS NOT NULL
        AND
        id_cat_sector_clientes_finales IS NOT NULL
        AND
        plantilla_laboral IS NOT NULL
        AND
        plantilla_laboral != 'null'
        THEN TRUE
        ELSE FALSE
      END AS completo
      FROM certification
      WHERE id_certification = ${id_certification};
   `
    const result = await mysqlLib.query(queryString);
    return result;
  }

  async getEstadoBalanceEmpty(id_certification) {
    const queryString = `
      SELECT
      id_certification_partidas_estado_balance,
      CASE
      WHEN
      id_certification IS NOT NULL
      AND
      id_certification != '0'
      AND
      tipo IS NOT NULL
      AND
      caja_bancos IS NOT NULL
      AND
      caja_bancos != '0.00'
      AND
      saldo_cliente_cuenta_x_cobrar IS NOT NULL
      AND
      saldo_cliente_cuenta_x_cobrar != '0.00'
      AND
      saldo_inventarios IS NOT NULL
      AND
      saldo_inventarios != '0.00'
      AND
      periodo_actual IS NOT NULL
      AND
      periodo_anterior IS NOT NULL
      AND
      periodo_previo_anterior IS NOT NULL
      THEN TRUE
      ELSE FALSE
      END AS completo
      FROM certification_partidas_estado_balance
      WHERE id_certification =  ${id_certification}
      ORDER BY id_certification_partidas_estado_balance DESC
      LIMIT 2;
   `;
    const result = await mysqlLib.query(queryString);
    return result;
  }

  async getEstadoResultadoEmpty(id_certification) {
    const queryString = `
      SELECT
      id_certification_estado_resultados_contables,
      CASE
      WHEN
      id_certification IS NOT NULL
      AND
      id_certification != 'null'
      AND
      id_certification != '0'
      AND
      compartir IS NOT NULL AND compartir != 'null'
      AND
      tipo IS NOT NULL
      AND
      tipo != 'null'
      AND
      ventas_anuales IS NOT NULL
      AND
      ventas_anuales != 'null'
      AND
      ventas_anuales != '0.00'
      AND
      costo_ventas_anuales IS NOT NULL
      AND
      costo_ventas_anuales != 'null'
      AND
      costo_ventas_anuales != '0.00'
      AND
      utilidad_operativa IS NOT NULL
      AND
      utilidad_operativa != 'null'
      AND
      utilidad_operativa != '0.00'
      AND
      periodo_actual IS NOT NULL
      AND
      periodo_actual != 'null'
      AND
      periodo_anterior IS NOT NULL
      AND
      periodo_anterior != 'null'
      AND
      periodo_previo_anterior IS NOT NULL
      AND
      periodo_previo_anterior != 'null'
      THEN TRUE
      ELSE FALSE
      END AS completo
      FROM certification_partidas_estado_resultados_contables
      WHERE id_certification = ${id_certification}
      ORDER BY id_certification_estado_resultados_contables DESC
      LIMIT 2;
   `;
    const result = await mysqlLib.query(queryString);
    return result;
  }

  async partidasEstadoBalanceAnterior(id_certification) {
    const queryString = `
     SELECT
        cpeb.id_tipo_cifra,
        cpeb.tipo AS tipo_partida_estado_balance,
        cpeb.caja_bancos AS caja_bancos_estado_balance,
        cpeb.saldo_cliente_cuenta_x_cobrar AS saldo_cliente_cuenta_x_cobrar_estado_balance,
        cpeb.saldo_inventarios AS saldo_inventarios_estado_balance,
        cpeb.deuda_corto_plazo AS deuda_corto_plazo_estado_balance,
        cpeb.deuda_total AS deuda_total_estado_balance,
        cpeb.capital_contable AS capital_contable_estado_balance,
        cpeb.periodo_actual,
        cpeb.periodo_anterior,
        cpeb.periodo_previo_anterior
      FROM certification_partidas_estado_balance AS cpeb
      WHERE cpeb.id_certification = ${id_certification} AND cpeb.tipo = 'anterior';
    `
    const result = await mysqlLib.query(queryString)
    return result
  }

  async obtieneCapitalAnterior(id_certification) {
    const queryString = `
    SELECT
       capital_contable AS capital
     FROM certification_partidas_estado_balance
     WHERE id_certification = ${id_certification} AND tipo = 'anterior';
   `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async obtieneCapitalPrevioAnterior(id_certification) {
    const queryString = `
    SELECT
       capital_contable AS capital
     FROM certification_partidas_estado_balance
     WHERE id_certification = ${id_certification} AND tipo = 'previo_anterior';
   `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async obtieneCajaBancosAnterior(id_certification) {
    const queryString = `
     SELECT
        caja_bancos AS caja_bancos
      FROM certification_partidas_estado_balance
      WHERE id_certification = ${id_certification} AND tipo = 'anterior';
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async obtieneCajaBancosPrevioAnterior(id_certification) {
    const queryString = `
     SELECT
        caja_bancos AS caja_bancos
      FROM certification_partidas_estado_balance
      WHERE id_certification = ${id_certification} AND tipo = 'previo_anterior';
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async obtieneInventariosAnterior(id_certification) {
    const queryString = `
     SELECT
        saldo_inventarios AS inventarios
      FROM certification_partidas_estado_balance
      WHERE id_certification = ${id_certification}  AND tipo = 'anterior';
    `;
    const { result } = await mysqlLib.query(queryString);
    return result;
  }

  async obtieneInventariosPrevioAnterior(id_certification) {
    const queryString = `
     SELECT
        saldo_inventarios AS inventarios
      FROM certification_partidas_estado_balance
      WHERE id_certification = ${id_certification}  AND tipo = 'previo_anterior';
    `;
    const { result } = await mysqlLib.query(queryString);
    return result;
  }

  async obtieneClienteCuentasCobrarAnterior(id_certification) {
    const queryString = `
    SELECT
       saldo_cliente_cuenta_x_cobrar AS saldo_cliente_cuenta_x_cobrar
    FROM certification_partidas_estado_balance
     WHERE id_certification = ${id_certification} AND tipo = 'anterior';
   `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async obtieneClienteCuentasCobrarPrevioAnterior(id_certification) {
    const queryString = `
    SELECT
       saldo_cliente_cuenta_x_cobrar AS saldo_cliente_cuenta_x_cobrar
    FROM certification_partidas_estado_balance
     WHERE id_certification = ${id_certification} AND tipo = 'previo_anterior';
   `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async obtenerPartidasFinancieras(id_certification) {
    const queryString = `
      SELECT 
        CASE 
          WHEN (
             SUM(rv.ventas_anuales) + SUM(rv.costo_ventas_anuales) + SUM(rv.utilidad_operativa) + 
             SUM(rv.utilidad_bruta) + SUM(rv.gastos_administracion) + SUM(rv.gastos_productos_financieros) + 
             SUM(rv.depreciacion_amortizacion) + SUM(rv.otros_ingresos) + SUM(rv.otros_egresos) + 
             SUM(rv.otros_gastos) + SUM(rv.utilidad_neta) + 
             SUM(e.caja_bancos) + SUM(e.saldo_cliente_cuenta_x_cobrar) + SUM(e.saldo_inventarios) + 
             SUM(e.deuda_corto_plazo) + SUM(e.deuda_total) + SUM(e.capital_contable) + 
             SUM(e.deudores_diversos) + SUM(e.otros_activos) + SUM(e.otros_activos_fijos_largo_plazo) + 
             SUM(e.total_activo_circulante) + SUM(e.total_activo_fijo) + SUM(e.activo_intangible) + 
             SUM(e.activo_diferido) + SUM(e.total_otros_activos) + SUM(e.activo_total) + 
             SUM(e.proveedores) + SUM(e.acreedores) + SUM(e.inpuestos_x_pagar) + 
             SUM(e.otros_pasivos) + SUM(e.total_pasivo_largo_plazo) + SUM(e.pasivo_diferido) + 
             SUM(e.capital_social) + SUM(e.resultado_ejercicios_anteriores) + 
             SUM(e.resultado_ejercicios) + SUM(e.otro_capital)
         ) = 0 THEN 'false'
         ELSE 'true'
     END AS bandera
    FROM 
        certification_partidas_estado_resultados_contables AS rv
    LEFT JOIN 
        certification_partidas_estado_balance AS e ON rv.id_certification = e.id_certification
    WHERE 
        rv.id_certification = ${id_certification};
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async partidasFinancierasCertificacion(id_certification) {
    const queryString = `
     SELECT
        cpeb.id_tipo_cifra,
        cpeb.tipo AS tipo_partida_estado_balance,
        cperc.tipo AS tipo_partida_estado_resultado,
        cpeb.caja_bancos AS caja_bancos_estado_balance,
        cpeb.saldo_cliente_cuenta_x_cobrar AS saldo_cliente_cuenta_x_cobrar_estado_balance,
        cpeb.saldo_inventarios AS saldo_inventarios_estado_balance,
        cpeb.deuda_corto_plazo AS deuda_corto_plazo_estado_balance,
        cpeb.deuda_total AS deuda_total_estado_balance,
        cpeb.capital_contable AS capital_contable_estado_balance,
        cperc.ventas_anuales AS ventas_anuales_estado_resultado,
        cperc.costo_ventas_anuales AS costo_ventas_anuales_estado_resultado,
        cperc.utilidad_operativa AS utilidad_operativa_estado_resultado,
        cperc.periodo_actual AS periodo_actual_estado_resultado
      FROM certification_partidas_estado_balance AS cpeb
      INNER JOIN certification_partidas_estado_resultados_contables AS cperc ON cperc.id_certification = cpeb.id_certification
      WHERE cpeb.id_certification = ${id_certification};
    `
    const result = await mysqlLib.query(queryString)
    return result
  }

  async getEmpresaClienteByIdCertification(id_referencia) {
    const queryString = `
    SELECT
     *
    FROM certification_empresa_cliente_contacto 
    WHERE id_referencia_comercial = ${id_referencia};
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }


  async getReferenciasComercialesByIdCertificationScore(id_certification) {
    const queryString = `
     SELECT
      crc.id_certification_referencia_comercial,
      crc.razon_social,
      crc.denominacion,
      crc.rfc,
      d.codigo_postal
    FROM certification_referencia_comercial AS crc
    LEFT JOIN domicilio AS d ON d.domicilio_id = crc.id_direccion
    LEFT JOIN certification AS c ON c.id_certification = crc.id_certification
    LEFT JOIN certification_referencia_comercial_external_invitation AS crcei ON crcei.id_referencia = crc.id_certification_referencia_comercial
    WHERE crc.id_certification = ${id_certification}
      AND crc.contestada = 'si'
      AND crc.referencia_valida = 'true'
      AND (crcei.estatus_referencia IS NULL OR crcei.estatus_referencia <> 'vencida')
    ORDER BY crc.id_certification_referencia_comercial DESC;
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getReferenciasComercialesByIdCertification(id_certification) {
    const queryString = `
       SELECT
        crc.id_certification_referencia_comercial,
        crc.razon_social,
        crc.denominacion,
        crc.rfc,
        crc.contestada,
        d.codigo_postal,
        crc.id_pais,
        crcei.estatus_referencia,
        crc.referencia_valida,
        crc.observaciones,
        crc.id_certification_referencia_comercial
      FROM certification_referencia_comercial AS crc
      LEFT JOIN domicilio AS d ON d.domicilio_id = crc.id_direccion
      LEFT JOIN certification AS c ON c.id_certification = crc.id_certification
      LEFT JOIN certification_referencia_comercial_external_invitation AS crcei ON crcei.id_referencia = crc.id_certification_referencia_comercial
      WHERE crc.id_certification = ${id_certification}
      ORDER BY crc.id_certification_referencia_comercial DESC;
      `
    const { result } = await mysqlLib.query(queryString)
    return result
  }
// 
  async getCertificacionPartidaFinanciera(id_certification) {
    const queryString = `
     SELECT
        cpeb.id_certification,
        cpeb.id_tipo_cifra,
        cpeb.compartir AS compartir_estado_balance,
        cpeb.compartir_info_empresa,
        cpeb.tipo AS tipo_periodo_estado_balance,
        cpeb.caja_bancos,
        cpeb.saldo_cliente_cuenta_x_cobrar,
        cpeb.saldo_inventarios,
        cpeb.deuda_corto_plazo,
        cpeb.deuda_total,
        cpeb.capital_contable,
        cpeb.deudores_diversos,
        cpeb.otros_activos,
        cpeb.otros_activos_fijos_largo_plazo,
        cpeb.total_activo_circulante,
        cpeb.total_activo_fijo,
        cpeb.activo_intangible,
        cpeb.activo_diferido,
        cpeb.total_otros_activos,
        cpeb.activo_total,
        cpeb.proveedores,
        cpeb.acreedores,
        cpeb.inpuestos_x_pagar,
        cpeb.otros_pasivos,
        cpeb.total_pasivo_circulante,
        cpeb.total_pasivo_largo_plazo,
        cpeb.pasivo_diferido,
        cpeb.capital_social,
        cpeb.resultado_ejercicios_anteriores,
        cpeb.resultado_ejercicios,
        cpeb.otro_capital,
        cpeb.total_capital_contable_pat,
        cpeb.periodo_actual AS perioro_actual_estado_balance,
        cpeb.periodo_anterior AS perioro_anterior_estado_balance,
        cpeb.periodo_previo_anterior AS perioro_previo_anterior_estado_balance,
        cperc.tipo AS tipo_periodo_estado_resultados,
        cperc.compartir AS compartir_estado_resultados,
        cperc.ventas_anuales,
        cperc.costo_ventas_anuales,
        cperc.utilidad_operativa,
        cperc.utilidad_bruta,
        cperc.gastos_administracion,
        cperc.gastos_productos_financieros,
        cperc.depreciacion_amortizacion,
        cperc.otros_ingresos,
        cperc.otros_egresos,
        cperc.otros_gastos,
        cperc.utilidad_neta,
        cperc.periodo_actual,
        cperc.periodo_anterior,
        cperc.periodo_previo_anterior,
        cperc.periodo_actual AS perioro_actual_estado_resultados,
        cperc.periodo_anterior AS perioro_anterior_estado_resultados,
        cperc.periodo_previo_anterior AS perioro_previo_anterior_estado_resultados
      FROM certification_partidas_estado_balance AS cpeb
      INNER JOIN certification_partidas_estado_resultados_contables AS cperc
        ON cperc.id_certification = cpeb.id_certification
        AND cperc.tipo = cpeb.tipo
      WHERE cpeb.id_certification = ${id_certification}
      ORDER BY cpeb.id_certification_partidas_estado_balance DESC;
    `;
    const result = await mysqlLib.query(queryString)
    return result
  }

  /* 
  SELECT 
    crc.*, 
    cecc.*
      FROM 
    certification_referencia_comercial crc
      INNER JOIN 
    certification_empresa_cliente_contacto cecc
    ON crc.id_certification_referencia_comercial = cecc.id_referencia_comercial
      WHERE 
    crc.id_certification = ${id_certification} AND contestada = 'si'
  */

  async getCertificacionReferenciasComerciales(id_certification) {
    const queryString = `
    SELECT 
    crc.*, 
    cecc.*
      FROM 
    certification_referencia_comercial crc
      INNER JOIN 
    certification_empresa_cliente_contacto cecc
    ON crc.id_certification_referencia_comercial = cecc.id_referencia_comercial
      INNER JOIN 
    certification_referencia_comercial_external_invitation crcei
    ON crcei.id_referencia = crc.id_certification_referencia_comercial
      WHERE 
    crc.id_certification = ${id_certification}
    AND crc.contestada = 'si'
    AND crc.referencia_valida = 'true'
    AND crcei.estatus_referencia = 'vigente'
      `;
    const result = await mysqlLib.query(queryString);
    return result;
  }

  async getReporteCredito(id_certification) {
    const queryString = `
     SELECT
       *
      FROM reporte_credito
      WHERE id_certification = ${id_certification}
      ORDER BY id DESC
      LIMIT 1;
    `;
    const result = await mysqlLib.query(queryString);
    return result
  }

  async getPrincipalesClientes(id_certification) {
    const queryString = `
    SELECT
      cpc.id_principales_clientes,
      cpc.id_certification,
      cpc.razon_social,
      cpc.denominacion AS id_denominacion,
      cd.denominacion,
      cpc.anios_relacion,
      cpc.pais AS id_pais,
      csrsa.nombre AS sector,  -- Reemplazamos el ID del sector con su nombre
      cp.pais_es AS pais,
      cpc.sector AS id_sector
    FROM certification_principales_clientes AS cpc
    LEFT JOIN cat_pais AS cp
      ON cp.id = cpc.pais
    LEFT JOIN cat_denominacion AS cd
      ON cd.id = cpc.denominacion
    LEFT JOIN cat_sector_riesgo_sectorial_algoritmo AS csrsa
      ON csrsa.id_cat_sector_riesgo_sectorial = cpc.sector  -- Relacionamos el sector con su nombre
    WHERE cpc.id_certification = ${id_certification};
    `;
    const { result } = await mysqlLib.query(queryString);
    return result
  }

  async getEstructuraVentas(id_certification) {
    const queryString = `
     SELECT
       *
      FROM certification_estructura_ventas
      WHERE id_certification = ${id_certification};
    `;
    const { result } = await mysqlLib.query(queryString);
    return result
  }

  async getImportaciones(id_certification) {
    const queryString = `
     SELECT
      cie.id_importaciones_exportaciones,
      cie.id_certification,
      cie.pais AS id_pais,
      cp.pais_es AS pais,
      cie.porcentaje,
      cie.tipo
    FROM certification_importaciones_exportaciones AS cie
    LEFT JOIN cat_pais AS cp ON cp.id = cie.pais
    WHERE id_certification = ${id_certification} AND tipo = 'importacion';
    `;
    const { result } = await mysqlLib.query(queryString);
    return result
  }

  async getCalculoEstadoBalance(id_certification) {
    const queryString = `
     SELECT
       *
      FROM certification_calculos_estado_balance
      WHERE id_certification = ${id_certification}
      ORDER BY id_calculo_estado_balance DESC
      LIMIT 1;
    `;
    const { result } = await mysqlLib.query(queryString);
    return result
  }

  async getCalculoEstadoResultado(id_certification) {
    const queryString = `
     SELECT
       *
      FROM certification_calculos_estado_resultado
      WHERE id_certification = ${id_certification}
      ORDER BY id_calculo_estado_resultado DESC
      LIMIT 1;
    `;
    const { result } = await mysqlLib.query(queryString);
    return result
  }

  async getRatiosFnancieros(id_certification) {
    const queryString = `
     SELECT
       *
      FROM certification_ratios_financieros
      WHERE id_certification = ${id_certification}
      ORDER BY id_ratios_financieros DESC
      LIMIT 1;
    `;
    const { result } = await mysqlLib.query(queryString);
    return result
  }

  async getExportaciones(id_certification) {
    const queryString = `
     SELECT
      cie.id_importaciones_exportaciones,
      cie.id_certification,
      cie.pais AS id_pais,
      cp.pais_es AS pais,
      cie.porcentaje,
      cie.tipo
    FROM certification_importaciones_exportaciones AS cie
    LEFT JOIN cat_pais AS cp ON cp.id = cie.pais
    WHERE id_certification = ${id_certification} AND tipo = 'exportacion';
    `;
    const { result } = await mysqlLib.query(queryString);
    return result
  }

  async deleteDocumento(id_documento) {
    const queryString = `
      DELETE FROM certification_documentos
      WHERE id_cert_docs = ${mysqlLib.escape(id_documento)};
    `;
    const result = await mysqlLib.query(queryString);
    return result
  }

  async getPathToDelete(id_documento) {
    const queryString = `
     SELECT
       *
      FROM certification_documentos
      WHERE id_cert_docs = ${id_documento};
    `;
    const result = await mysqlLib.query(queryString);
    return result
  }

  async actualizaDocumento(body) {
    const { id_documento, nombre_documento, ruta, size, fecha_vencimiento, pathActual } = body
    const queryString = `
    UPDATE certification_documentos
    SET 
      nombre_documento = ${mysqlLib.escape(nombre_documento)},
      ruta = ${mysqlLib.escape(ruta)},
      fecha_carga = CURRENT_TIMESTAMP,
      size = ${mysqlLib.escape(size)},
      fecha_vencimiento = ${mysqlLib.escape(fecha_vencimiento)}
    WHERE id_cert_docs = ${mysqlLib.escape(id_documento)};
  `;
    const result = await mysqlLib.query(queryString);
    return result;
  }

  async guardaDocumento(id_empresa, nombre_documento, fecha_vencimiento, size, Location) {
    const queryString = `
      INSERT INTO certification_documentos 
        (id_empresa,
        nombre_documento,
        ruta,
        fecha_vencimiento,
        size) 
      VALUES 
        (${id_empresa},
        '${nombre_documento}',
        '${Location}',
        '${fecha_vencimiento}',
        '${size}');
    `;
    const result = await mysqlLib.query(queryString);
    return result;
  }

  async getDocumentosByIdEmpresa(id_empresa) {
    const queryString = `
     SELECT
       *
      FROM certification_documentos
      WHERE id_empresa = ${id_empresa}
      ORDER BY nombre_documento DESC;
    `;
    const result = await mysqlLib.query(queryString);
    return result;
  }

  async saveImportacionesExportaciones(id_certification, tipo, data) {
    const { pais, porcentaje } = data
    const queryString = `
      INSERT INTO certification_importaciones_exportaciones
        (id_certification,
         pais,
         porcentaje,
         tipo
       ) 
      VALUES 
        (${id_certification},
         ${pais},
         ${porcentaje},
         '${tipo}' )
    `;

    const result = await mysqlLib.query(queryString);

    if (result.result.affectedRows > 0) {
      return { success: true, message: 'Inserción exitosa' };
    } else {
      return { success: false, message: 'No se pudo insertar el registro' };
    }
  }

  async saveEstructuraVentas(id_certification, data) {
    const { porcentaje_credito_total_ventas, porcentaje_contado_total_ventas, porcentaje_ventas_gobierno } = data
    const queryString = `
      INSERT INTO certification_estructura_ventas
        (id_certification,
         porcentaje_credito_total_ventas,
         porcentaje_contado_total_ventas,
         porcentaje_ventas_gobierno
       ) 
      VALUES 
        (${id_certification},
         ${porcentaje_credito_total_ventas},
         ${porcentaje_contado_total_ventas},
         ${porcentaje_ventas_gobierno} )
    `;

    const result = await mysqlLib.query(queryString);

    if (result.result.affectedRows > 0) {
      return { success: true, message: 'Inserción exitosa' };
    } else {
      return { success: false, message: 'No se pudo insertar el registro' };
    }
  }


  async savePrincipalesClientes(id_certification, data) {
    const { razon_social, denominacion, anios_relacion, pais, sector } = data
    const queryString = `
      INSERT INTO certification_principales_clientes
        (id_certification,
        razon_social,
        denominacion,
        anios_relacion,
        pais,
        sector
       ) 
      VALUES 
        (${id_certification},
        '${razon_social}',
        '${denominacion}',
        ${anios_relacion},
        ${pais},
        ${sector})
    `;

    const result = await mysqlLib.query(queryString);

    if (result.result.affectedRows > 0) {
      return { success: true, message: 'Inserción exitosa' };
    } else {
      return { success: false, message: 'No se pudo insertar el registro' };
    }
  }

  async insertPEBPCA(body) {
    const queryString = `
      INSERT INTO certification_partidas_estado_balance 
        (id_certification,
        id_tipo_cifra,
        compartir,
        compartir_info_empresa,
        tipo,
        caja_bancos,
        saldo_cliente_cuenta_x_cobrar,
        saldo_inventarios,
        deuda_corto_plazo,
        deuda_total,
        capital_contable,
        deudores_diversos,
        otros_activos,
        otros_activos_fijos_largo_plazo,
        total_activo_circulante,
        total_activo_fijo,
        activo_intangible,
        activo_diferido,
        total_otros_activos,
        activo_total,
        proveedores,
        acreedores,
        inpuestos_x_pagar,
        otros_pasivos,
        total_pasivo_circulante,
        total_pasivo_largo_plazo,
        otros_pasivos_largo_plazo,
        suma_pasivo_largo_plazo,
        pasivo_diferido,
        capital_social,
        resultado_ejercicios_anteriores,
        resultado_ejercicios,
        otro_capital,
        total_capital_contable_pat,
        periodo_actual,
        periodo_anterior,
        periodo_previo_anterior)
      VALUES
        (${body.id_certification},
        ${body.id_tipo_cifra ?? null},
        '${body.compartir}',
        ${body.compartir_info_empresa ?? null},
        'anterior',
        ${body.partida_estado_balance_periodo_contable_anterior.caja_bancos ?? null},
        ${body.partida_estado_balance_periodo_contable_anterior.saldo_cliente_cuenta_x_cobrar ?? null},
        ${body.partida_estado_balance_periodo_contable_anterior.saldo_inventarios ?? null},
        ${body.partida_estado_balance_periodo_contable_anterior.deuda_corto_plazo ?? null},
        ${body.partida_estado_balance_periodo_contable_anterior.deuda_total ?? null},
        ${body.partida_estado_balance_periodo_contable_anterior.capital_contable ?? null},
        ${body.partida_estado_balance_periodo_contable_anterior.deudores_diversos ?? null},
        ${body.partida_estado_balance_periodo_contable_anterior.otros_activos ?? null},
        ${body.partida_estado_balance_periodo_contable_anterior.otros_activos_fijos_largo_plazo ?? null},
        ${body.partida_estado_balance_periodo_contable_anterior.total_activo_circulante ?? null},
        ${body.partida_estado_balance_periodo_contable_anterior.total_activo_fijo ?? null},
        ${body.partida_estado_balance_periodo_contable_anterior.activo_intangible ?? null},
        ${body.partida_estado_balance_periodo_contable_anterior.activo_diferido ?? null},
        ${body.partida_estado_balance_periodo_contable_anterior.total_otros_activos ?? null},
        ${body.partida_estado_balance_periodo_contable_anterior.activo_total ?? null},
        ${body.partida_estado_balance_periodo_contable_anterior.proveedores ?? null},
        ${body.partida_estado_balance_periodo_contable_anterior.acreedores ?? null},
        ${body.partida_estado_balance_periodo_contable_anterior.inpuestos_x_pagar ?? null},
        ${body.partida_estado_balance_periodo_contable_anterior.otros_pasivos ?? null},
        ${body.partida_estado_balance_periodo_contable_anterior.total_pasivo_circulante ?? null},
        ${body.partida_estado_balance_periodo_contable_anterior.total_pasivo_largo_plazo ?? null},
        ${body.partida_estado_balance_periodo_contable_anterior.otros_pasivos_largo_plazo ?? null},
        ${body.partida_estado_balance_periodo_contable_anterior.suma_pasivo_largo_plazo ?? null},
        ${body.partida_estado_balance_periodo_contable_anterior.pasivo_diferido ?? null},
        ${body.partida_estado_balance_periodo_contable_anterior.capital_social ?? null},
        ${body.partida_estado_balance_periodo_contable_anterior.resultado_ejercicios_anteriores ?? null},
        ${body.partida_estado_balance_periodo_contable_anterior.resultado_ejercicios ?? null},
        ${body.partida_estado_balance_periodo_contable_anterior.otro_capital ?? null},
        ${body.partida_estado_balance_periodo_contable_anterior.total_capital_contable_pat ?? null},
        '${body.periodo_actual}',
        '${body.periodo_anterior}',
        '${body.periodo_previo_anterior}')
    `;
    console.log(JSON.stringify(queryString))
    const result = await mysqlLib.query(queryString);
    console.log(JSON.stringify(result))
    if (result.result.affectedRows > 0) {
      return { success: true, message: 'Inserción exitosa' };
    } else {
      return { success: false, message: 'No se pudo insertar el registro' };
    }
  }


  async insertPEBPCPA(body) {
    const queryString = `
      INSERT INTO certification_partidas_estado_balance 
        (id_certification,
        id_tipo_cifra,
        compartir,
        compartir_info_empresa,
        tipo,
        caja_bancos,
        saldo_cliente_cuenta_x_cobrar,
        saldo_inventarios,
        deuda_corto_plazo,
        deuda_total,
        capital_contable,
        deudores_diversos,
        otros_activos,
        otros_activos_fijos_largo_plazo,
        total_activo_circulante,
        total_activo_fijo,
        activo_intangible,
        activo_diferido,
        total_otros_activos,
        activo_total,
        proveedores,
        acreedores,
        inpuestos_x_pagar,
        otros_pasivos,
        total_pasivo_circulante,
        total_pasivo_largo_plazo,
        otros_pasivos_largo_plazo,
        suma_pasivo_largo_plazo,
        pasivo_diferido,
        capital_social,
        resultado_ejercicios_anteriores,
        resultado_ejercicios,
        otro_capital,
        total_capital_contable_pat,
        periodo_actual,
        periodo_anterior,
        periodo_previo_anterior)
      VALUES
        (${body.id_certification},
        ${body.id_tipo_cifra ?? null},
        '${body.compartir}',
        ${body.compartir_info_empresa ?? null},
        'previo_anterior',
        ${body.partida_estado_balance_periodo_contable_previo_anterior.caja_bancos ?? null},
        ${body.partida_estado_balance_periodo_contable_previo_anterior.saldo_cliente_cuenta_x_cobrar ?? null},
        ${body.partida_estado_balance_periodo_contable_previo_anterior.saldo_inventarios ?? null},
        ${body.partida_estado_balance_periodo_contable_previo_anterior.deuda_corto_plazo ?? null},
        ${body.partida_estado_balance_periodo_contable_previo_anterior.deuda_total ?? null},
        ${body.partida_estado_balance_periodo_contable_previo_anterior.capital_contable ?? null},
        ${body.partida_estado_balance_periodo_contable_previo_anterior.deudores_diversos ?? null},
        ${body.partida_estado_balance_periodo_contable_previo_anterior.otros_activos ?? null},
        ${body.partida_estado_balance_periodo_contable_previo_anterior.otros_activos_fijos_largo_plazo ?? null},
        ${body.partida_estado_balance_periodo_contable_previo_anterior.total_activo_circulante ?? null},
        ${body.partida_estado_balance_periodo_contable_previo_anterior.total_activo_fijo ?? null},
        ${body.partida_estado_balance_periodo_contable_previo_anterior.activo_intangible ?? null},
        ${body.partida_estado_balance_periodo_contable_previo_anterior.activo_diferido ?? null},
        ${body.partida_estado_balance_periodo_contable_previo_anterior.total_otros_activos ?? null},
        ${body.partida_estado_balance_periodo_contable_previo_anterior.activo_total ?? null},
        ${body.partida_estado_balance_periodo_contable_previo_anterior.proveedores ?? null},
        ${body.partida_estado_balance_periodo_contable_previo_anterior.acreedores ?? null},
        ${body.partida_estado_balance_periodo_contable_previo_anterior.inpuestos_x_pagar ?? null},
        ${body.partida_estado_balance_periodo_contable_previo_anterior.otros_pasivos ?? null},
        ${body.partida_estado_balance_periodo_contable_previo_anterior.total_pasivo_circulante ?? null},
        ${body.partida_estado_balance_periodo_contable_previo_anterior.total_pasivo_largo_plazo ?? null},
        ${body.partida_estado_balance_periodo_contable_previo_anterior.otros_pasivos_largo_plazo ?? null},
        ${body.partida_estado_balance_periodo_contable_previo_anterior.suma_pasivo_largo_plazo ?? null},
        ${body.partida_estado_balance_periodo_contable_previo_anterior.pasivo_diferido ?? null},
        ${body.partida_estado_balance_periodo_contable_previo_anterior.capital_social ?? null},
        ${body.partida_estado_balance_periodo_contable_previo_anterior.resultado_ejercicios_anteriores ?? null},
        ${body.partida_estado_balance_periodo_contable_previo_anterior.resultado_ejercicios ?? null},
        ${body.partida_estado_balance_periodo_contable_previo_anterior.otro_capital ?? null},
        ${body.partida_estado_balance_periodo_contable_previo_anterior.total_capital_contable_pat ?? null},
        '${body.periodo_actual}',
        '${body.periodo_anterior}',
        '${body.periodo_previo_anterior}')
    `;
    const result = await mysqlLib.query(queryString);
    if (result.result.affectedRows > 0) {
      return { success: true, message: 'Inserción exitosa' };
    } else {
      return { success: false, message: 'No se pudo insertar el registro' };
    }
  }

  async insertPERPCPA(body) {
    const per = body.partida_estado_resultado_periodo_contable_previo_anterior || {}
    const totalPartidas =
      (Number(per.ventas_anuales) || 0) +
      (Number(per.costo_ventas_anuales) || 0) +
      (Number(per.utilidad_bruta) || 0) +
      (Number(per.gastos_administracion) || 0) +
      (Number(per.utilidad_operativa) || 0) +
      (Number(per.depreciacion_amortizacion) || 0) +
      (Number(per.otros_ingresos) || 0) +
      (Number(per.otros_gastos) || 0) +
      (Number(per.gastos_productos_financieros) || 0) +
      (Number(per.otros_egresos) || 0) +
      (Number(per.utilidad_neta) || 0)
    const queryString = `
      INSERT INTO certification_partidas_estado_resultados_contables
        (id_certification,
        compartir,
        tipo,
        ventas_anuales,
        costo_ventas_anuales,
        utilidad_operativa,
        utilidad_bruta,
        gastos_administracion,
        gastos_productos_financieros,
        depreciacion_amortizacion,
        otros_ingresos,
        otros_egresos,
        otros_gastos,
        utilidad_neta,
        total_partidas_estado_resultado,
        periodo_actual,
        periodo_anterior,
        periodo_previo_anterior)
      VALUES
        (${body.id_certification},
        '${body.compartir}',
        'previo_anterior',
        ${body.partida_estado_resultado_periodo_contable_previo_anterior.ventas_anuales ?? null},
        ${body.partida_estado_resultado_periodo_contable_previo_anterior.costo_ventas_anuales ?? null},
        ${body.partida_estado_resultado_periodo_contable_previo_anterior.utilidad_operativa ?? null},
        ${body.partida_estado_resultado_periodo_contable_previo_anterior.utilidad_bruta ?? null},
        ${body.partida_estado_resultado_periodo_contable_previo_anterior.gastos_administracion ?? null},
        ${body.partida_estado_resultado_periodo_contable_previo_anterior.gastos_productos_financieros ?? null},
        ${body.partida_estado_resultado_periodo_contable_previo_anterior.depreciacion_amortizacion ?? null},
        ${body.partida_estado_resultado_periodo_contable_previo_anterior.otros_ingresos ?? null},
        ${body.partida_estado_resultado_periodo_contable_previo_anterior.otros_egresos ?? null},
        ${body.partida_estado_resultado_periodo_contable_previo_anterior.otros_gastos ?? null},
        ${body.partida_estado_resultado_periodo_contable_previo_anterior.utilidad_neta ?? null},
        ${totalPartidas},
        '${body.periodo_actual}',
        '${body.periodo_anterior}',
        '${body.periodo_previo_anterior}')
    `;
    const result = await mysqlLib.query(queryString);
    if (result.result.affectedRows > 0) {
      return { success: true, message: 'Inserción exitosa' };
    } else {
      return { success: false, message: 'No se pudo insertar el registro' };
    }
  }

  async insertPERPCA(body) {
    const per = body.partida_estado_resultado_periodo_contable_anterior || {}
    const totalPartidas =
      (Number(per.ventas_anuales) || 0) +
      (Number(per.costo_ventas_anuales) || 0) +
      (Number(per.utilidad_bruta) || 0) +
      (Number(per.gastos_administracion) || 0) +
      (Number(per.utilidad_operativa) || 0) +
      (Number(per.depreciacion_amortizacion) || 0) +
      (Number(per.otros_ingresos) || 0) +
      (Number(per.otros_gastos) || 0) +
      (Number(per.gastos_productos_financieros) || 0) +
      (Number(per.otros_egresos) || 0) +
      (Number(per.utilidad_neta) || 0)
    const queryString = `
      INSERT INTO certification_partidas_estado_resultados_contables
        (id_certification,
        compartir,
        tipo,
        ventas_anuales,
        costo_ventas_anuales,
        utilidad_operativa,
        utilidad_bruta,
        gastos_administracion,
        gastos_productos_financieros,
        depreciacion_amortizacion,
        otros_ingresos,
        otros_egresos,
        otros_gastos,
        utilidad_neta,
        total_partidas_estado_resultado,
        periodo_actual,
        periodo_anterior,
        periodo_previo_anterior)
      VALUES
        (${body.id_certification},
        '${body.compartir}',
        'anterior',
        ${body.partida_estado_resultado_periodo_contable_anterior.ventas_anuales ?? null},
        ${body.partida_estado_resultado_periodo_contable_anterior.costo_ventas_anuales ?? null},
        ${body.partida_estado_resultado_periodo_contable_anterior.utilidad_operativa ?? null},
        ${body.partida_estado_resultado_periodo_contable_anterior.utilidad_bruta ?? null},
        ${body.partida_estado_resultado_periodo_contable_anterior.gastos_administracion ?? null},
        ${body.partida_estado_resultado_periodo_contable_anterior.gastos_productos_financieros ?? null},
        ${body.partida_estado_resultado_periodo_contable_anterior.depreciacion_amortizacion ?? null},
        ${body.partida_estado_resultado_periodo_contable_anterior.otros_ingresos ?? null},
        ${body.partida_estado_resultado_periodo_contable_anterior.otros_egresos ?? null},
        ${body.partida_estado_resultado_periodo_contable_anterior.otros_gastos ?? null},
        ${body.partida_estado_resultado_periodo_contable_anterior.utilidad_neta ?? null},
        ${totalPartidas},
        '${body.periodo_actual}',
        '${body.periodo_anterior}',
        '${body.periodo_previo_anterior}')
    `;
    const result = await mysqlLib.query(queryString);
    if (result.result.affectedRows > 0) {
      return { success: true, message: 'Inserción exitosa' };
    } else {
      return { success: false, message: 'No se pudo insertar el registro' };
    }
  }

  async getCertificationByIdCertfication(id_certification) {
    const queryString = `
      SELECT * FROM certification
      WHERE id_certification = ${id_certification} AND estatus_certificacion = 'inicial'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const { result } = await mysqlLib.query(queryString);
    return result.length > 0 ? result[0] : null;
  }

  async insertaDireccionReferenciaComercial(referencia_comercial) {
    const { codigo_postal } = referencia_comercial
    const queryString = `
    INSERT INTO domicilio 
      (
      domicilio_tipo,
      codigo_postal
      ) 
    VALUES 
      (
      3,
      '${codigo_postal}'
      );`
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async insertaInfoEmpresaCliente(data, id_referencia_comercial) {
    const { empresa_cliente } = data
    const {
      calificacion_referencia,
      porcentaje_deuda,
      dias_atraso,
      linea_credito,
      plazo
    } = empresa_cliente
    const queryString = `
      INSERT INTO certification_empresa_cliente_contacto 
        (
        id_referencia_comercial,
        calificacion_referencia,
        porcentaje_deuda,
        dias_atraso,
        linea_credito,
        plazo
      ) 
      VALUES 
        (${id_referencia_comercial},
        '${calificacion_referencia}',
        ${porcentaje_deuda},
        ${dias_atraso},
        ${linea_credito},
        ${plazo});
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }
// 
  async insertaReferenciaComercial(referencias_comerciales, id_certification, id_direccion) {
    const queryString = `
      INSERT INTO certification_referencia_comercial
        (id_certification,
        razon_social,
        denominacion,
        rfc,
        id_direccion,
        id_pais)
      VALUES
        (${id_certification},
        '${referencias_comerciales.razon_social}',
        ${referencias_comerciales.denominacion},
        '${referencias_comerciales.rfc}',
        ${id_direccion},
        ${referencias_comerciales.id_pais});
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async existeReferenciaComercial(id_certification_referencia_comercial) {
    // const {
    //   id_certification,
    //   razon_social,
    //   denominacion,
    //   rfc,
    //   id_pais
    // } = data

    // const queryString = `
    //   SELECT id_certification_referencia_comercial
    //     FROM certification_referencia_comercial
    //    WHERE id_certification = ${mysqlLib.escape(id_certification)}
    //      AND razon_social = ${mysqlLib.escape(razon_social)}
    //      AND denominacion = ${mysqlLib.escape(denominacion)}
    //      AND rfc = ${mysqlLib.escape(rfc)}
    //      AND id_pais = ${mysqlLib.escape(id_pais)}
    //    LIMIT 1;
    // `
    const queryString = `
      SELECT id_certification_referencia_comercial
        FROM certification_referencia_comercial
       WHERE id_certification_referencia_comercial = ${mysqlLib.escape(id_certification_referencia_comercial)};
    `

    const { result } = await mysqlLib.query(queryString)
    return Array.isArray(result) && result.length > 0
  }

  async insertaContacto(contacto, estatus, id_certification_referencia_comercial) {
    const queryString = `
      INSERT INTO certification_contacto 
        (id_certification_referencia_comercial,
        nombre_contacto,
        correo_contacto,
        telefono_contacto,
        estatus) 
      VALUES 
        (${id_certification_referencia_comercial},
        '${contacto.nombre_contacto}',
        '${contacto.correo_contacto}',
        '${contacto.telefono_contacto}',
        '${estatus}')
    `;
    const { result } = await mysqlLib.query(queryString);
    return result;
  }

  async updateEstatusEmailSend(id) {
    const queryString = `
      UPDATE certification_contacto
      SET 
        estatus = 'enviado'
      WHERE id_certification_contacto = ${id};
    `;
    const result = await mysqlLib.query(queryString);
    return result
  }

  async getLastIdCertificationCancel(id_empresa) {
    const queryString = `
    SELECT
      c.id_certification
    FROM certification AS c
    WHERE c.estatus_certificacion = 'cancelada'
    AND c.id_empresa = ${id_empresa}
    ORDER BY c.id_certification DESC
    LIMIT 1;
    `
    try {
      const queryResult = await mysqlLib.query(queryString)
      const result = Array.isArray(queryResult?.result)
        ? queryResult.result
        : []

      if (result.length > 0 && result[0]) {
        return result[0].id_certification
      }

      return null
    } catch (error) {
      logger.error(`getLastIdCertificationCancel | ${error.message}`)
      return null
    }
  }

  async getIdEmpresaByIdCertification(id_certification) {
    const queryString = `
    SELECT 
      c.id_empresa
    FROM certification AS c
    WHERE c.id_certification = ${id_certification};
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getEmailEstatusContacto(email, id_certification) {
    const queryString = `
    SELECT
      cc.correo_contacto,
      c.id_empresa,
      cc.estatus
    FROM certification_contacto AS cc
    LEFT JOIN certification_referencia_comercial AS crc ON crc.id_certification_referencia_comercial = cc.id_certification_referencia_comercial
    LEFT JOIN certification AS c ON c.id_certification = crc.id_certification
    WHERE cc.correo_contacto = '${email.toLowerCase().trim()}'
    AND cc.estatus = 'enviado'
    AND c.id_certification = ${id_certification};
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getVentasAnualesAnioAnterior(id_certification) {
    const queryString = `
    SELECT
      erc.ventas_anuales,
      erc.tipo,
      erc.periodo_actual,
      erc.periodo_anterior,
      erc.periodo_previo_anterior
    FROM certification_partidas_estado_resultados_contables AS erc
    WHERE 
      erc.tipo = 'anterior'
      AND erc.id_certification = ${id_certification}
    `
    const { result } = await mysqlLib.query(queryString)
    return result[0]
  }


  async getVentasAnualesAnioPrevioAnterior(id_certification) {
    const queryString = `
    SELECT
      erc.ventas_anuales,
      erc.tipo,
      erc.periodo_actual,
      erc.periodo_anterior,
      erc.periodo_previo_anterior
    FROM certification_partidas_estado_resultados_contables AS erc
    WHERE 
      erc.tipo = 'previo_anterior'
      AND erc.id_certification = ${id_certification};
    `
    const { result } = await mysqlLib.query(queryString)
    return result[0]
  }

  async getCostoVentasAnualesPPAAlert(id_certification) {
    const queryString = `
    SELECT
      erc.costo_ventas_anuales
    FROM certification_partidas_estado_resultados_contables AS erc
    WHERE 
      erc.tipo = 'previo_anterior'
      AND erc.id_certification = ${id_certification};
    `
    const { result } = await mysqlLib.query(queryString)
    return result[0]
  }

  async getCostoVentasAnualesPAAlert(id_certification) {
    const queryString = `
    SELECT
      erc.costo_ventas_anuales
    FROM certification_partidas_estado_resultados_contables AS erc
    WHERE 
      erc.tipo = 'anterior'
      AND erc.id_certification = ${id_certification};
    `
    const { result } = await mysqlLib.query(queryString)
    return result[0]
  }

  async getLineasCredito(id_certification) {
    const queryString = `
    SELECT
      linea_credito
    FROM certification_referencia_comercial
    WHERE id_certification = ${id_certification};
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getPlazoCredito(id_certification) {
    const queryString = `
    SELECT
      plazo
    FROM certification_referencia_comercial
    WHERE id_certification = ${id_certification};
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getRangoEndeudamiento(endeudamiento) {
    const queryString = `
    SELECT *
    FROM cat_endeudamiento_alertas
    WHERE ${endeudamiento} BETWEEN limite_inferior AND limite_superior;
    `
    const { result } = await mysqlLib.query(queryString)
    return result[0]
  }



  async getScoreEvolucionVentas(evolucionVentas) {
    const queryString = `
      SELECT
        nombre,
        valor_algoritmo,
        rango_numerico
      FROM cat_evolucion_ventas_algoritmo
    `

    const { result } = await mysqlLib.query(queryString)
    const rows = Array.isArray(result) ? result : []

    const toNumber = str => {
      const clean = str.replace('%', '').trim()
      if (clean === 'inf') return Infinity
      if (clean === '-inf') return -Infinity
      return parseFloat(clean)
    }

    const value = parseFloat(evolucionVentas)

    for (const row of rows) {
      const [a, b] = row.rango_numerico.replace(/[()\[\]]/g, '').split(',')
      const start = toNumber(a)
      const end = toNumber(b)
      const lower = Math.min(start, end)
      const upper = Math.max(start, end)

      if (value >= lower && value <= upper) {
        return row
      }
    }

    return null
  }

  async getEstadoResultadoData(id_certification, periodo) {
    const queryString = `
    SELECT
      cpe.ventas_anuales as ventas_anuales_${periodo},
      cpe.costo_ventas_anuales as costo_ventas_anuales_${periodo},
      cpe.utilidad_bruta as utilidad_bruta_${periodo},
      cpe.gastos_administracion as gastos_administracion_${periodo},

      cpe.utilidad_operativa as utilidad_operativa_${periodo},
      cpe.gastos_productos_financieros as gastos_productos_financieros_${periodo},
      cpe.depreciacion_amortizacion as depreciacion_amortizacion_${periodo},
      cpe.utilidad_neta as utilidad_neta_${periodo},
      cpe.otros_ingresos as otros_ingresos_${periodo},
      cpe.otros_egresos as otros_egresos_${periodo},
      cpe.otros_gastos as otros_gastos_${periodo}

    FROM certification_partidas_estado_resultados_contables AS cpe
    WHERE cpe.id_certification = ${id_certification}
    AND cpe.tipo = '${periodo}'
    ORDER BY cpe.id_certification_estado_resultados_contables DESC
    LIMIT 1;
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getEstadoBalanceData(id_certification, periodo) {
    const queryString = `
    SELECT
      cpe.caja_bancos as caja_bancos_${periodo},
      cpe.saldo_inventarios as inventarios_${periodo},
      cpe.saldo_cliente_cuenta_x_cobrar as cliente_${periodo},
      cpe.deudores_diversos as deudores_diversos_${periodo},
      cpe.otros_activos as otros_activos_${periodo},
      cpe.otros_activos_fijos_largo_plazo as otros_activos_fijos_largo_plazo_${periodo},
      cpe.total_activo_fijo as activo_fijo_${periodo},
      cpe.activo_intangible as activo_intangible_${periodo},
      cpe.activo_diferido as activo_diferido_${periodo},
      cpe.proveedores as proveedores_${periodo},
      cpe.acreedores as acreedores_${periodo},
      cpe.inpuestos_x_pagar as inpuestos_x_pagar_${periodo},
      cpe.otros_pasivos as otros_pasivos_${periodo},
      cpe.total_pasivo_largo_plazo as pasivo_largo_plazo_${periodo},
      cpe.pasivo_diferido as pasivo_diferido_${periodo},
      cpe.resultado_ejercicios_anteriores as resultado_ejercicios_anteriores_${periodo},
      cpe.resultado_ejercicios as resultado_ejercicios_${periodo},
      cpe.otro_capital as otro_capital_${periodo},
      cpe.capital_social as capital_social_${periodo}
    FROM certification_partidas_estado_balance AS cpe
    WHERE cpe.id_certification = ${id_certification}
    AND cpe.tipo = '${periodo}'
    ORDER BY cpe.id_certification_partidas_estado_balance DESC
    LIMIT 1;
    `
    logger.info(`${JSON.stringify(queryString)}`)
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getLastIdCertificationByRfc(rfc) {
    const queryString = `
    SELECT
      c.id_certification
    FROM empresa AS e
    LEFT JOIN certification AS c ON c.id_empresa = e.emp_id
    WHERE e.emp_rfc = '${rfc}' AND c.estatus_certificacion = 'inicial';
    `
    try {
      const queryResult = await mysqlLib.query(queryString)
      const result = Array.isArray(queryResult?.result)
        ? queryResult.result
        : []

      if (result.length > 0 && result[0]) {
        return result[0].id_certification
      }

      return null
    } catch (error) {
      logger.error(`getLastIdCertification | ${error.message}`)
      return null
    }
  }


  async getLastIdCertification(id_cliente) {
    const queryString = `
    SELECT
      c.id_certification
    FROM certification AS c
    WHERE c.id_empresa = ${id_cliente}
    ORDER BY
    c.id_certification DESC
    LIMIT 1;
    `
    try {
      const queryResult = await mysqlLib.query(queryString)
      const result = Array.isArray(queryResult?.result)
        ? queryResult.result
        : []
      logger.info(
        `getLastIdCertification | Query ejecutada: ${queryString.trim()} | Resultado: ${JSON.stringify(result)}`
      )

      if (result.length > 0 && result[0]) {
        return result[0].id_certification
      }

      return null
    } catch (error) {
      logger.error(`getLastIdCertification | ${error.message}`)
      return null
    }
  }

  async guardaRelacionCompradorVendedor(data) {
    const {
      id_proveedor,
      id_cliente,
      plazo,
      monto_solicitado
    } = data;

    const queryString = `
    INSERT INTO solicitud_credito
    (id_proveedor, id_cliente, plazo, monto_solicitado)
    VALUES
    (${id_proveedor !== undefined ? id_proveedor : 0},
     ${id_cliente !== undefined ? id_cliente : 0},
     ${plazo !== undefined ? plazo : 0},
     ${monto_solicitado !== undefined ? monto_solicitado : 0});
  `;

    const { result } = await mysqlLib.query(queryString);
    return { message: 'Registro insertado correctamente', success: true, result };
  }


  async getSolicitudCredito(id_solicitud_credito) {
    const queryString = `
    SELECT COUNT(*) AS solicitud
      FROM solicitud_credito
      WHERE id_solicitud_credito = ${id_solicitud_credito};
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getEstatusSolicitudCredito(id_solicitud_credito) {
    const queryString = `
    SELECT
      estatus
    FROM solicitud_credito
    WHERE id_solicitud_credito = ${id_solicitud_credito};
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async actualizaEstatusSolicitudCredito(data) {
    const { id_solicitud_credito, estatus } = data
    const queryString = `
      UPDATE solicitud_credito
      SET 
        estatus = ${mysqlLib.escape(estatus)},
        updated_at = CURRENT_TIMESTAMP
      WHERE id_solicitud_credito = ${mysqlLib.escape(id_solicitud_credito)};
    `;
    const result = await mysqlLib.query(queryString);
    return result
  }

  async getMontoPlazo(id_proveedor, id_cliente, id_solicitud_credito) {
    const queryString = `
    SELECT
      monto_solicitado,
      plazo
    FROM solicitud_credito
    WHERE id_proveedor = ${id_proveedor} AND id_cliente = ${id_cliente} AND id_solicitud_credito = ${id_solicitud_credito}
    ORDER BY id_solicitud_credito DESC
    LIMIT 1;
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }


  async getEmpresa(id_proveedot) {
    const queryString = `
    SELECT COUNT(*) AS empresas
      FROM empresa
      WHERE emp_id = ${id_proveedot};
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getUsuarioEmail(id) {
    const queryString = `
    SELECT 
      u.usu_nombre,
      u.usu_email
    FROM 
      empresa_usuario eu
    JOIN 
      usuario u ON eu.usu_id = u.usu_id
    WHERE 
      eu.emp_id = ${id}
      AND eu.reg_active = 1
      AND u.reg_active = 1;
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getContactoByEmpresaIdCertification(id_certification) {
    const queryString = `
    SELECT
        c.id_empresa,
        crc.id_certification_referencia_comercial,
        cc.correo_contacto
    FROM certification AS c
    LEFT JOIN certification_referencia_comercial AS crc ON crc.id_certification = c.id_certification
    LEFT JOIN certification_contacto AS cc ON cc.id_certification_referencia_comercial = crc.id_certification_referencia_comercial
    WHERE c.id_certification = ${id_certification}
    GROUP BY cc.correo_contacto;
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }


  async getCountEncuesta(id) {
    const queryString = `
    SELECT COUNT(e.id_encuesta) as answer
      FROM encuestas e
      JOIN empresa_usuario eu ON e.usu_id = eu.usu_id
      JOIN empresa_usuario eu2 ON eu.emp_id = eu2.emp_id
      WHERE eu2.usu_id = ${id};
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getEmpresaById(id) {
    const queryString = `
    SELECT *
      FROM empresa
      WHERE emp_id = ${id};
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

  async getPaisAlgoritmoByIdCertification(id_certification) {
    const queryString = `
    SELECT
      pa.nombre,
      pa.valor_algoritmo
    FROM certification AS c
    LEFT JOIN cat_pais_algoritmo AS pa ON pa.id_pais_algoritmo = c.id_pais
    WHERE c.id_certification = ${id_certification}
    `
    const { result } = await mysqlLib.query(queryString)
    return result[0]
  }

  async getSectorRiesgoByIdCertification(id_certification, algoritmo_v) {
    let valor_algritmo = Number(algoritmo_v?.v_alritmo) === 2 ? 'srs.valor_algoritmo_v2 AS valor_algoritmo' : 'srs.valor_algoritmo'
    let queryString = `
    SELECT
      srs.nombre,
      ${valor_algritmo}
    FROM certification AS c
    LEFT JOIN cat_sector_riesgo_sectorial_algoritmo AS srs ON srs.id_cat_sector_riesgo_sectorial = c.id_cat_sector_riesgo_sectorial
    WHERE c.id_certification = ${id_certification};
    `
    const { result } = await mysqlLib.query(queryString)
    return result[0]
  }


  async getPlantillaCertification(id_certification) {
    const queryString = `
    SELECT
      c.plantilla_laboral
    FROM certification AS c
    WHERE c.id_certification = ${id_certification};
    `
    const { result } = await mysqlLib.query(queryString)
    return result[0]
  }

  async getScorePlantillaLaboral(plantillaLaboral, algoritmo_v) {
    let valor_algoritmo = Number(algoritmo_v?.v_alritmo) === 2 ? 'valor_algoritmo_v2 AS valor_algoritmo' : 'valor_algoritmo'
    const queryString = `
    SELECT
      nombre,  
      ${valor_algoritmo},
      limite_inferior,
      limite_superior
    FROM cat_plantilla_laboral_algoritmo
    WHERE ${plantillaLaboral} BETWEEN limite_inferior AND COALESCE(limite_superior, ${plantillaLaboral});
    `
    const { result } = await mysqlLib.query(queryString)
    return result[0]
  }

  async getScoreClienteFinal(id_certification, algoritmo_v) {
    const campoAlgoritmo =
      Number(algoritmo_v?.v_alritmo) === 2
        ? 'scf.valor_algoritmo_v2'
        : 'scf.valor_algoritmo'

    const queryString = `
      SELECT
        scf.nombre,
        ${campoAlgoritmo} AS valor_algoritmo
      FROM certification AS c
      LEFT JOIN cat_sector_clientes_finales_algoritmo AS scf
        ON scf.id_cat_sector_clientes_finales = c.id_cat_sector_clientes_finales
      WHERE c.id_certification = @id_certification;
    `

    const { result } = await mysqlLib.mysqlQuery('GET', queryString, {
      id_certification
    })

    return result[0]
  }

  async getScoreTiempoActividad(id_certification) {
    const queryString = `
      SELECT
        tac.nombre,
        tac.valor_algoritmo
      FROM certification AS c
      LEFT JOIN cat_tiempo_actividad_comercial_algoritmo AS tac
        ON tac.id_cat_tiempo_actividad_comercial = c.id_cat_tiempo_actividad_comercial
      WHERE c.id_certification = @id_certification
      LIMIT 1;
    `

    const { result } = await mysqlLib.mysqlQuery('GET', queryString, {
      id_certification
    })

    return result[0]
  }

  async getScoreVentasAnualesAnioAnterior(ventasAnualesAnioAnterior) {
    const queryString = `
    SELECT
      nombre,
      valor_algoritmo,
      limite_inferior,
      limite_superior
    FROM cat_ventas_anuales_algoritmo
    WHERE ${ventasAnualesAnioAnterior} BETWEEN limite_inferior AND limite_superior;
    ;
    `
    const { result } = await mysqlLib.query(queryString)
    return result[0]
  }

  async deudaTotalPCA(id_certification) {
    const id = mysqlLib.escape(id_certification)
    const queryString = `
    SELECT
      deuda_total,
      tipo,
      periodo_actual,
      periodo_anterior,
      periodo_previo_anterior
    FROM certification_partidas_estado_balance
    WHERE
      tipo = 'anterior'
      AND id_certification = ${id}
    ORDER BY id_certification_partidas_estado_balance DESC
    LIMIT 1;
    `
    const { result } = await mysqlLib.query(queryString)
    return result[0]
  }

  async capitalContablePCA(id_certification) {
    const id = mysqlLib.escape(id_certification)
    const queryString = `
    SELECT
      capital_contable,
      tipo,
      periodo_actual,
      periodo_anterior,
      periodo_previo_anterior
    FROM certification_partidas_estado_balance
    WHERE
      tipo = 'anterior'
      AND id_certification = ${id}
    ORDER BY id_certification_partidas_estado_balance DESC
    LIMIT 1;
    `
    const { result } = await mysqlLib.query(queryString)
    return result[0]
  }

  async pasivoLargoPlazoPCA(id_certification) {
    const id = mysqlLib.escape(id_certification)
    const queryString = `
    SELECT
      total_pasivo_largo_plazo,
      tipo,
      periodo_actual,
      periodo_anterior,
      periodo_previo_anterior
    FROM certification_partidas_estado_balance
    WHERE
      tipo = 'anterior'
      AND id_certification = ${id}
    ORDER BY id_certification_partidas_estado_balance DESC
    LIMIT 1;
    `
    const { result } = await mysqlLib.query(queryString)
    return result[0]
  }

  async updateDpo(idCertification, dpo) {
    const queryString = `
      UPDATE certification
      SET 
        dpo = '${mysqlLib.escape(dpo)}'
      WHERE id_certification = ${mysqlLib.escape(idCertification)};
    `
    const result = await mysqlLib.query(queryString)
    return result
  }

  async getScoreApalancamiento(apalancamiento, algoritmo_v) {
    const table = 'cat_apalancamiento_algoritmo'

    if (Number(algoritmo_v?.v_alritmo) === 2) {
      const queryDefault = `
      SELECT
        nombre,
        valor_algoritmo,
        limite_inferior,
        limite_superior
      FROM ${table}
      WHERE nombre = 'DESCONOCIDO'
      LIMIT 1;
      `
      const { result } = await mysqlLib.query(queryDefault)
      return result[0] || null
    }

    const value = parseFloat(apalancamiento)
    if (!Number.isFinite(value)) {
      const { result } = await mysqlLib.query(
        `SELECT nombre, valor_algoritmo, limite_inferior, limite_superior FROM ${table} WHERE nombre = 'DESCONOCIDO' LIMIT 1;`
      )
      return result[0] || null
    }

    const apal = mysqlLib.escape(value)
    const queryString = `
    SELECT
      nombre,
      valor_algoritmo,
      limite_inferior,
      limite_superior
    FROM ${table}
    WHERE ${apal} BETWEEN limite_inferior AND limite_superior;
    `
    const { result } = await mysqlLib.query(queryString)
    if (result && result[0]) return result[0]

    const { result: fallback } = await mysqlLib.query(
      `SELECT nombre, valor_algoritmo, limite_inferior, limite_superior FROM ${table} WHERE nombre = 'DESCONOCIDO' LIMIT 1;`
    )
    return fallback[0] || null
  }

  async cajaBancoPCA(id_certification) {
    const id = mysqlLib.escape(id_certification)
    const queryString = `
    SELECT
      caja_bancos,
      tipo,
      periodo_actual,
      periodo_anterior,
      periodo_previo_anterior
    FROM certification_partidas_estado_balance
    WHERE
      tipo = 'anterior'
      AND id_certification = ${id};
    `
    const { result } = await mysqlLib.query(queryString)
    return result[0] || null
  }


  async getScoreCajaBancoPCA(cajaBancos) {
    const value = mysqlLib.escape(cajaBancos)
    const queryString = `
    SELECT
      nombre,
      valor_algoritmo,
      limite_inferior,
      limite_superior
    FROM cat_flujo_neto_caja_algoritmo
    WHERE ${value} BETWEEN limite_inferior AND COALESCE(limite_superior, 9999999999);
    `
    const { result } = await mysqlLib.query(queryString)
    return result[0] || null
  }

  async capitalContableEBPA(id_certification) {
    const queryString = `
    SELECT capital_contable
    FROM certification_partidas_estado_balance
    WHERE 
      tipo = 'anterior'
      AND id_certification = ${id_certification};
    `
    const { result } = await mysqlLib.query(queryString)
    return result[0]
  }

  async getScoreCapitalContableEBPA(capitalContableEBPA) {
    const queryString = `
    SELECT
      nombre,
      valor_algoritmo,
      limite_inferior,
      limite_superior
    FROM cat_capital_contable_algoritmo
    WHERE ${capitalContableEBPA} BETWEEN limite_inferior AND COALESCE(limite_superior, 9999999999);
    `
    const { result } = await mysqlLib.query(queryString)
    return result[0]
  }

  async getCatIncidenciasLegales() {
    const queryString = `
    SELECT
      nombre,
      valor_algoritmo,
      valor_algoritmo_v2,
      limite_inferior,
      limite_superior
    FROM cat_incidencias_legales_algoritmo;
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getScoreIncidenciasLegales(nombre, algoritmo_v) {
    const valor_algoritmo =
      Number(algoritmo_v?.v_alritmo) === 2
        ? 'valor_algoritmo_v2 AS valor_algoritmo'
        : 'valor_algoritmo'

    const queryString = `
    SELECT
      nombre,
      ${valor_algoritmo},
      limite_inferior,
      limite_superior
    FROM cat_incidencias_legales_algoritmo
    WHERE nombre = ${mysqlLib.escape(nombre)};
    `
    const { result } = await mysqlLib.query(queryString)
    return result[0]
  }

  async getCatResultadoReferenciasProveedores() {
    const queryString = `
    SELECT
      id_cat_resultado_referencias_proveedores,
      nombre,
      valor_algoritmo,
      valor_algoritmo_v2
    FROM cat_resultado_referencias_proveedores_algoritmo;
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getResultadoReferenciaById(id, algoritmo_v) {
    const valor_algoritmo =
      Number(algoritmo_v?.v_alritmo) === 2
        ? 'valor_algoritmo_v2 AS valor_algoritmo'
        : 'valor_algoritmo'

    const queryString = `
    SELECT
      nombre,
      ${valor_algoritmo}
    FROM cat_resultado_referencias_proveedores_algoritmo
    WHERE id_cat_resultado_referencias_proveedores = ${mysqlLib.escape(id)};
    `
    const { result } = await mysqlLib.query(queryString)
    return result[0]
  }
  async getScoreResultadoReferencias(nombre, algoritmo_v) {
    const valor_algoritmo =
      Number(algoritmo_v?.v_alritmo) === 2
        ? 'valor_algoritmo_v2 AS valor_algoritmo'
        : 'valor_algoritmo'

    const queryString = `
    SELECT
      nombre,
      ${valor_algoritmo}
    FROM cat_resultado_referencias_proveedores_algoritmo
    WHERE nombre = ${mysqlLib.escape(nombre)};
    `
    const { result } = await mysqlLib.query(queryString)
    return result[0]
  }

  async deudaCortoPlazo(id_certification) {
    const id = mysqlLib.escape(id_certification)
    const queryString = `
    SELECT
      deuda_corto_plazo,
      otros_pasivos,
      tipo,
      periodo_actual,
      periodo_anterior,
      periodo_previo_anterior
    FROM certification_partidas_estado_balance
    WHERE
      tipo = 'anterior'
      AND id_certification = ${id}
    LIMIT 1;
    `
    const { result } = await mysqlLib.query(queryString)
    return result[0] || null
  }

  async utilidadOperativa(id_certification) {
    const id = mysqlLib.escape(id_certification)
    const queryString = `
    SELECT
      utilidad_operativa
    FROM certification_partidas_estado_resultados_contables
    WHERE
      tipo = 'anterior'
      AND id_certification = ${id}
    LIMIT 1;
    `
    const { result } = await mysqlLib.query(queryString)
    return result[0] || null
  }

  async getScorePayback(payback) {
    const queryString = `
    SELECT
      nombre,
      valor_algoritmo,
      limite_inferior,
      limite_superior
    FROM cat_payback_algoritmo
    WHERE ${payback} BETWEEN limite_inferior AND COALESCE(limite_superior, 9999999999);
    ;
    `
    const { result } = await mysqlLib.query(queryString)
    return result[0]
  }

  async saldoClienteCuentaXCobrar(id_certification) {
    const id = mysqlLib.escape(id_certification)
    const queryString = `
    SELECT
      saldo_cliente_cuenta_x_cobrar,
      tipo,
      periodo_actual,
      periodo_anterior,
      periodo_previo_anterior
    FROM certification_partidas_estado_balance
    WHERE
      tipo = 'anterior'
      AND id_certification = ${id};
    `
    const { result } = await mysqlLib.query(queryString)
    return result[0]
  }


  async ventasAnuales(id_certification) {
    const id = mysqlLib.escape(id_certification)
    const queryString = `
    SELECT
      ventas_anuales,
      tipo
    FROM certification_partidas_estado_resultados_contables
    WHERE
      tipo = 'anterior'
      AND id_certification = ${id};
    `
    const { result } = await mysqlLib.query(queryString)
    return result[0]
  }

  async saldoInventarios(id_certification) {
    const id = mysqlLib.escape(id_certification)
    const queryString = `
    SELECT
      saldo_inventarios,
      tipo
    FROM certification_partidas_estado_balance
    WHERE
      tipo = 'anterior'
      AND id_certification = ${id};
    `
    const { result } = await mysqlLib.query(queryString)
    return result[0]
  }

  // async getCalificacionsReferencias(id_referencia) {
  //   const queryString = `
  //   SELECT
  //     razon_social,
  //     rfc,
  //     calificacion_referencia,
  //     porcentaje_deuda,
  //     dias_atraso
  //   FROM certification_empresa_cliente_contacto
  //   WHERE id_referencia_comercial = ${id_referencia};
  //   `
  //   const { result } = await mysqlLib.query(queryString)
  //   return result
  // }

  async getCalificacionsReferencias(id_referencia) {
    const queryString = `
    SELECT
      razon_social,
      rfc,
      calificacion_referencia,
      porcentaje_deuda,
      dias_atraso
    FROM certification_empresa_cliente_contacto
    WHERE id_referencia_comercial = ${id_referencia};
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getTipoCifra(id_certification) {
    const id = mysqlLib.escape(id_certification)
    const queryString = `
    SELECT
      id_tipo_cifra
    FROM certification_partidas_estado_balance
    WHERE
      tipo = 'anterior'
      AND id_certification = ${id};
    `
    const { result } = await mysqlLib.query(queryString)
    return result[0].id_tipo_cifra
  }


  async getScoreTipoCifra(id_cifra) {
    const id = mysqlLib.escape(id_cifra)
    const queryString = `
    SELECT
      valor_algoritmo,
      nombre
    FROM cat_tipo_cifras_algoritmo
    WHERE id_cat_tipo_cifras = ${id};
    `
    const { result } = await mysqlLib.query(queryString)
    return result[0]
  }

  async costoVentasAnuales(id_certification) {
    const id = mysqlLib.escape(id_certification)
    const queryString = `
    SELECT
      costo_ventas_anuales,
      tipo
    FROM certification_partidas_estado_resultados_contables
    WHERE
      tipo = 'anterior'
      AND id_certification = ${id};
    `
    const { result } = await mysqlLib.query(queryString)
    return result[0]
  }



  async getScoreRotacion(dso, dio) {
    const dsoEsc = mysqlLib.escape(dso)
    const dioEsc = mysqlLib.escape(dio)
    const queryString = `
      SELECT
        nombre,
        valor_algoritmo,
        limite_inferior,
        limite_superior
      FROM cat_rotacion_cuentas_cobrar_algoritmo
      WHERE
          ${dsoEsc} BETWEEN COALESCE(limite_inferior, -999999999) AND COALESCE(limite_superior, 999999999)
          OR ${dioEsc} BETWEEN COALESCE(limite_inferior, -999999999) AND COALESCE(limite_superior, 999999999)
      LIMIT 1;

      `
    const { result } = await mysqlLib.query(queryString)
    return result[0]
  }

  async getDefaultRotacionScore() {
    const queryString = `
      SELECT nombre, valor_algoritmo, limite_inferior, limite_superior
      FROM cat_rotacion_cuentas_cobrar_algoritmo
      ORDER BY valor_algoritmo ASC
      LIMIT 1;
    `
    const { result } = await mysqlLib.query(queryString)
    return result[0]
  }


  async getClass(value) {

    try {
      const { result: tableExists } = await mysqlLib.query(
        "SHOW TABLES LIKE 'score_classes_a';"
      )
      if (tableExists.length) {
        const queryString = `
          SELECT class
          FROM score_classes_a
          WHERE ${value} BETWEEN score_min AND COALESCE(score_max, ${value})
          ORDER BY score_min ASC
          LIMIT 1;`
        const { result } = await mysqlLib.query(queryString)
        if (result.length) return result[0].class
        logger.info(`getClass | No class found for value ${value}`)
      } else {
        logger.info('getClass | Table score_classes_a not found')

      }
    } catch (err) {
      logger.info(`getClass | Error buscando clase en DB: ${err.message}`)
    }


    return null
  }

  async getWordingUnderwriting(clase) {
    const queryString = `
      SELECT score, wording_underwriting
      FROM cat_score_descripcion_algoritmo
      WHERE id_cat_sector_riesgo_sectorial = ${clase};

      `
    const { result } = await mysqlLib.query(queryString)
    return result[0]
  }

  async getScoreLc(score) {
    const queryString = `
      SELECT
          score,
          porcentaje_lc
      FROM
          cat_score_lc
      WHERE
          score = ${score};
      `
    const { result } = await mysqlLib.query(queryString)
    return result[0].porcentaje_lc
  }

  async getAllScoreLc() {
    const queryString = `
      SELECT
          score,
          porcentaje_lc
      FROM
          cat_score_lc
      ORDER BY score ASC;
      `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getAllScoreClasses() {
    const fetchTable = async name => {
      try {
        const { result: exists } = await mysqlLib.query(
          `SHOW TABLES LIKE '${name}';`
        )
        if (exists.length) {
          const { result } = await mysqlLib.query(
            `SELECT score_min, score_max, class FROM ${name} ORDER BY score_min ASC;`
          )
          return result
        }
        logger.info(`getAllScoreClasses | Table ${name} not found`)
      } catch (err) {
        logger.info(`getAllScoreClasses | Error obteniendo ${name}: ${err.message}`)
      }
      return []
    }

    const table1 = await fetchTable('score_classes_a')
    const table2 = await fetchTable('score_classes_b')

    return { table1, table2 }
  }

  async saveAlgoritm(id_certification, scores, g45, c46, g46, g49, g48, g51, g52, wu, c48, porcentajeLc) {
    const queryString = `
        INSERT INTO algoritmo_resultado (
            id_certification,
            monto_solicitado,
            pais_score,
            sector_riesgo_score,
            capital_contable_score,
            plantilla_laboralScore,
            sector_cliente_finalScore,
            tiempo_actividad_score,
            influencia_controlante_score,
            ventas_anuales_score,
            tipo_cifrasScore,
            incidencias_legalesScore,
            evolucion_ventasScore,
            apalancamiento_score,
            flujo_netoscore,
            payback_score,
            rotacion_ctas_x_cobrar_score,
            g_45,
            g_46,
            g_49,
            g_48,
            g_51,
            g_52,
            wu,
            porcentaje_lc,
            c_48_monto_aprobado
        ) VALUES (
            ${id_certification},
            ${c46},
            '${scores.paisScore}',
            '${scores.sectorRiesgoScore}',
            '${scores.capitalContableScore}',
            '${scores.plantillaLaboralScore}',
            '${scores.sectorClienteFinalScore}',
            '${scores.tiempoActividadScore}',
            '${scores.influenciaControlanteScore}',
            '${scores.ventasAnualesScore}',
            '${scores.tipoCifrasScore}',
            '${scores.incidenciasLegalesScore}',
            '${scores.evolucionVentasScore}',
            '${scores.apalancamientoScore}',
            '${scores.flujoNetoScore}',
            '${scores.paybackScore}',
            '${scores.rotacionCtasXCobrarScore}',
            ${g45},
            ${g46},
            ${g49},
            ${g48},
            ${g51},
            ${g52},
            ${wu.score},
            ${porcentajeLc},
            ${c48}
        )`;

    try {
      const result = await mysqlLib.query(queryString);
      return result;
    } catch (error) {
      throw new Error(`Error al insertar datos en la tabla: ${error.message}`);
    }
  }


  async updateCertificationAlgoritmo(body) {
    const queryString = `
      UPDATE certification
      SET 
        id_empresa = ${mysqlLib.escape(body.id_empresa)},
        id_usuario = ${mysqlLib.escape(body.id_usuario)},
        id_pais = ${mysqlLib.escape(body.id_pais)},
        razon_social = ${mysqlLib.escape(body.razon_social)},
        rfc = ${mysqlLib.escape(body.rfc)},
        nrp = ${mysqlLib.escape(body.nrp)},
        direccion_fiscal = ${mysqlLib.escape(body.direccion_fiscal)},
        industria_id = ${mysqlLib.escape(body.industria_id)},
        id_cat_sector_riesgo_sectorial = ${mysqlLib.escape(body.id_cat_sector_riesgo_sectorial)},
        id_cat_sector_clientes_finales = ${mysqlLib.escape(body.id_cat_sector_clientes_finales)},
        plantilla_laboral = ${mysqlLib.escape(body.plantilla_laboral)},
        id_cat_tiempo_actividad_comercial = ${mysqlLib.escape(body.id_cat_tiempo_actividad_comercial)},
        pagina_web = ${mysqlLib.escape(body.pagina_web)},
        updated_at = CURRENT_TIMESTAMP
      WHERE id_certification = ${mysqlLib.escape(body.id_certification)};
    `
    const result = await mysqlLib.query(queryString)
    return result
  }

  async deleteAccionista(idCertificationAccionistas) {
    const queryString = `
      DELETE FROM certification_accionistas
      WHERE id_certification = ${mysqlLib.escape(idCertificationAccionistas)};
    `;
    const result = await mysqlLib.query(queryString);
    return result;
  }


  async deleteReferenciasComerciales(idCertificationAccionistas) {
    const queryString = `
    DELETE FROM certification_referencia_comercial
    WHERE id_certification = ${mysqlLib.escape(idCertificationAccionistas)};
  `;
    const result = await mysqlLib.query(queryString);
    return result;
  }

  async deleteDemandas(id_certification) {
    const queryString = `
    DELETE FROM certification_demandas
    WHERE id_certification = ${mysqlLib.escape(id_certification)};
  `;
    const result = await mysqlLib.query(queryString);
    return result;
  }


  async deleteContactos(idReferenciaComercial) {
    const queryString = `
    DELETE FROM certification_contacto
    WHERE id_certification_referencia_comercial = ${mysqlLib.escape(idReferenciaComercial)};
  `;
    const result = await mysqlLib.query(queryString);
    return result;
  }

  async getAccionistas(idCertification) {
    const queryString = `
    SELECT * 
    FROM certification_accionistas
    WHERE id_certification = ${mysqlLib.escape(idCertification)};
  `;
    const result = await mysqlLib.query(queryString);
    return result;
  }

  async updateAccionista(body) {
    const queryString = `
      UPDATE certification_accionistas
      SET
        razon_social = ${mysqlLib.escape(body.razonSocial)},
        controlante = ${mysqlLib.escape(body.controlante)},
        rfc = ${mysqlLib.escape(body.rfc)},
        razon_sat_rfc = ${mysqlLib.escape(body.razon_sat_rfc)},
        updated_at = CURRENT_TIMESTAMP
      WHERE id_certification = ${mysqlLib.escape(body.idCertification)};
    `;
    const result = await mysqlLib.query(queryString);
    return result;
  }


  async updatePEBPCA(body) {
    const queryString = `
        UPDATE certification_partidas_estado_balance 
        SET
            id_tipo_cifra = ${body.id_tipo_cifra ?? null},
            compartir = '${body.compartir}',
            compartir_info_empresa = '${body.compartir_info_empresa}'
            caja_bancos = ${body.partida_estado_balance_periodo_contable_anterior.caja_bancos ?? null},
            saldo_cliente_cuenta_x_cobrar = ${body.partida_estado_balance_periodo_contable_anterior.saldo_cliente_cuenta_x_cobrar ?? null},
            saldo_inventarios = ${body.partida_estado_balance_periodo_contable_anterior.saldo_inventarios ?? null},
            deuda_corto_plazo = ${body.partida_estado_balance_periodo_contable_anterior.deuda_corto_plazo ?? null},
            deuda_total = ${body.partida_estado_balance_periodo_contable_anterior.deuda_total ?? null},
            capital_contable = ${body.partida_estado_balance_periodo_contable_anterior.capital_contable ?? null},
            total_capital_contable_pat = ${body.partida_estado_balance_periodo_contable_anterior.total_capital_contable_pat ?? null},
            periodo_actual = '${body.periodo_actual}',
            periodo_anterior = '${body.periodo_anterior}',
            periodo_previo_anterior = '${body.periodo_previo_anterior}'
        WHERE id_certification = ${body.id_certification}
    `;
    const result = await mysqlLib.query(queryString);
    if (result.result.affectedRows > 0) {
      return { success: true, message: 'Actualización exitosa' };
    } else {
      return { success: false, message: 'No se encontró el registro para actualizar' };
    }
  }

  async updatePEBPCPA(body) {
    const queryString = `
        UPDATE certification_partidas_estado_balance 
        SET
            id_tipo_cifra = ${body.id_tipo_cifra},
            compartir = '${body.compartir}',
            compartir_info_empresa = '${body.compartir_info_empresa}'
            caja_bancos = ${body.partida_estado_balance_periodo_contable_previo_anterior.caja_bancos ?? null},
            saldo_cliente_cuenta_x_cobrar = ${body.partida_estado_balance_periodo_contable_previo_anterior.saldo_cliente_cuenta_x_cobrar ?? null},
            saldo_inventarios = ${body.partida_estado_balance_periodo_contable_previo_anterior.saldo_inventarios ?? null},
            deuda_corto_plazo = ${body.partida_estado_balance_periodo_contable_previo_anterior.deuda_corto_plazo ?? null},
            deuda_total = ${body.partida_estado_balance_periodo_contable_previo_anterior.deuda_total ?? null},
            capital_contable = ${body.partida_estado_balance_periodo_contable_previo_anterior.capital_contable ?? null},
            total_capital_contable_pat = ${body.partida_estado_balance_periodo_contable_previo_anterior.total_capital_contable_pat ?? null},
            periodo_actual = '${body.periodo_actual}',
            periodo_anterior = '${body.periodo_anterior}',
            periodo_previo_anterior = '${body.periodo_previo_anterior}'
        WHERE id_certification = ${body.id_certification} AND tipo = 'previo_anterior'
    `;
    const result = await mysqlLib.query(queryString);
    if (result.result.affectedRows > 0) {
      return { success: true, message: 'Actualización exitosa' };
    } else {
      return { success: false, message: 'No se encontró el registro para actualizar' };
    }
  }

  async updatePERPCPA(body) {
    const per = body.partida_estado_resultado_periodo_contable_previo_anterior || {}
    const totalPartidas =
      (Number(per.ventas_anuales) || 0) +
      (Number(per.costo_ventas_anuales) || 0) +
      (Number(per.utilidad_bruta) || 0) +
      (Number(per.gastos_administracion) || 0) +
      (Number(per.utilidad_operativa) || 0) +
      (Number(per.depreciacion_amortizacion) || 0) +
      (Number(per.otros_ingresos) || 0) +
      (Number(per.otros_gastos) || 0) +
      (Number(per.gastos_productos_financieros) || 0) +
      (Number(per.otros_egresos) || 0) +
      (Number(per.utilidad_neta) || 0)
    const queryString = `
        UPDATE certification_partidas_estado_resultados_contables
        SET
            compartir = '${body.compartir}',
            ventas_anuales = ${per.ventas_anuales ?? null},
            costo_ventas_anuales = ${per.costo_ventas_anuales ?? null},
            utilidad_operativa = ${per.utilidad_operativa ?? null},
            total_partidas_estado_resultado = ${totalPartidas},
            periodo_actual = '${body.periodo_actual}',
            periodo_anterior = '${body.periodo_anterior}',
            periodo_previo_anterior = '${body.periodo_previo_anterior}'
        WHERE id_certification = ${body.id_certification} AND tipo = 'previo_anterior'
    `;
    const result = await mysqlLib.query(queryString);
    if (result.result.affectedRows > 0) {
      return { success: true, message: 'Actualización exitosa' };
    } else {
      return { success: false, message: 'No se encontró el registro para actualizar' };
    }
  }

  async updatePERPCA(body) {
    const per = body.partida_estado_resultado_periodo_contable_anterior || {}
    const totalPartidas =
      (Number(per.ventas_anuales) || 0) +
      (Number(per.costo_ventas_anuales) || 0) +
      (Number(per.utilidad_bruta) || 0) +
      (Number(per.gastos_administracion) || 0) +
      (Number(per.utilidad_operativa) || 0) +
      (Number(per.depreciacion_amortizacion) || 0) +
      (Number(per.otros_ingresos) || 0) +
      (Number(per.otros_gastos) || 0) +
      (Number(per.gastos_productos_financieros) || 0) +
      (Number(per.otros_egresos) || 0) +
      (Number(per.utilidad_neta) || 0)
    const queryString = `
      UPDATE certification_partidas_estado_resultados_contables
      SET
          compartir = '${body.compartir}',
          ventas_anuales = ${per.ventas_anuales ?? null},
          costo_ventas_anuales = ${per.costo_ventas_anuales ?? null},
          utilidad_operativa = ${per.utilidad_operativa ?? null},
          total_partidas_estado_resultado = ${totalPartidas},
          periodo_actual = '${body.periodo_actual}',
          periodo_anterior = '${body.periodo_anterior}',
          periodo_previo_anterior = '${body.periodo_previo_anterior}'
      WHERE id_certification = ${body.id_certification} AND tipo = 'anterior'
  `;
    const result = await mysqlLib.query(queryString);
    if (result.result.affectedRows > 0) {
      return { success: true, message: 'Actualización exitosa' };
    } else {
      return { success: false, message: 'No se encontró el registro para actualizar' };
    }
  }

  async updateReferenciaComercial(referencias_comerciales, id_certification) {
    const queryString = `
      UPDATE certification_referencia_comercial 
      SET
          razon_social = '${referencias_comerciales.razon_social}',
          rfc = '${referencias_comerciales.rfc}'
      WHERE id_certification = ${id_certification}
  `
    const result = await mysqlLib.query(queryString)
    return result
  }

  async actualizaDireccionReferenciaComercial(data) {
    const { id_direccion, calle, numero, ciudad, estado, codigo_postal, pais } = data.datos_empresa_contacto.direccion_fiscal
    const queryString = `
      UPDATE domicilio 
      SET
        calle = '${calle}',
        numero = '${numero}',
        ciudad = '${ciudad}',
        estado = '${estado}',
        codigo_postal = '${codigo_postal}',
        pais = ${pais}
      WHERE domicilio_id = ${id_direccion}
  `
    const result = await mysqlLib.query(queryString)
    return result
  }

  /*async actualizaReferenciaComercial(data) {
    const { id_referencia, razon_social, denominacion, rfc } = data.datos_empresa_contacto
    const queryString = `
      UPDATE certification_referencia_comercial 
      SET
        razon_social = '${razon_social}',
        denominacion = ${denominacion},
        rfc = '${rfc}'
      WHERE id_certification_referencia_comercial = ${id_referencia}
  `
    const result = await mysqlLib.query(queryString)
    return result
  }*/


  async actualizaReferenciaComercial(data) {
    const { id_certification } = data
    const { id_referencia, razon_social, denominacion, rfc } = data.datos_empresa_contacto

    const queryString = `
       UPDATE certification_referencia_comercial 
       SET
          id_certification = ${id_certification},
          contestada = 'si',
           razon_social = '${razon_social}',
           denominacion = ${denominacion},
           rfc = '${rfc}'
       WHERE id_certification_referencia_comercial = ${id_referencia}
   `;

    const result = await mysqlLib.query(queryString);
    return result;
  }

  async actualizaReferenciaComercialIdCertification(data, old_id_certification) {
    const { id_certification } = data

    const queryString = `
       UPDATE certification_referencia_comercial 
       SET
          id_certification = ${id_certification}
       WHERE id_certification = ${old_id_certification}
   `;

    const { result } = await mysqlLib.query(queryString);
    return result
  }

  async insertEmpresaCliente(data) {
    const { id_empresa_cliente_contacto,
      razon_social,
      denominacion,
      rfc,
      homoclave,
      email,
      moneda,
      linea_credito_otorgada,
      plazo_credito_dso,
      fecha_otorgamiento_linea_credito,
      saldo_vigente_linea_credito,
      saldo_vencido_linea_credito,
      dias_atraso,
      resultado_experiencia_pagos,
      antiguedad_relacion
    } = data.datos_cliente

    const { porcentaje_deuda } = data

    const queryString = `
      UPDATE certification_empresa_cliente_contacto
      SET
        razon_social = '${razon_social}',
        denominacion = ${denominacion},
        rfc = '${rfc}',
        homoclave = '${homoclave}',
        email = '${email}',
        moneda = '${moneda}',
        porcentaje_deuda = '${porcentaje_deuda}',
        linea_credito = '${linea_credito_otorgada}',
        plazo = '${plazo_credito_dso}',
        fecha_otorgamiento_linea_credito = '${fecha_otorgamiento_linea_credito}',
        monto_saldo_vigente_linea_credito = '${saldo_vigente_linea_credito}',
        monto_saldo_vencido_linea_credito = '${saldo_vencido_linea_credito}',
        dias_atraso = '${dias_atraso}',
        calificacion_referencia = '${resultado_experiencia_pagos}',
        antiguedad_relacion = '${antiguedad_relacion}'
      WHERE id_empresa_cliente_contacto = ${id_empresa_cliente_contacto}
  `;
    const result = await mysqlLib.query(queryString)
    return result
  }

  async getTelefonoContacto(id_contacto) {
    const queryString = `
    SELECT telefono_contacto
    FROM certification_contacto
    WHERE id_certification_contacto = ${id_contacto};
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getTelefonosContacto(telefono_contacto, id_referencia) {
    const queryString = `
    SELECT count(*) AS referencias_telefonicas
    FROM certification_contacto
    WHERE id_certification_referencia_comercial <> ${id_referencia} AND telefono_contacto = '${telefono_contacto}';
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getFechaReporteCredito(id_certification) {
    const queryString = `
    SELECT created_at AS fecha_generado
    FROM reporte_credito
    WHERE reporte_pdf IS NOT NULL
    AND id_certification = ${id_certification}
    ORDER BY created_at DESC;
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getDataReporteCreditoDescriptivo(id_certification) {
    const queryString = `
    SELECT created_at AS fecha_generado
    FROM reporte_credito_descriptivo
    WHERE reporte_pdf IS NOT NULL
    AND id_certification = ${id_certification}
    ORDER BY created_at DESC;
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getDataReporteCredito(id_certification) {
    const queryString = `
    SELECT
      monto_solicitado,
      plazo,
      id_reporte_credito,
      created_at
    FROM reporte_credito
    WHERE reporte_pdf IS NOT NULL
    AND id_certification = ${id_certification}

    UNION ALL

    SELECT
      monto_solicitado,
      plazo,
      id_reporte_credito,
      created_at
    FROM reporte_credito_descriptivo
    WHERE reporte_pdf IS NOT NULL
    AND id_certification = ${id_certification}

    ORDER BY created_at DESC
    LIMIT 1;
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getSolicitudCreditoById(id_reporte_credito) {
    const queryString = `
    SELECT
      monto_solicitado,
      plazo,
      id_solicitud_credito,
      id_cliente,
      id_proveedor
    FROM solicitud_credito
    WHERE id_solicitud_credito = ${id_reporte_credito};
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getEmailProveedorByIdProveedor(id_proveedor) {
    const queryString = `
    SELECT
      u.usu_email AS email_proveedor,
      CONCAT(e.emp_razon_social, ' ', d.denominacion) AS empresa_proveedor
    FROM empresa AS e
    LEFT JOIN empresa_usuario AS eu ON e.emp_id = eu.emp_id
    LEFT JOIN usuario AS u ON eu.usu_id = u.usu_id
    LEFT JOIN cat_denominacion AS d ON d.id = e.denominacion
    WHERE e.emp_id = ${id_proveedor}
    ORDER BY u.created_at ASC
    LIMIT 1;
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async actualizaReferenciaValida(data, id_referencia, ip_cliente) {
    const { referencia_valida, causas_referencia_no_valida } = data
    const queryString = `
      UPDATE certification_referencia_comercial
      SET
        referencia_valida = '${referencia_valida}',
        observaciones = '${causas_referencia_no_valida}',
        contestada = 'si',
        ip_cliente = '${ip_cliente}'
      WHERE id_certification_referencia_comercial = ${id_referencia}
  ;`
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  // async obtieneEstatusRespuesta(id_referencia) {
  //   const queryString = `
  //   SELECT contestada
  //   FROM certification_referencia_comercial
  //   WHERE id_certification_referencia_comercial = ${id_referencia};
  // `
  //   const { result } = await mysqlLib.query(queryString)
  //   return result
  // }

  async obtieneEstatusRespuesta(id_referencia) {
    const queryString = `
      SELECT contestada
      FROM certification_referencia_comercial
      WHERE id_certification_referencia_comercial = ${id_referencia};
    `
    try {
      // Usando el método mysqlQuery de mysqlLib para ejecutar la consulta
      const { result } = await mysqlLib.mysqlQuery('GET', queryString)  // Cambié query a mysqlQuery aquí
      return result
    } catch (error) {
      logger.error('Error en obtieneEstatusRespuesta: ', error)  // Log de error en caso de fallo
      throw error  // Puedes lanzar el error o manejarlo según necesites
    }
  }

  async obtieneIdEmpresaByIdCertification(id_certification) {
    const queryString = `
    SELECT id_empresa
    FROM certification
    WHERE id_certification = ${id_certification};
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async obtieneUltimoIdCertification(id_empresa) {
    const queryString = `
    SELECT id_certification
    FROM certification
    WHERE id_empresa = ${id_empresa} AND estatus_certificacion = 'inicial';
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async actualizaContacto(data) {
    const { id_contacto, nombre_contacto, correo_contacto } = data.datos_contacto
    const queryString = `
      UPDATE certification_contacto
      SET
        nombre_contacto = '${nombre_contacto}',
        correo_contacto = '${correo_contacto}'
      WHERE id_certification_contacto = ${id_contacto}
  ;`
    const result = await mysqlLib.query(queryString)
    return result
  }

  async updateContacto(contacto, id_certification_referencia_comercial) {
    const queryString = `
    UPDATE certification_contacto
    SET nombre_contacto = '${contacto.nombre_contacto}',
        correo_contacto = '${contacto.correo_contacto}',
        telefono_contacto = '${contacto.telefono_contacto}'
    WHERE id_certification_referencia_comercial = ${id_certification_referencia_comercial}
    AND id_certification_contacto = ${contacto.id_certification_contacto}
  `;
    const result = await mysqlLib.query(queryString);
    return result;
  }

  async getContacto(id_contacto) {
    const queryString = `
    SELECT
     *
    FROM certification_contacto
    WHERE id_certification_contacto = ${id_contacto};
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getContactos(id_referencia_comercial) {
    const queryString = `
      SELECT
       *
      FROM certification_contacto
      WHERE id_certification_referencia_comercial = ${id_referencia_comercial};
    `;
    const { result } = await mysqlLib.query(queryString);
    return result
  }

  async getCertificacionByEmpresa(id_empresa) {
    const queryString = `
     SELECT
        cert.id_certification,
        cert.id_usuario,
        cert.id_pais,
				cpa.nombre AS nombre_pais,
        cert.representante_legal,
        cert.nrp,
        cert.industria_id,
        cert.id_cat_sector_riesgo_sectorial,
        cert.id_cat_sector_clientes_finales,
        cert.plantilla_laboral,
        cert.id_cat_tiempo_actividad_comercial,
        cert.estatus_certificacion,
        cert._69b
      FROM
          certification AS cert
			LEFT JOIN cat_pais_algoritmo AS cpa ON cpa.id_pais_algoritmo = cert.id_pais
      WHERE
      cert.id_certification = (
          SELECT MAX(id_certification)
          FROM certification
          WHERE id_empresa = ${id_empresa}
      )
      AND cert.id_empresa = ${id_empresa};
      `;
    const result = await mysqlLib.query(queryString);
    return result;
  }

  async getCertificacionByUsuario(id_usuario) {
    const queryString = `
      SELECT
    cert.id_certification,
    cert.id_usuario,
    cert.id_pais,
    cert.nrp,
    cert.industria_id,
    cert.id_cat_sector_riesgo_sectorial,
    cert.id_cat_sector_clientes_finales,
    cert.plantilla_laboral,
    cert.id_cat_tiempo_actividad_comercial,
    cert.estatus_certificacion
FROM
    certification cert
WHERE
    cert.id_certification = (
        SELECT MAX(id_certification)
        FROM certification
        WHERE id_usuario = ${id_usuario}
    )
    AND cert.id_usuario = ${id_usuario} AND cert.estatus_certificacion = 'inicial';
    `;
    const result = await mysqlLib.query(queryString);
    return result;
  }

  async updateEstatusCertificacion(id_certification, estatus_certificacion) {
    const queryString = `
    UPDATE certification
    SET estatus_certificacion = '${estatus_certificacion}'
    WHERE id_certification = ${id_certification}
  `;
    const result = await mysqlLib.query(queryString);
    return result;
  }

  async updateIdCertificationAccionistas(id_certification, oldId) {
    const queryString = `
    UPDATE certification_accionistas
    SET id_certification = '${id_certification}'
    WHERE id_certification = ${oldId}
  `;
    const result = await mysqlLib.query(queryString);
    return result;
  }

  async updateIdCertificationDemandas(id_certification, oldId) {
    const queryString = `
    UPDATE certification_demandas
    SET id_certification = '${id_certification}'
    WHERE id_certification = ${oldId}
  `;
    const result = await mysqlLib.query(queryString);
    return result;
  }

  async updateIdCertificationDocumentos(id_certification, oldId) {
    const queryString = `
    UPDATE certification_documentos
    SET id_certification = '${id_certification}'
    WHERE id_certification = ${oldId}
  `;
    const result = await mysqlLib.query(queryString);
    return result;
  }

  async updateIdCertificationEstadoBalance(id_certification, oldId) {
    const queryString = `
    UPDATE certification_partidas_estado_balance
    SET id_certification = '${id_certification}'
    WHERE id_certification = ${oldId}
  `;
    const result = await mysqlLib.query(queryString);
    return result;
  }

  async updateIdCertificationEstadoResultados(id_certification, oldId) {
    const queryString = `
    UPDATE certification_partidas_estado_resultados_contables
    SET id_certification = '${id_certification}'
    WHERE id_certification = ${oldId}
  `;
    const result = await mysqlLib.query(queryString);
    return result;
  }

  async updateIdCertificationReferenciaComercial(id_certification, oldId) {
    const queryString = `
    UPDATE certification_referencia_comercial
    SET id_certification = '${id_certification}'
    WHERE id_certification = ${oldId}
  `;
    const result = await mysqlLib.query(queryString);
    return result;
  }

  async updateIdCertificationEmpresasRelacionadas(id_certification, oldId) {
    const queryString = `
    UPDATE certification_empresas_relacionadas
    SET id_certification = '${id_certification}'
    WHERE id_certification = ${oldId}
  `;
    const result = await mysqlLib.query(queryString);
    return result;
  }

  async getEmpresasRelacionadasByCertification(id_certification) {
    const queryString = `
    SELECT 
      cer.id_empresa_relacionada, 
      cer.id_certification, 
      cer.razon_social, 
      cpa.id_pais_algoritmo AS id_pais,
      cpa.nombre AS pais 
    FROM certification_empresas_relacionadas AS cer
    JOIN cat_pais_algoritmo AS cpa
    ON cer.pais = cpa.id_pais_algoritmo 
    WHERE cer.id_certification = '${id_certification}'
    `;
    const result = await mysqlLib.query(queryString, [id_certification]);
    return result; // Devuelve los datos encontrados
  }

  /* SELECT * FROM certification_empresas_relacionadas
    WHERE id_certification = '${id_certification}' */

  async getVariacionesSignificativasByCertification(id_certification) {
    // suponiendo MySQL 8+, usando created_at
    const query = `
    SELECT *
    FROM variaciones_significativas
    WHERE id_certification = ${id_certification}
    ORDER BY created_at DESC
    LIMIT 1;
  `
    const { result } = await mysqlLib.query(query)
    return result          // fila más reciente global
  }



  async insertVariacionesSignificativasResultado(id_certification, insertData) {
    try {
      const safeGet = (obj, path) => {
        return path
          .split('.')
          .reduce((o, k) => (o && o[k] != null ? o[k] : null), obj)
      }

      const incremento_caja_bancos = safeGet(insertData, 'incremento_caja_bancos') ?? 'NO'
      const variacion_anual_caja_bancos = Number(
        safeGet(insertData, 'variacion_anual_caja_bancos') ?? 0
      )
      const incremento_ventas_anuales = safeGet(insertData, 'incremento_ventas_anuales') ?? 'NO'
      const variacion_anual_ventas_anuales = Number(
        safeGet(insertData, 'variacion_anual_ventas_anuales') ?? 0
      )
      const decremento_costo_ventas_anuales = safeGet(
        insertData,
        'decremento_costo_ventas_anuales'
      ) ?? 'NO';
      const variacion_anual_costo_ventas_anuales = Number(
        safeGet(insertData, 'variacion_anual_costo_ventas_anuales') ?? 0
      )
      const decremento_gastos_administracion = safeGet(
        insertData,
        'decremento_gastos_administracion'
      ) ?? 'NO'
      const variacion_anual_gastos_administracion = Number(
        safeGet(insertData, 'variacion_anual_gastos_administracion') ?? 0
      )
      const incremento_utilidad_operativa = safeGet(
        insertData,
        'incremento_utilidad_operativa'
      ) ?? 'NO'
      const variacion_anual_utilidad_operativa = Number(
        safeGet(insertData, 'variacion_anual_utilidad_operativa') ?? 0
      )
      const incremento_total_activo = safeGet(insertData, 'incremento_total_activo') ?? 'NO';
      const variacion_anual_total_activo = Number(
        safeGet(insertData, 'variacion_anual_total_activo') ?? 0
      )
      const decremento_total_pasivo = safeGet(insertData, 'decremento_total_pasivo') ?? 'NO';
      const variacion_anual_total_pasivo = Number(
        safeGet(insertData, 'variacion_anual_total_pasivo') ?? 0
      )
      const incremento_capital_social = safeGet(insertData, 'incremento_capital_social') ?? 'NO';
      const variacion_anual_capital_social = Number(
        safeGet(insertData, 'variacion_anual_capital_social') ?? 0
      )
      const decremento_capital_social = safeGet(insertData, 'decremento_capital_social') ?? 'NO';

      const incremento_capital_contable = safeGet(
        insertData,
        'incremento_capital_contable'
      ) ?? 'NO'

      const decremento_capital_contable = safeGet(
        insertData,
        'decremento_capital_contable'
      ) ?? 'NO'


      const variacion_anual_capital_contable = Number(
        safeGet(insertData, 'variacion_anual_capital_contable') ?? 0
      )

      // Preparar el arreglo de valores en el mismo orden de las columnas
      const valores = [
        id_certification,
        incremento_caja_bancos,
        variacion_anual_caja_bancos,
        incremento_ventas_anuales,
        variacion_anual_ventas_anuales,
        decremento_costo_ventas_anuales,
        variacion_anual_costo_ventas_anuales,
        decremento_gastos_administracion,
        variacion_anual_gastos_administracion,
        incremento_utilidad_operativa,
        variacion_anual_utilidad_operativa,
        incremento_total_activo,
        variacion_anual_total_activo,
        decremento_total_pasivo,
        variacion_anual_total_pasivo,
        incremento_capital_social,
        variacion_anual_capital_social,
        decremento_capital_social,
        incremento_capital_contable,
        decremento_capital_contable,
        variacion_anual_capital_contable
      ];

      // Construir la parte VALUES del INSERT, cuidando tipos (strings entre comillas, números sin comillas)
      const valuesClause = valores
        .map((v) => {
          if (typeof v === 'string') {
            // Escapamos comillas simples en la cadena si existen
            const escaped = v.replace(/'/g, "\\'");
            return `'${escaped}'`;
          } else {
            // Ya es número
            return Number(v);
          }
        })
        .join(', ');

      const queryString = `
      INSERT INTO variaciones_significativas (
        id_certification,
        incremento_caja_bancos,
        variacion_anual_caja_bancos,
        incremento_ventas_anuales,
        variacion_anual_ventas_anuales,
        decremento_costo_ventas_anuales,
        variacion_anual_costo_ventas_anuales,
        decremento_gastos_administracion,
        variacion_anual_gastos_administracion,
        incremento_utilidad_operativa,
        variacion_anual_utilidad_operativa,
        incremento_total_activo,
        variacion_anual_total_activo,
        decremento_total_pasivo,
        variacion_anual_total_pasivo,
        incremento_capital_social,
        variacion_anual_capital_social,
        decremento_capital_social,
        incremento_capital_contable,
        decremento_capital_contable,
        variacion_anual_capital_contable
      ) VALUES (${valuesClause});
    `

      const result = await mysqlLib.query(queryString)
      return result
    } catch (error) {
      throw new Error(`Error al insertar variaciones significativas: ${error.message}`)
    }
  }


  async insertCalculoRatiosFinancieros(id_certification, insertData) {
    try {
      const safeGet = (obj, path) => {
        return path.split('.').reduce((o, k) => (o && o[k] != null ? o[k] : 0.0), obj);
      };

      const valores = [
        id_certification,
        safeGet(insertData, 'r1_capital_trabajo_numero_veces.razon_circulante_anterior'),
        safeGet(insertData, 'r1_capital_trabajo_numero_veces.razon_circulante_previo_anterior'),
        safeGet(insertData, 'r2_capital_trabajo_valor_nominal.capital_trabajo_anterior'),
        safeGet(insertData, 'r2_capital_trabajo_valor_nominal.capital_trabajo_previo_anterior'),
        safeGet(insertData, 'r3_prueba_acida_numero_veces.prueba_acida_numero_veces_anterior'),
        safeGet(insertData, 'r3_prueba_acida_numero_veces.prueba_acida_numero_veces_previo_anterior'),
        safeGet(insertData, 'r4_grado_general_endeudamiento_numero_veces.grado_general_endeudamiento_anterior'),
        safeGet(insertData, 'r4_grado_general_endeudamiento_numero_veces.grado_general_endeudamiento_previo_anterior'),
        safeGet(insertData, 'r5_apalancamiento_financiero_numero_veces.apalancamiento_anterior'),
        safeGet(insertData, 'r5_apalancamiento_financiero_numero_veces.apalancamiento_previo_anterior'),
        safeGet(insertData, 'r6_rotacion_inventarios_numero_veces.rotacion_inventarios_numero_veces_anterior'),
        safeGet(insertData, 'r6_rotacion_inventarios_numero_veces.rotacion_inventarios_numero_veces_previo_anterior'),
        safeGet(insertData, 'r7_rotacion_inventarios_dias.rotacion_inventarios_dias_anterior'),
        safeGet(insertData, 'r7_rotacion_inventarios_dias.rotacion_inventarios_dias_previo_anterior'),
        safeGet(insertData, 'r8_rotacion_cuentas_x_cobrar_dias.rotacion_cuentas_x_cobrar_dias_anterior'),
        safeGet(insertData, 'r8_rotacion_cuentas_x_cobrar_dias.rotacion_cuentas_x_cobrar_dias_previo_anterior'),
        safeGet(insertData, 'r9_rotacion_pagos_dias.rotacion_pagos_dias_anterior'),
        safeGet(insertData, 'r9_rotacion_pagos_dias.rotacion_pagos_dias_previo_anterior'),
        safeGet(insertData, 'r10_solvencia_deuda_total_sobre_capital.solvencia_deuda_total_sobre_capital_anterior'),
        safeGet(insertData, 'r10_solvencia_deuda_total_sobre_capital.solvencia_deuda_total_sobre_capital_previo_anterior'),
        safeGet(insertData, 'r11_retorno_sobre_capital_acciones.retorno_sobre_capital_acciones_anterior'),
        safeGet(insertData, 'r11_retorno_sobre_capital_acciones.retorno_sobre_capital_acciones_previo_anterior'),
        safeGet(insertData, 'r12_rendimiento_capital.rendimiento_capital_anterior'),
        safeGet(insertData, 'r12_rendimiento_capital.rendimiento_capital_previo_anterior'),
        safeGet(insertData, 'r13_rendimiento_activos.rendimiento_activos_anterior'),
        safeGet(insertData, 'r13_rendimiento_activos.rendimiento_activos_previo_anterior')
      ];

      const queryString = `
      INSERT INTO certification_ratios_financieros (
        id_certification,
        formula_1_capital_trabajo_anterior,
        formula_1_capital_trabajo_previo_anterior,
        formula_2_capital_trabajo_anterior,
        formula_2_capital_trabajo_previo_anterior,
        prueba_acida_anterior,
        prueba_acida_previo_anterior,
        grado_general_endeudamiento_anterior,
        grado_general_endeudamiento_previo_anterior,
        apalancamiento_anterior,
        apalancamiento_previo_anterior,
        formula_1_inventarios_rotacion_anterior,
        formula_1_inventarios_rotacion_previo_anterior,
        formula_2_inventarios_rotacion_anterior,
        formula_2_inventarios_rotacion_previo_anterior,
        rotacion_ctas_x_cobrar_anterior,
        rotacion_ctas_x_cobrar_previo_anterior,
        rotacion_pagos_anterior,
        rotacion_pagos_previo_anterior,
        solvencia_anterior,
        solvencia_previo_anterior,
        retorno_capital_acciones_anterior,
        retorno_capital_acciones_previo_anterior,
        rendimiento_capital_anterior,
        rendimiento_capital_previo_anterior,
        rendimiento_activos_anterior,
        rendimiento_activos_previo_anterior
      ) 
      VALUES (${valores.map(v => Number(v).toFixed(4)).join(', ')});
    `;

      const result = await mysqlLib.query(queryString);
      return result;

    } catch (error) {
      throw new Error(`Error al insertar ratios financieros: ${error.message}`);
    }
  }

  async insertCalculoEstadoResultado(id_certification, data) {
    try {
      const {
        operacion_utilidad_bruta_anterior,
        operacion_utilidad_bruta_previo_anterior,
        operacion_utilidad_operacion_anterior,
        operacion_utilidad_operacion_previo_anterior,
        utilidad_neta_anterior,
        utilidad_neta_previo_anterior,
      } = data

      const valores = [
        id_certification,
        operacion_utilidad_bruta_anterior ?? 0.00,
        operacion_utilidad_bruta_previo_anterior ?? 0.00,
        operacion_utilidad_operacion_anterior ?? 0.00,
        operacion_utilidad_operacion_previo_anterior ?? 0.00,
        utilidad_neta_anterior ?? 0.00,
        utilidad_neta_previo_anterior ?? 0.00
      ]

      const queryString = `
        INSERT INTO certification_calculos_estado_resultado (
        id_certification,
        operacion_utilidad_bruta_anterior,
        operacion_utilidad_bruta_previo_anterior,
        operacion_utilidad_operacion_anterior,
        operacion_utilidad_operacion_previo_anterior,
        utilidad_neta_anterior,
        utilidad_neta_previo_anterior
      )
      VALUES (
            ${valores.join(',')}
        );
    `;
      logger.info(`${JSON.stringify(queryString)}`)
      const result = await mysqlLib.query(queryString)
      return result
    } catch (error) {
      throw new Error(`Error al insertar datos en insertCalculoEstadoResultado: ${error.message}`);
    }
  }

  async insertCalculoEstadoBalance(id_certification, data) {
    try {
      const {
        total_activo_anterior,
        total_activo_circulante_anterior,
        total_activo_circulante_previo_anterior,
        total_activo_previo_anterior,
        total_activo_fijo_anterior,
        total_activo_fijo_previo_anterior,
        total_pasivo_largo_plazo_anterior,
        total_pasivo_largo_plazo_previo_anterior,
        total_capital_contable_anterior,
        total_capital_contable_previo_anterior,
        total_pasivo_anterior,
        total_pasivo_circulante_anterior,
        total_pasivo_circulante_previo_anterior,
        total_pasivo_previo_anterior } = data

      let valores = [
        id_certification,
        total_activo_anterior ?? 0.00,
        total_activo_circulante_anterior ?? 0.00,
        total_activo_circulante_previo_anterior ?? 0.00,
        total_activo_previo_anterior ?? 0.00,
        total_activo_fijo_anterior ?? 0.00,
        total_activo_fijo_previo_anterior ?? 0.00,
        total_pasivo_largo_plazo_anterior ?? 0.00,
        total_pasivo_largo_plazo_previo_anterior ?? 0.00,
        total_capital_contable_anterior ?? 0.00,
        total_capital_contable_previo_anterior ?? 0.00,
        total_pasivo_anterior ?? 0.00,
        total_pasivo_circulante_anterior ?? 0.00,
        total_pasivo_circulante_previo_anterior ?? 0.00,
        total_pasivo_previo_anterior ?? 0.00
      ]

      const queryString = `
        INSERT INTO certification_calculos_estado_balance (
          id_certification,
          total_activo_anterior,
          total_activo_circulante_anterior,
          total_activo_circulante_previo_anterior,
          total_activo_previo_anterior,
          total_activo_fijo_anterior,
          total_activo_fijo_previo_anterior,
          total_pasivo_largo_plazo_anterior,
          total_pasivo_largo_plazo_previo_anterior,
          total_capital_contable_anterior,
          total_capital_contable_previo_anterior,
          total_pasivo_anterior,
          total_pasivo_circulante_anterior,
          total_pasivo_circulante_previo_anterior,
          total_pasivo_previo_anterior
        ) 
        VALUES (
            ${valores.join(',')}
        );
    `;
      logger.info(`${JSON.stringify(queryString)}`)
      const result = await mysqlLib.query(queryString)
      return result
    } catch (error) {
      throw new Error(`Error al insertar datos en insertCalculoEstadoBalance: ${error.message}`);
    }
  }

  async updateSolicitudCredito(monto_solicitado, plazo, id_reporte_credito) {
    const queryString = `
      UPDATE solicitud_credito
      SET plazo = '${plazo}', 
          monto_solicitado = '${monto_solicitado}'
      WHERE id_solicitud_credito = '${id_reporte_credito}';

    `;
    await mysqlLib.query(queryString);
  }

  async getMontoPlazoSolicitados(id_solicitud_credito) {
    const queryString = `
      SELECT *
      FROM solicitud_credito
      WHERE id_solicitud_credito = '${id_solicitud_credito}';
  `;
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async insertReporteInformativo(idCertification, data, customUuid) {
    try {
      const {
        id_reporte_credito,
        _01_pais,
        _02_sector_riesgo,
        _03_capital_contable,
        _04_plantilla_laboral,
        _05_sector_cliente_final,
        _06_tiempo_actividad,
        _08_ventas_anuales,
        _09_tipo_cifras,
        _10_incidencias_legales,
        _11_evolucion_ventas,
        _12_apalancamiento,
        _13_flujo_neto,
        _14_payback,
        _15_rotacion_ctas_x_cobrar,
        _16_referencias_comerciales,
        monto_solicitado,
        alertas,
        reporte_pdf,
        wording_underwriting,
        plazo,
        dpo,
      } = data;

      logger.info(`Datos recibidos para la inserción R-I: ${JSON.stringify(data)}`);

      const escapeSingleQuotes = (value) => value.replace(/'/g, "''");

      const values = [
        id_reporte_credito,
        idCertification,
        `'${escapeSingleQuotes(customUuid)}'`,
        reporte_pdf !== undefined ? `'${reporte_pdf}'` : 'NULL',
        monto_solicitado !== undefined ? monto_solicitado : 'DEFAULT',
        plazo !== undefined ? plazo : 'DEFAULT',
        `'${escapeSingleQuotes(_01_pais?.descripcion ?? '')}'`,
        `'${escapeSingleQuotes(_02_sector_riesgo?.descripcion ?? '')}'`,
        `'${escapeSingleQuotes(_03_capital_contable?.descripcion ?? '')}'`,
        _03_capital_contable?.parametro !== undefined ? _03_capital_contable.parametro : 'NULL',
        _03_capital_contable?.limite_inferior !== undefined ? _03_capital_contable.limite_inferior : 'NULL',
        _03_capital_contable?.limite_superior !== undefined ? _03_capital_contable.limite_superior : 'NULL',
        `'${escapeSingleQuotes(_04_plantilla_laboral?.descripcion ?? '')}'`,
        _04_plantilla_laboral?.parametro !== undefined ? _04_plantilla_laboral.parametro : 'DEFAULT',
        _04_plantilla_laboral?.limite_inferior !== undefined ? _04_plantilla_laboral.limite_inferior : 'DEFAULT',
        _04_plantilla_laboral?.limite_superior !== undefined ? _04_plantilla_laboral.limite_superior : 'DEFAULT',
        `'${escapeSingleQuotes(_05_sector_cliente_final?.descripcion ?? '')}'`,
        `'${escapeSingleQuotes(_06_tiempo_actividad?.descripcion ?? '')}'`,
        `'${escapeSingleQuotes(_08_ventas_anuales?.descripcion ?? '')}'`,
        _08_ventas_anuales?.parametro !== undefined ? _08_ventas_anuales.parametro : 'NULL',
        _08_ventas_anuales?.limite_inferior !== undefined ? _08_ventas_anuales.limite_inferior : 'NULL',
        _08_ventas_anuales?.limite_superior !== undefined ? _08_ventas_anuales.limite_superior : 'NULL',
        `'${escapeSingleQuotes(_09_tipo_cifras?.descripcion ?? '')}'`,
        `'${escapeSingleQuotes(_10_incidencias_legales?.tipo ?? '')}'`,
        `'${escapeSingleQuotes(_10_incidencias_legales?.caso ?? '')}'`,
        `'${escapeSingleQuotes(_11_evolucion_ventas?.descripcion ?? '')}'`,
        _11_evolucion_ventas?.parametro !== undefined ? `'${_11_evolucion_ventas.parametro}'` : 'NULL',
        `'${escapeSingleQuotes(_11_evolucion_ventas?.rango ?? '')}'`,
        `'${escapeSingleQuotes(_12_apalancamiento?.descripcion ?? '')}'`,
        _12_apalancamiento?.parametro !== undefined ? _12_apalancamiento.parametro : 'NULL',
        _12_apalancamiento?.limite_inferior !== undefined ? _12_apalancamiento.limite_inferior : 'NULL',
        _12_apalancamiento?.limite_superior !== undefined ? _12_apalancamiento.limite_superior : 'NULL',
        `'${escapeSingleQuotes(_13_flujo_neto?.descripcion ?? '')}'`,
        _13_flujo_neto?.parametro !== undefined && _13_flujo_neto?.parametro !== '' ? `'${_13_flujo_neto.parametro}'` : 'NULL',
        _13_flujo_neto?.limite_inferior !== undefined && _13_flujo_neto.limite_inferior !== '' ? _13_flujo_neto.limite_inferior : 'NULL',
        _13_flujo_neto?.limite_superior !== undefined && _13_flujo_neto.limite_superior !== '' ? _13_flujo_neto.limite_superior : 'NULL',
        _14_payback?.descripcion !== undefined && _14_payback?.descripcion !== null && _14_payback?.descripcion !== '' ? `'${_14_payback?.descripcion}'` : 'NULL',
        _14_payback?.parametro !== undefined ? _14_payback.parametro : 'NULL',
        _14_payback?.limite_inferior !== undefined ? _14_payback.limite_inferior : 'NULL',
        _14_payback?.limite_superior !== undefined ? _14_payback.limite_superior : 'NULL',
        `'${escapeSingleQuotes(_15_rotacion_ctas_x_cobrar?.descripcion ?? '')}'`,
        _15_rotacion_ctas_x_cobrar?.limite_inferior !== undefined ? _15_rotacion_ctas_x_cobrar.limite_inferior : 'NULL',
        _15_rotacion_ctas_x_cobrar?.limite_superior !== undefined ? _15_rotacion_ctas_x_cobrar.limite_superior : 'NULL',
        _16_referencias_comerciales?.descripcion !== undefined && _16_referencias_comerciales?.descripcion !== null && _16_referencias_comerciales?.descripcion !== '' ? `'${_16_referencias_comerciales.descripcion}'` : 'NULL',
        alertas?.porcentaje_endeudamiento !== undefined ? alertas.porcentaje_endeudamiento : 'DEFAULT',
        alertas?.dias_plazo_credito !== undefined ? alertas.dias_plazo_credito : 'DEFAULT',
        `'${escapeSingleQuotes(alertas?.texto_reporte_plazo_credito ?? '')}'`,
        `'${escapeSingleQuotes(wording_underwriting ?? '')}'`,
        dpo !== undefined ? dpo : 'NULL'
      ];

      logger.info(`Valores en la inserción R-I: ${JSON.stringify(values)}`);

      // Construir la consulta SQL manualmente
      const queryString = `
            INSERT INTO reporte_credito_descriptivo (
                id_reporte_credito,
                id_certification,
                folio,
                reporte_pdf,
                monto_solicitado,
                plazo,
                _01_pais_descripcion,
                _02_sector_riesgo_descripcion,
                _03_capital_contable_descripcion,
                _03_capital_contable_parametro,
                _03_capital_contable_limite_inferior,
                _03_capital_contable_limite_superior,
                _04_plantilla_laboral_descripcion,
                _04_plantilla_laboral_parametro,
                _04_plantilla_laboral_limite_inferior,
                _04_plantilla_laboral_limite_superior,
                _05_sector_cliente_final_descripcion,
                _06_tiempo_actividad_descripcion,
                _08_ventas_anuales_descripcion,
                _08_ventas_anuales_parametro,
                _08_ventas_anuales_limite_inferior,
                _08_ventas_anuales_limite_superior,
                _09_tipo_cifras_descripcion,
                _10_incidencia_legal_tipo,
                _10_incidencia_legal_caso,
                _11_evolucion_ventas_descripcion,
                _11_evolucion_ventas_parametro,
                _11_evolucion_ventas_rango,
                _12_apalancamiento_descripcion,
                _12_apalancamiento_parametro,
                _12_apalancamiento_limite_inferior,
                _12_apalancamiento_limite_superior,
                _13_flujo_neto_descripcion,
                _13_flujo_neto_parametro,
                _13_flujo_neto_limite_inferior,
                _13_flujo_neto_limite_superior,
                _14_payback_descripcion,
                _14_payback_parametro,
                _14_payback_limite_inferior,
                _14_payback_limite_superior,
                _15_rotacion_ctas_x_cobrar_descripcion,
                _15_rotacion_ctas_x_cobrar_limite_inferior,
                _15_rotacion_ctas_x_cobrar_limite_superior,
                _16_referencias_comerciales_descripcion,
                porcentaje_endeudamiento,
                dias_plazo_credito,
                texto_reporte_plazo_credito,
                wording_underwriting,
                dpo
            ) VALUES (
                ${values.join(',')}
            );
        `;

      logger.info(`Sentencia de inserción algoritmo: ${JSON.stringify(queryString)}`);

      const result = await mysqlLib.query(queryString);
      return result;
    } catch (error) {
      throw new Error(`Error al insertar datos en la tabla: ${error.message}`);
    }
  }


  async insertReporteCredito(idCertification, data, customUuid) {
    try {

      const {
        id_reporte_credito,
        _01_pais,
        _02_sector_riesgo,
        _03_capital_contable,
        _04_plantilla_laboral,
        _05_sector_cliente_final,
        _06_tiempo_actividad,
        _08_ventas_anuales,
        _09_tipo_cifras,
        _10_incidencias_legales,
        _11_evolucion_ventas,
        _12_apalancamiento,
        _13_flujo_neto,
        _14_payback,
        _15_rotacion_ctas_x_cobrar,
        _16_referencias_comerciales,
        alertas,
        monto_solicitado,
        plazo,
        monto_sugerido,
        _07_influencia_controlante_score,
        _07_influencia_controlante_regla,
        _07_influencia_controlante_empresa,
        _07_influencia_controlante_demandas_penales,
        _07_influencia_controlante_demandas_mercantiles,
        _07_influencia_controlante_sat_69b,
        _07_influencia_controlante_ofac,
        _07_influencia_controlante_mercantiles_proveedores,
        _07_influencia_controlante_contratistas_boletinados,
        score,
        wording_underwriting,
        reporte_pdf,
        dpo
      } = data

      logger.info(`Dator recibidos para la insercion: ${JSON.stringify(data)}`)

      const rawValues = [
        id_reporte_credito,
        idCertification,
        customUuid,
        reporte_pdf !== undefined ? reporte_pdf : null,
        monto_solicitado !== undefined ? monto_solicitado : 'DEFAULT',
        plazo !== undefined ? plazo : 'DEFAULT',
        monto_sugerido !== undefined ? monto_sugerido : 'DEFAULT',
        _01_pais?.descripcion ?? '',
        _01_pais?.score !== undefined ? _01_pais.score : 'DEFAULT',
        _02_sector_riesgo?.descripcion ?? '',
        _02_sector_riesgo?.score !== undefined ? _02_sector_riesgo.score : 'DEFAULT',
        _03_capital_contable?.descripcion ?? '',
        _03_capital_contable?.score !== undefined ? _03_capital_contable.score : 'DEFAULT',
        _03_capital_contable?.parametro !== undefined ? _03_capital_contable.parametro : 'DEFAULT',
        _03_capital_contable?.limite_inferior !== undefined ? _03_capital_contable.limite_inferior : 'DEFAULT',
        _03_capital_contable?.limite_superior !== undefined ? _03_capital_contable.limite_superior : 'DEFAULT',
        _04_plantilla_laboral?.descripcion ?? '',
        _04_plantilla_laboral?.score !== undefined ? _04_plantilla_laboral.score : 'DEFAULT',
        _04_plantilla_laboral?.parametro !== undefined ? _04_plantilla_laboral.parametro : 'DEFAULT',
        _04_plantilla_laboral?.limite_inferior !== undefined ? _04_plantilla_laboral.limite_inferior : 'DEFAULT',
        _04_plantilla_laboral?.limite_superior !== undefined ? _04_plantilla_laboral.limite_superior : 'DEFAULT',
        _05_sector_cliente_final?.descripcion ?? '',
        _05_sector_cliente_final?.score !== undefined ? _05_sector_cliente_final.score : 'DEFAULT',
        _06_tiempo_actividad?.descripcion ?? '',
        _06_tiempo_actividad?.score ?? '',
        _07_influencia_controlante_score !== undefined ? _07_influencia_controlante_score : 'DEFAULT',
        _07_influencia_controlante_regla ?? '',
        _07_influencia_controlante_empresa ?? '',
        _07_influencia_controlante_demandas_penales !== undefined ? _07_influencia_controlante_demandas_penales : 'DEFAULT',
        _07_influencia_controlante_demandas_mercantiles !== undefined ? _07_influencia_controlante_demandas_mercantiles : 'DEFAULT',
        _07_influencia_controlante_sat_69b ? JSON.stringify(_07_influencia_controlante_sat_69b) : null,
        _07_influencia_controlante_ofac ? JSON.stringify(_07_influencia_controlante_ofac) : null,
        _07_influencia_controlante_mercantiles_proveedores ? JSON.stringify(_07_influencia_controlante_mercantiles_proveedores) : null,
        _07_influencia_controlante_contratistas_boletinados ? JSON.stringify(_07_influencia_controlante_contratistas_boletinados) : null,
        _08_ventas_anuales?.descripcion ?? '',
        _08_ventas_anuales?.score !== undefined ? _08_ventas_anuales.score : 'DEFAULT',
        _08_ventas_anuales?.parametro !== undefined ? _08_ventas_anuales.parametro : 'DEFAULT',
        _08_ventas_anuales?.limite_inferior !== undefined ? _08_ventas_anuales.limite_inferior : 'DEFAULT',
        _08_ventas_anuales?.limite_superior !== undefined ? _08_ventas_anuales.limite_superior : 'DEFAULT',
        _09_tipo_cifras?.descripcion ?? '',
        _09_tipo_cifras?.score !== undefined ? _09_tipo_cifras.score : 'DEFAULT',
        _10_incidencias_legales?.score !== undefined ? _10_incidencias_legales.score : 'DEFAULT',
        _10_incidencias_legales?.tipo ?? '',
        _10_incidencias_legales?.caso ?? '',
        _11_evolucion_ventas?.descripcion ?? '',
        _11_evolucion_ventas?.score !== undefined ? _11_evolucion_ventas.score : 'DEFAULT',
        _11_evolucion_ventas?.parametro !== undefined ? _11_evolucion_ventas.parametro : 'DEFAULT',
        _11_evolucion_ventas?.rango ?? '',
        _12_apalancamiento?.descripcion ?? '',
        _12_apalancamiento?.score !== undefined ? _12_apalancamiento.score : 'DEFAULT',
        _12_apalancamiento?.parametro !== undefined ? _12_apalancamiento.parametro : 'DEFAULT',
        _12_apalancamiento?.limite_inferior !== undefined ? _12_apalancamiento.limite_inferior : 'DEFAULT',
        _12_apalancamiento?.limite_superior !== undefined ? _12_apalancamiento.limite_superior : 'DEFAULT',
        _13_flujo_neto?.descripcion ?? '',
        _13_flujo_neto?.score !== undefined && _13_flujo_neto?.score !== '' ? _13_flujo_neto.score : '',
        _13_flujo_neto?.parametro !== undefined && _13_flujo_neto?.parametro !== '' ? _13_flujo_neto.parametro : '',
        _13_flujo_neto?.limite_inferior !== undefined && _13_flujo_neto.limite_inferior !== '' ? _13_flujo_neto.limite_inferior : '',
        _13_flujo_neto?.limite_superior !== undefined && _13_flujo_neto.limite_superior !== '' ? _13_flujo_neto.limite_superior : '',
        _14_payback?.descripcion !== undefined && _14_payback?.descripcion !== null && _14_payback?.descripcion !== '' ? _14_payback.descripcion : '',
        _14_payback?.score !== undefined ? _14_payback.score : 'DEFAULT',
        _14_payback?.parametro !== undefined ? _14_payback.parametro : 'DEFAULT',
        _14_payback?.limite_inferior !== undefined ? _14_payback.limite_inferior : 'DEFAULT',
        _14_payback?.limite_superior !== undefined ? _14_payback.limite_superior : 'DEFAULT',
        _15_rotacion_ctas_x_cobrar?.descripcion ?? '',
        _15_rotacion_ctas_x_cobrar?.score !== undefined ? _15_rotacion_ctas_x_cobrar.score : 'DEFAULT',
        _15_rotacion_ctas_x_cobrar?.parametro_dso !== undefined ? _15_rotacion_ctas_x_cobrar.parametro_dso : 'DEFAULT',
        _15_rotacion_ctas_x_cobrar?.parametro_dio !== undefined ? _15_rotacion_ctas_x_cobrar.parametro_dio : 'DEFAULT',
        _15_rotacion_ctas_x_cobrar?.limite_inferior !== undefined ? _15_rotacion_ctas_x_cobrar.limite_inferior : 'DEFAULT',
        _15_rotacion_ctas_x_cobrar?.limite_superior !== undefined ? _15_rotacion_ctas_x_cobrar.limite_superior : 'DEFAULT',
        _16_referencias_comerciales?.score !== undefined ? _16_referencias_comerciales.score : 'DEFAULT',
        _16_referencias_comerciales?.descripcion ?? '',
        alertas?.descripcion_endeudamiento ?? '',
        alertas?.porcentaje_endeudamiento !== undefined ? alertas.porcentaje_endeudamiento : 'DEFAULT',
        alertas?.texto_reporte_endeudamiento ?? '',
        alertas?.dias_plazo_credito !== undefined ? alertas.dias_plazo_credito : 'DEFAULT',
        alertas?.texto_reporte_plazo_credito ?? '',
        score ?? '',
        wording_underwriting ?? '',
        dpo
      ];
      const values = rawValues.map(v => (v === 'DEFAULT' ? 'DEFAULT' : mysqlLib.escape(v)));
      logger.info(`Valores en la inserción: ${JSON.stringify(values)}`)

      // Construir la consulta SQL manualmente
      const queryString = `
        INSERT INTO reporte_credito (
            id_reporte_credito,
            id_certification,
            folio,
            reporte_pdf,
            monto_solicitado,
            plazo,
            monto_sugerido,
            _01_pais_descripcion,
            _01_pais_score,
            _02_sector_riesgo_descripcion,
            _02_sector_riesgo_score,
            _03_capital_contable_descripcion,
            _03_capital_contable_score,
            _03_capital_contable_parametro,
            _03_capital_contable_limite_inferior,
            _03_capital_contable_limite_superior,
            _04_plantilla_laboral_descripcion,
            _04_plantilla_laboral_score,
            _04_plantilla_laboral_parametro,
            _04_plantilla_laboral_limite_inferior,
            _04_plantilla_laboral_limite_superior,
            _05_sector_cliente_final_descripcion,
            _05_sector_cliente_final_score,
            _06_tiempo_actividad_descripcion,
            _06_tiempo_actividad_score,
            _07_influencia_controlante_score,
            _07_influencia_controlante_regla,
            _07_influencia_controlante_empresa,
            _07_influencia_controlante_demandas_penales,
            _07_influencia_controlante_demandas_mercantiles,
            _07_influencia_controlante_sat_69b,
            _07_influencia_controlante_ofac,
            _07_influencia_controlante_mercantiles_proveedores,
            _07_influencia_controlante_contratistas_boletinados,
            _08_ventas_anuales_descripcion,
            _08_ventas_anuales_score,
            _08_ventas_anuales_parametro,
            _08_ventas_anuales_limite_inferior,
            _08_ventas_anuales_limite_superior,
            _09_tipo_cifras_descripcion,
            _09_tipo_cifras_score,
            _10_incidencia_legal_score,
            _10_incidencia_legal_tipo,
            _10_incidencia_legal_caso,
            _11_evolucion_ventas_descripcion,
            _11_evolucion_ventas_score,
            _11_evolucion_ventas_parametro,
            _11_evolucion_ventas_rango,
            _12_apalancamiento_descripcion,
            _12_apalancamiento_score,
            _12_apalancamiento_parametro,
            _12_apalancamiento_limite_inferior,
            _12_apalancamiento_limite_superior,
            _13_flujo_neto_descripcion,
            _13_flujo_neto_score,
            _13_flujo_neto_parametro,
            _13_flujo_neto_limite_inferior,
            _13_flujo_neto_limite_superior,
            _14_payback_descripcion,
            _14_payback_score,
            _14_payback_parametro,
            _14_payback_limite_inferior,
            _14_payback_limite_superior,
            _15_rotacion_ctas_x_cobrar_descripcion,
            _15_rotacion_ctas_x_cobrar_score,
            _15_rotacion_ctas_x_cobrar_parametro_dso,
            _15_rotacion_ctas_x_cobrar_parametro_dio,
            _15_rotacion_ctas_x_cobrar_limite_inferior,
            _15_rotacion_ctas_x_cobrar_limite_superior,
            _16_referencias_comerciales_score,
            _16_referencias_comerciales_descripcion,
            descripcion_endeudamiento,
            porcentaje_endeudamiento,
            texto_reporte_endeudamiento,
            dias_plazo_credito,
            texto_reporte_plazo_credito,
            score,
            wording_underwriting,
            dpo
        ) VALUES (
            ${values.join(',')}
        );
    `;
      logger.info(`Sentencia de insercion algoritmo: ${JSON.stringify(queryString)}`)
      const result = await mysqlLib.query(queryString)
      return result;
    } catch (error) {
      throw new Error(`Error al insertar datos en la tabla: ${error.message}`);
    }
  }

  async getDireccionByIdDireccion(id_direccion) {
    const queryString = `
    SELECT
     *
    FROM domicilio
    WHERE domicilio_id = ${mysqlLib.escape(id_direccion)}
  `;
    const { result } = await mysqlLib.query(queryString)
    return result
  }


  async getReferenciaComercialByIdReferencia(id_referencia) {
    const queryString = `
    SELECT
     *
    FROM certification_referencia_comercial
    WHERE id_certification_referencia_comercial = ${mysqlLib.escape(id_referencia)}
  `;
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async obtenerUltimoHashCertification(certification_id) {
    const queryString = `
    SELECT
     *
    FROM certification_referencia_comercial_external_invitation
    WHERE certification_id = ${mysqlLib.escape(certification_id)}
    ORDER BY id DESC
    LIMIT 1;
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async insertExternalReference(hash, emp_id, certification_id, email, nombre, id_contacto, id_referencia, id_direccion, id_empresa_cliente_contacto) {

    const queryString = `
      INSERT INTO certification_referencia_comercial_external_invitation (hash, emp_id, certification_id, email, nombre, id_contacto, id_referencia, id_direccion, id_empresa_cliente_contacto, created_at)
      VALUE ('${hash}', ${emp_id}, ${certification_id}, '${email}', '${nombre}', ${id_contacto}, ${id_referencia}, ${id_direccion}, ${id_empresa_cliente_contacto},  NOW());
  `;
    await mysqlLib.query(queryString);
  }

  async actualizaEstatusContacto(id_contacto, message_id, consulta_estatus_envio, fecha) {
    const queryString = `
      UPDATE certification_contacto
      SET estatus = '${consulta_estatus_envio}',
          id_email = '${message_id}',
          fecha_envio_email = '${fecha}',
          fecha_reenvio_email = '${fecha}'
      WHERE id_certification_contacto = ${id_contacto};
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async actualizaEstatusContactoReenvio(id_contacto, message_id, consulta_estatus_envio, fecha) {
    const queryString = `
      UPDATE certification_contacto
      SET estatus = '${consulta_estatus_envio}',
          id_email = '${message_id}',
          fecha_reenvio_email = '${fecha}'
      WHERE id_certification_contacto = ${id_contacto};
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async actualizaEstatusContactoReenvio(id_contacto, message_id, consulta_estatus_envio, fecha) {
    const queryString = `
      UPDATE certification_contacto
      SET estatus = '${consulta_estatus_envio}',
          id_email = '${message_id}',
          fecha_reenvio_email = '${fecha}'
      WHERE id_certification_contacto = ${id_contacto};
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async obtieneReferenciasComercialesNoContestadas() {
    const queryString = `
      SELECT
        crc.id_certification_referencia_comercial,
        crc.id_certification,
        crc.id_direccion
      FROM certification_referencia_comercial AS crc
      LEFT JOIN certification AS c ON c.id_certification = crc.id_certification
      WHERE c.estatus_certificacion = 'inicial' AND crc.contestada = 'no';
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async obtieneContactosReferenciaComercialSent(id_referencia_comercial) {
    const queryString = `
     SELECT
      cc.id_certification_contacto,
      cc.id_certification_referencia_comercial,
      cc.nombre_contacto,
      cc.correo_contacto,
      cc.estatus,
      cc.fecha_envio_email,
      cc.fecha_reenvio_email
    FROM certification_contacto AS cc
    WHERE cc.id_certification_referencia_comercial = ${id_referencia_comercial}
      AND cc.estatus IN ('sent', 'resent');
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async obtieneCertificacionVigente(id_referencia_comercial) {
    const queryString = `
    SELECT
      crc.id_certification,
      crc.id_direccion,
      c.id_empresa
    FROM certification_referencia_comercial AS crc
    LEFT JOIN certification AS c ON c.id_certification = crc.id_certification
    WHERE c.estatus_certificacion = 'inicial' AND crc.id_certification_referencia_comercial = ${id_referencia_comercial};
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async actualizaEstatusContactoMailjet(message_id, consulta_estatus_envio) {
    const queryString = `
      UPDATE certification_contacto
      SET estatus = '${consulta_estatus_envio}'
      WHERE id_email = ${message_id};
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async updateEstatusExternalReference(hash, estatus = 'actualizado') {
    const queryString = `
      UPDATE certification_referencia_comercial_external_invitation
      SET estatus = '${estatus}',
      estatus_referencia = 'vigente'
      WHERE hash = '${hash}';
  `;
    await mysqlLib.query(queryString);
  }

  async consultaEstatusQueued() {
    const queryString = `
      SELECT id_email
      FROM certification_contacto
      WHERE estatus = 'queued';
  `;
    const { result } = await mysqlLib.query(queryString);
    return result
  }

  async getHashExternalReference(hash) {
    const queryString = `
      SELECT *
      FROM certification_referencia_comercial_external_invitation
      WHERE hash = '${hash}';
  `;
    const result = await mysqlLib.query(queryString);
    return result;
  }

  async getDataReporteGlobal(id_emp) {
    const queryString = `
    SELECT
        COUNT(certification.id_certification) AS "clientes_evaluados",
        AVG(reporte_credito.score) AS "calificacion_promedio",
        SUM(reporte_credito.monto_sugerido) AS "saldo_recomendado",
        ROUND(AVG(reporte_credito.plazo)) AS "plazo_recomendado",
        (
            SELECT
                reporte_credito._02_sector_riesgo_descripcion
            FROM reporte_credito
            LEFT JOIN solicitud_credito sc ON sc.id_solicitud_credito = reporte_credito.id_reporte_credito
            LEFT JOIN empresa emp ON emp.emp_id = sc.id_cliente
            LEFT JOIN certification c ON c.id_empresa = emp.emp_id AND c.estatus_certificacion <> 'cancelada'
            WHERE sc.estatus = 'aceptada' 
              AND sc.id_proveedor = ${id_emp}
            GROUP BY reporte_credito._02_sector_riesgo_descripcion
            ORDER BY COUNT(*) DESC
            LIMIT 1
        ) AS "sector_mayoritario"
    FROM solicitud_credito
    LEFT JOIN empresa emp ON emp.emp_id = solicitud_credito.id_cliente
    LEFT JOIN certification ON emp.emp_id = certification.id_empresa AND certification.estatus_certificacion <> 'cancelada'
    LEFT JOIN reporte_credito ON reporte_credito.id_reporte_credito = solicitud_credito.id_solicitud_credito AND reporte_credito.id_reporte_credito IS NOT NULL
    WHERE solicitud_credito.estatus = 'aceptada' 
      AND solicitud_credito.id_proveedor = ${id_emp};
    `;
    const result = await mysqlLib.query(queryString);
    return result;
  }

  // Obtiene referencias comerciales contestadas cuya antigüedad supera los días de vigencia
  async getReferenciasContestadasVencidas(diasVigencia) {
    const queryString = `
      SELECT id_certification_referencia_comercial
      FROM certification_referencia_comercial
      WHERE contestada = 'si'
        AND DATEDIFF(NOW(), updated_at) > ${mysqlLib.escape(diasVigencia)};
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  // Actualiza el estatus de la referencia en la tabla externa a "vencida"
  async actualizarEstatusReferenciaExternaVencida(idReferencia) {
    const queryString = `
      UPDATE certification_referencia_comercial_external_invitation
      SET estatus_referencia = 'vencida'
      WHERE id_referencia = ${mysqlLib.escape(idReferencia)};
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async guardaBloc_sat69b(id_certification, sat69bArray) {
    const sat69b = sat69bArray[0]

    const {
      rfc,
      contribuyente,
      situacion,
      num_fecha_og_presuncion,
      publicacion_presuntos,
      dof_presuntos,
      publicacion_desvirtuados,
      num_fecha_og_desvirtuados,
      dof_desvirtuados,
      num_fecha_og_definitivos = '',
      publicacion_definitivos = null,
      dof_definitivos = '',
      num_fecha_og_sentenciafavorable = '',
      publicacion_sentenciafavorable = null,
      dof_sentenciafavorable = ''
    } = sat69b

    const queryString = `
      INSERT INTO bloc_sat69b 
      (id_certification, rfc, contribuyente, situacion, num_fecha_og_presuncion, 
       publicacion_presuntos, dof_presuntos, publicacion_desvirtuados, 
       num_fecha_og_desvirtuados, dof_desvirtuados, num_fecha_og_definitivos, 
       publicacion_definitivos, dof_definitivos, num_fecha_og_sentenciafavorable, 
       publicacion_sentenciafavorable, dof_sentenciafavorable)
      VALUES
      (${id_certification}, '${rfc}', '${contribuyente}', '${situacion}', 
       '${num_fecha_og_presuncion}', '${publicacion_presuntos}', '${dof_presuntos}', 
       '${publicacion_desvirtuados}', '${num_fecha_og_desvirtuados}', 
       '${dof_desvirtuados}', '${num_fecha_og_definitivos}', 
       ${publicacion_definitivos ? `'${publicacion_definitivos}'` : 'NULL'}, 
       '${dof_definitivos}', '${num_fecha_og_sentenciafavorable}', 
       ${publicacion_sentenciafavorable ? `'${publicacion_sentenciafavorable}'` : 'NULL'}, 
       '${dof_sentenciafavorable}')
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async guardaBloc_ofac(id_certification, ofac) {
    const { nombre } = ofac
    const queryString = `
      INSERT INTO bloc_ofac (id_certificacion, nombre)
      VALUES (${id_certification}, '${nombre}')
    `
    const { result } = await mysqlLib.query(queryString);

    return result;
  }

  async guardaBloc_concursos_mercantiles(id_certification, concurso) {
    const {
      dato,
      comerciante,
      solicitante,
      iniciativa,
      expediente,
      juzgado,
      circuito,
      localidad,
      status_mer,
      especialista
    } = concurso

    // Creamos la consulta SQL
    const queryString = `
      INSERT INTO bloc_concursos_mercantiles 
      (id_certificacion, dato, comerciante, solicitante, iniciativa, expediente, 
       juzgado, circuito, localidad, status_mer, especialista)
      VALUES 
      (${id_certification}, '${dato}', '${comerciante}', '${solicitante}', 
       '${iniciativa}', '${expediente}', '${juzgado}', '${circuito}', 
       '${localidad}', '${status_mer}', '${especialista}')
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async guardaBloc_proveedores_contratistas(id_certification, proveedorContratista) {
    const {
      provedor_contratista,
      multa,
      expediente
    } = proveedorContratista
    const queryString = `
      INSERT INTO bloc_proveedores_contratistas 
      (id_certificacion, provedor_contratista, multa, expediente)
      VALUES 
      (${id_certification}, '${provedor_contratista}', '${multa}', '${expediente}')
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async guardaBloc_69_importadores_exportadores(id_certification, data) {
    const {
      rfc,
      nombre
    } = data

    const queryString = `
      INSERT INTO bloc_importadores_exportadores 
      (id_certificacion, rfc, nombre)
      VALUES
      (${id_certification}, '${rfc}', '${nombre}');
    `

    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async guardaBloc_69_incumplidos(id_certification, data) {
    const {
      rfc,
      razon_social,
      tipo_persona,
      posicion,
      fecha_publicaion,
      monto,
      fecha_monto,
      estado,
      motivo
    } = data

    const queryString = `
      INSERT INTO bloc_lista_69_incumplidos 
      (id_certificacion, rfc, razon_social, tipo_persona, posicion, fecha_publicaion, 
       monto, fecha_monto, estado, motivo)
      VALUES
      (${id_certification}, '${rfc}', '${razon_social}', '${tipo_persona}', '${posicion}', 
       '${fecha_publicaion}', '${monto}', '${fecha_monto}', '${estado}', '${motivo}')
    `

    const { result } = await mysqlLib.query(queryString)
    return result
  }

  // Método para obtener los datos de la tabla `bloc_concursos_mercantiles`
  async getBloc_concursos_mercantiles(id_certification) {
    const queryString = `
    SELECT * FROM bloc_concursos_mercantiles
    WHERE id_certificacion = ${id_certification};
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  // Método para obtener los datos de la tabla `bloc_importadores_exportadores`
  async getBloc_importadores_exportadoress(id_certification) {
    const queryString = `
    SELECT * FROM bloc_importadores_exportadores
    WHERE id_certificacion = ${id_certification};
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  // Método para obtener los datos de la tabla `bloc_lista_69_incumplidos`
  async getBloc_lista_69_incumplidos(id_certification) {
    const queryString = `
    SELECT * FROM bloc_lista_69_incumplidos
    WHERE id_certificacion = ${id_certification};
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  // Método para obtener los datos de la tabla `bloc_ofac`
  async getBloc_ofac(id_certification) {
    const queryString = `
    SELECT * FROM bloc_ofac
    WHERE id_certificacion = ${id_certification};
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  // Método para obtener los datos de la tabla `bloc_proveedores_contratistas`
  async getBloc_proveedores_contratistas(id_certification) {
    const queryString = `
    SELECT * FROM bloc_proveedores_contratistas
    WHERE id_certificacion = ${id_certification};
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  // Método para obtener los datos de la tabla `bloc_sat69b`
  async getBloc_sat69b(id_certification) {
    const queryString = `
    SELECT * FROM bloc_sat69b
    WHERE id_certification = ${id_certification};
  `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getInfluenciaControlanteScore(nombre) {
    const queryString = `
      SELECT descripcion, valor_algoritmo
      FROM cat_influencia_controlante
      WHERE descripcion = ${mysqlLib.escape(nombre)}
      LIMIT 1;
    `
    const { result } = await mysqlLib.query(queryString)
    return result[0]
  }

  async insertResultadoEmpresaControlante(data) {
    const {
      id_certification,
      empresa_controlante,
      demandas_penales,
      demandas_mercantiles,
      sat_69b,
      ofac,
      mercantiles_proveedores,
      contratistas_boletinados
    } = data

    const queryString = `
      INSERT INTO resultado_empresa_controlante
        (id_certification, empresa_controlante, demandas_penales, demandas_mercantiles,
         sat_69b, ofac, mercantiles_proveedores, contratistas_boletinados, created_at, updated_at)
      VALUES (
        ${mysqlLib.escape(id_certification)},
        ${empresa_controlante ? mysqlLib.escape(empresa_controlante) : 'NULL'},
        ${mysqlLib.escape(demandas_penales)},
        ${mysqlLib.escape(demandas_mercantiles)},
        ${sat_69b ? mysqlLib.escape(JSON.stringify(sat_69b)) : 'NULL'},
        ${ofac ? mysqlLib.escape(JSON.stringify(ofac)) : 'NULL'},
        ${mercantiles_proveedores ? mysqlLib.escape(JSON.stringify(mercantiles_proveedores)) : 'NULL'},
        ${contratistas_boletinados ? mysqlLib.escape(JSON.stringify(contratistas_boletinados)) : 'NULL'},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      );
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }


  async getIndustriaNombre(id_emp) {
    const queryString = `
      SELECT 
        e.emp_id,
        e.cin_id,
        it.nombre AS industria_nombre
      FROM 
        empresa e
      JOIN 
        industria_translate it ON e.cin_id = it.industria_id
      WHERE 
        e.emp_id = ${id_emp}        
        AND it.idioma_id = 1;
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async updateReferenciaComercialRepetida(id_certification_referencia_comercial, id_certification, referencia) {
    const queryString = `
      UPDATE certification_referencia_comercial
        SET
          id_certification = ${id_certification},
          razon_social = '${referencia.razon_social}',
          denominacion = ${referencia.denominacion},
          rfc = '${referencia.rfc}',
          id_pais = ${referencia.id_pais}
        WHERE id_certification_referencia_comercial = ${id_certification_referencia_comercial};
      `;
    const result = await mysqlLib.query(queryString)
    return result
  }

    async getReferenciaComercialRepetida(id_certification_referencia_comercial) {
    const queryString = `
      SELECT id_certification_referencia_comercial
      FROM certification_referencia_comercial
      WHERE id_certification_referencia_comercial = ${mysqlLib.escape(id_certification_referencia_comercial)}
      LIMIT 1;
    `

    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getAlertasPreventivasSAT(id_certification) {
    const queryString = `
      SELECT razon_sat_rfc
      FROM certification_accionistas
      WHERE id_certification = ${mysqlLib.escape(id_certification)}
    `

    const { result } = await mysqlLib.query(queryString)
    return result
  }

}


const inst = new CertificationService()
Object.freeze(inst)

module.exports = inst
