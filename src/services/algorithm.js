'use strict'

const mysqlLib = require('../lib/db')

class AlgorithmService {
  async getLastCertificationId (clientId) {
    const query = `
      SELECT id_certification
      FROM certification
      WHERE id_empresa = ${mysqlLib.escape(clientId)}
      ORDER BY id_certification DESC
      LIMIT 1;
    `
    const { result } = await mysqlLib.query(query)
    return result[0] ? result[0].id_certification : null
  }

  async getInitialData (id_certification) {
    const query = `
      SELECT
        pa.nombre AS pais,
        pa.valor_algoritmo AS pais_score,
        srs.nombre AS sector_riesgo,
        srs.valor_algoritmo AS sector_riesgo_score,
        scf.nombre AS sector_cliente_final,
        scf.valor_algoritmo AS sector_cliente_final_score,
        tac.nombre AS tiempo_actividad,
        tac.valor_algoritmo AS tiempo_actividad_score,
        pla.nombre AS plantilla_nombre,
        pla.valor_algoritmo AS plantilla_score
      FROM certification AS c
      LEFT JOIN cat_pais_algoritmo AS pa ON pa.id_pais_algoritmo = c.id_pais
      LEFT JOIN cat_sector_riesgo_sectorial_algoritmo AS srs ON srs.id_cat_sector_riesgo_sectorial = c.id_cat_sector_riesgo_sectorial
      LEFT JOIN cat_sector_clientes_finales_algoritmo AS scf ON scf.id_cat_sector_clientes_finales = c.id_cat_sector_clientes_finales
      LEFT JOIN cat_tiempo_actividad_comercial_algoritmo AS tac ON tac.id_cat_tiempo_actividad_comercial = c.id_cat_tiempo_actividad_comercial
      LEFT JOIN cat_plantilla_laboral_algoritmo AS pla ON c.plantilla_laboral BETWEEN pla.limite_inferior AND COALESCE(pla.limite_superior, c.plantilla_laboral)
      WHERE c.id_certification = ${mysqlLib.escape(id_certification)}
      LIMIT 1;
    `
    const { result } = await mysqlLib.query(query)
    return result[0]
  }
}

module.exports = new AlgorithmService()
