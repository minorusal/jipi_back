const { DataTypes } = require('sequelize')

/**
 * Modelo para la tabla `boletinaje_grupo`.
 * Esta tabla agrupa un conjunto de respuestas de un cuestionario
 * y sirve como nexo para el futuro reporte de impago.
 *
 * @param {object} sequelize - Instancia de Sequelize.
 * @returns {object} - El modelo Sequelize definido.
 */
module.exports = (sequelize) => {
  const BoletinajeGrupo = sequelize.define('BoletinajeGrupo', {
    id_boletinaje_grupo: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      comment: 'ID único para el grupo de boletinaje.',
      field: 'id_boletinaje_grupo'
    },
    id_empresa_cliente: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'ID de la empresa sobre la cual se está reportando (el deudor/cliente).',
      field: 'id_empresa_cliente'
    },
    id_empresa_proveedor: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'ID de la empresa que está emitiendo el reporte (el proveedor).',
      field: 'id_empresa_proveedor'
    },
    fecha_creacion: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      comment: 'Fecha de creación del registro.',
      field: 'fecha_creacion'
    }
  }, {
    tableName: 'boletinaje_grupo',
    timestamps: false
  })

  BoletinajeGrupo.associate = function (models) {
    this.belongsTo(models.Empresa, {
      foreignKey: 'id_empresa_proveedor',
      as: 'empresa_proveedor'
    })
    this.belongsTo(models.Empresa, {
      foreignKey: 'id_empresa_cliente',
      as: 'empresa_cliente'
    })
  }

  return BoletinajeGrupo
} 