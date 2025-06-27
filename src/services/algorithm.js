'use strict'

const mysqlLib = require('../lib/db')
const certificationService = require('./certification')

// Simple in-memory cache for getGeneralSummary results
let cachedGeneralSummary = null
let cachedGeneralSummaryTimestamp = 0
const GENERAL_SUMMARY_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

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
    const now = Date.now()
    if (cachedGeneralSummary && (now - cachedGeneralSummaryTimestamp) < GENERAL_SUMMARY_CACHE_TTL_MS) {
      return cachedGeneralSummary
    }

    const ranges = await certificationService.getAllAlgorithmRanges()

    const mapTable = (table) => {
      const rows = ranges[table]
      if (!Array.isArray(rows)) return []
      return rows.map(r => {
        const entry = {
          nombre: r.nombre ?? r.descripcion,
          v1: r.valor_algoritmo
        }
        if (Object.prototype.hasOwnProperty.call(r, 'descripcion')) {
          entry.descripcion = r.descripcion
        }
        const idField = Object.keys(r).find(k => k.startsWith('id_'))
        if (idField) {
          entry.id = r[idField]
        }
        if (Object.prototype.hasOwnProperty.call(r, 'valor_algoritmo_v2')) {
          entry.v2 = r.valor_algoritmo_v2
        } else {
          entry.v2 = r.valor_algoritmo
        }
        if (Object.prototype.hasOwnProperty.call(r, 'limite_inferior')) {
          entry.limite_inferior = r.limite_inferior
        }
        if (Object.prototype.hasOwnProperty.call(r, 'limite_superior')) {
          entry.limite_superior = r.limite_superior
        }
        if (Object.prototype.hasOwnProperty.call(r, 'rango_numerico')) {
          entry.rango = r.rango_numerico
        }
        return entry
      })
    }

    const summary = {
      paisScore: mapTable('cat_pais_algoritmo'),
      sectorRiesgoScore: mapTable('cat_sector_riesgo_sectorial_algoritmo'),
      capitalContableScore: mapTable('cat_capital_contable_algoritmo'),
      plantillaLaboralScore: mapTable('cat_plantilla_laboral_algoritmo'),
      sectorClienteFinalScore: mapTable('cat_sector_clientes_finales_algoritmo'),
      tiempoActividadScore: mapTable('cat_tiempo_actividad_comercial_algoritmo'),
      influenciaControlanteScore: mapTable('cat_influencia_controlante_algoritmo'),
      ventasAnualesScore: mapTable('cat_ventas_anuales_algoritmo'),
      tipoCifrasScore: mapTable('cat_tipo_cifras_algoritmo'),
      incidenciasLegalesScore: mapTable('cat_incidencias_legales_algoritmo'),
      evolucionVentasScore: mapTable('cat_evolucion_ventas_algoritmo'),
      apalancamientoScore: mapTable('cat_apalancamiento_algoritmo'),
      flujoNetoScore: mapTable('cat_flujo_neto_caja_algoritmo'),
      paybackScore: mapTable('cat_payback_algoritmo'),
      rotacionCtasXCobrarScore: mapTable('cat_rotacion_cuentas_cobrar_algoritmo'),
      referenciasProveedoresScore: mapTable('cat_resultado_referencias_proveedores_algoritmo'),
      scoreDescripcion: mapTable('cat_score_descripcion_algoritmo')
    }

    cachedGeneralSummary = summary
    cachedGeneralSummaryTimestamp = now
    return summary
  }

  /**
   * Update the score and range configuration for the algorithm tables.
   * The body must contain an object whose keys are the table names and the
   * values are arrays of rows with the fields to update.
   *
   * Example body:
   * {
   *   cat_pais_algoritmo: [ { id_pais_algoritmo: 1, valor_algoritmo: 10 } ],
   *   cat_plantilla_laboral_algoritmo: [
   *     { id_cat_plantilla_laboral: 2, limite_inferior: 0, limite_superior: 10 }
   *   ]
   * }
   */
  async updateAlgorithmRanges (changes) {
    if (!changes || typeof changes !== 'object') return

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
      'cat_resultado_referencias_proveedores_algoritmo',
      'cat_payback_algoritmo',
      'cat_rotacion_cuentas_cobrar_algoritmo',
      'cat_tipo_cifras_algoritmo',
      'cat_evolucion_ventas_algoritmo',
      'cat_influencia_controlante_algoritmo',
      'cat_score_descripcion_algoritmo'
    ]

    for (const table of tables) {
      const rows = changes[table]
      if (!Array.isArray(rows)) continue

      for (const row of rows) {
        const idField = Object.keys(row).find(key => key.startsWith('id_'))
        if (!idField) continue

        const setFields = []
        for (const field of [
          'nombre',
          'valor_algoritmo',
          'valor_algoritmo_v2',
          'limite_inferior',
          'limite_superior',
          'rango_numerico'
        ]) {
          if (Object.prototype.hasOwnProperty.call(row, field)) {
            setFields.push(`${field} = ${mysqlLib.escape(row[field])}`)
          }
        }

        if (setFields.length === 0) continue

        const query = `UPDATE ${table} SET ${setFields.join(', ')} WHERE ${idField} = ${mysqlLib.escape(row[idField])};`
        await mysqlLib.query(query)
      }
    }
  }
}

module.exports = new AlgorithmService()
