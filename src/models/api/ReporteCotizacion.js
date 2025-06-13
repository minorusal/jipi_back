const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return ReporteCotizacion.init(sequelize, DataTypes)
}

class ReporteCotizacion extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      rep_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      cot_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: 'cot_id'
      },
      vigente: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
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
      tableName: 'reporte_cotizacion',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'rep_id' }
          ]
        },
        {
          name: 'cot_id',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'cot_id' }
          ]
        }
      ]
    })
    return ReporteCotizacion
  }
}
