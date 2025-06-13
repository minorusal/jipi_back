const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return PagoCotizacion.init(sequelize, DataTypes)
}

class PagoCotizacion extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      pago_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      reporte_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      monto: {
        type: DataTypes.FLOAT,
        allowNull: false
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
      tableName: 'pago_cotizacion',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'pago_id' }
          ]
        }
      ]
    })
    return PagoCotizacion
  }
}
