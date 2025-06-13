const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return ReporteCreditoSolicitud.init(sequelize, DataTypes)
}

class ReporteCreditoSolicitud extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      reporte_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      cot_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      empresa_solicitante: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      empresa_destino: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      estatus: {
        type: DataTypes.ENUM('Pendiente', 'Rechazado', 'Aceptado', 'Investigando', 'Investigado'),
        allowNull: true,
        defaultValue: 'Pendiente'
      },
      pago_id: {
        type: DataTypes.STRING(500),
        allowNull: true
      },
      url: {
        type: DataTypes.STRING(1000),
        allowNull: true
      },
      fecha_creacion: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
      },
      fecha_actualizacion: {
        type: DataTypes.DATE,
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'reporte_credito_solicitud',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'reporte_id' }
          ]
        }
      ]
    })
    return ReporteCreditoSolicitud
  }
}
