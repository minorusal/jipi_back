'use strict'

const mysqlLib = require('../lib/db')

class SeguimientoClientesService {
    constructor() {
        if (SeguimientoClientesService.instance == null) {
            this.table = 'seguimiento_clientes'
            SeguimientoClientesService.instance = this
        }
        return SeguimientoClientesService.instance
    }

    async createSeguimiento(seguimientoData) {
        const { id_empresa, razon_social, denominacion, rfc } = seguimientoData

        const queryString = `
      INSERT INTO ${this.table} 
      (id_empresa, razon_social, denominacion, rfc, estatus, fecha_creacion, fecha_actualizacion) 
      VALUES (?, ?, ?, ?, 'en_seguimiento', NOW(), NOW())
    `

        const { result } = await mysqlLib.query(queryString, [id_empresa, razon_social, denominacion, rfc])
        return result
    }

    async getAllSeguimientos(id_empresa) {
        const queryString = `
      SELECT 
        sc.id,
        sc.id_empresa,
        CONCAT(sc.razon_social, ' ', IF(sc.denominacion = 0 OR sc.denominacion IS NULL, '', cd.denominacion)) AS razon_social,
        sc.denominacion,
        sc.rfc,
        sc.estatus,
        sc.fecha_creacion,
        sc.fecha_actualizacion,
        cd.denominacion as denominacion_texto
      FROM ${this.table} sc
      LEFT JOIN cat_denominacion cd ON cd.id = sc.denominacion
      WHERE sc.id_empresa = ?
      ORDER BY sc.fecha_creacion DESC
    `

        const { result } = await mysqlLib.query(queryString, [id_empresa])
        return result
    }

    async updateEstatus(id, estatus) {
        const queryString = `
      UPDATE ${this.table} 
      SET estatus = ?, fecha_actualizacion = NOW() 
      WHERE id = ?
    `

        const { result } = await mysqlLib.query(queryString, [estatus, id])
        return result
    }

    async obtenerRfcsExistentes(id_empresa, rfcs) {
        const placeholders = rfcs.map(() => '?').join(',');
        const query = `SELECT rfc FROM ${this.table} WHERE id_empresa = ? AND rfc IN (${placeholders})`;
        const { result } = await mysqlLib.query(query, [id_empresa, ...rfcs]);
        return result;
    }

    async insertarSeguimientosMasivos(id_empresa, seguimientos) {
        if (!seguimientos.length) return { insertados: 0 };
        const values = seguimientos.map(s => [id_empresa, s.empresa, s.denominacion, s.rfc, 'en_seguimiento']);
        const query = `INSERT INTO ${this.table} (id_empresa, razon_social, denominacion, rfc, estatus, fecha_creacion, fecha_actualizacion) VALUES ?`;
        await mysqlLib.query(query, [values.map(v => [...v, new Date(), new Date()])]);
        return { insertados: seguimientos.length };
    }

    async actualizarEstatusMasivo(id_empresa, estatus_origen, estatus_destino) {
        const query = `UPDATE ${this.table} SET estatus = ?, fecha_actualizacion = NOW() WHERE id_empresa = ? AND estatus = ?`;
        const { result } = await mysqlLib.query(query, [estatus_destino, id_empresa, estatus_origen]);
        return result;
    }
}

module.exports = new SeguimientoClientesService()
