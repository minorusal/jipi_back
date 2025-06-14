'use strict'

const mysqlLib = require('../lib/db')
const certificationService = require('./certification')

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

  async getCountryByCertificationId (id_certification) {
    const query = `
      SELECT
        pa.nombre,
        pa.valor_algoritmo
      FROM certification AS c
      LEFT JOIN cat_pais_algoritmo AS pa ON pa.id_pais_algoritmo = c.id_pais
      WHERE c.id_certification = ${mysqlLib.escape(id_certification)};
    `
    const { result } = await mysqlLib.query(query)
    return result[0]
  }

  async getCapitalContableScore (id_certification) {
    const capital = await certificationService.capitalContableEBPA(id_certification)
    if (!capital || capital.capital_contable == null) return null
    const scoreRow = await certificationService.getScoreCapitalContableEBPA(parseFloat(capital.capital_contable))
    return scoreRow ? scoreRow.valor_algoritmo : null
  }

  /**
   * Return the generic score configuration for the 16 algorithm variables.
   * These values are not tied to any particular certification.
   */
  async getGeneralSummary () {
    const paises = await certificationService.getPaisesAlgoritmo()
    const paisScore = Array.isArray(paises.result)
      ? paises.result.map(p => ({ nombre: p.nombre, score: p.valor_algoritmo }))
      : []

    return {
      paisScore,
      sectorRiesgoScore: { v1: 'valor_algoritmo_sector_riesgo', v2: 'valor_algoritmo_sector_riesgo' },
      capitalContableScore: { v1: 'score_capital_contable', v2: '0' },
      plantillaLaboralScore: { v1: 'score_plantilla_laboral', v2: 'score_plantilla_laboral' },
      sectorClienteFinalScore: { v1: 'valor_algoritmo_sector_cliente_final', v2: 'valor_algoritmo_sector_cliente_final' },
      tiempoActividadScore: { v1: 'valor_algoritmo_tiempo_actividad', v2: 'valor_algoritmo_tiempo_actividad' },
      influenciaControlanteScore: { v1: '0', v2: '0' },
      ventasAnualesScore: { v1: 'score_ventas_anuales', v2: '0' },
      tipoCifrasScore: { v1: 'score_tipo_cifras', v2: '0' },
      incidenciasLegalesScore: { v1: 'score_incidencias_legales', v2: 'score_incidencias_legales' },
      evolucionVentasScore: { v1: 'score_evolucion_ventas', v2: '0' },
      apalancamientoScore: { v1: 'score_apalancamiento', v2: '0' },
      flujoNetoScore: { v1: 'score_flujo_neto', v2: '0' },
      paybackScore: { v1: 'score_payback', v2: '0' },
      rotacionCtasXCobrarScore: { v1: 'score_rotacion_ctas_x_cobrar', v2: '0' },
      referenciasProveedoresScore: { v1: 'score_referencias_proveedores', v2: 'score_referencias_proveedores' }
    }
  }
}

module.exports = new AlgorithmService()
