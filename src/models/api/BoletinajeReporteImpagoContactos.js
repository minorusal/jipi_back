const { DataTypes } = require('sequelize')

/**
 * Modelo para la tabla `boletinaje_reporte_impago_contactos`.
 * Almacena los contactos de la empresa deudora.
 *
 * @param {object} sequelize - Instancia de Sequelize.
 * @returns {object} - El modelo Sequelize definido.
 */
module.exports = (sequelize) => {
  const BoletinajeReporteImpagoContactos = sequelize.define('BoletinajeReporteImpagoContactos', {
    id_boletinaje_reporte_impago_contacto: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      field: 'id_boletinaje_reporte_impago_contacto'
    },
    id_boletinaje_reporte_impago: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'id_boletinaje_reporte_impago'
    },
    nombre_contacto: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'nombre_contacto'
    },
    cargo: {
      type: DataTypes.STRING(100),
      field: 'cargo'
    },
    telefono: {
      type: DataTypes.STRING(20),
      field: 'telefono'
    },
    correo_electronico: {
      type: DataTypes.STRING(255),
      field: 'correo_electronico'
    }
  }, {
    tableName: 'boletinaje_reporte_impago_contactos',
    timestamps: false
  })

  return BoletinajeReporteImpagoContactos
} 