const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return CotizacionPago.init(sequelize, DataTypes)
}

class CotizacionPago extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      foto_uuid: {
        type: DataTypes.STRING(25),
        allowNull: false
      },
      cot_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      imagen: {
        type: DataTypes.STRING(500),
        allowNull: false
      },
      fecha: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
      }
    }, {
      sequelize,
      tableName: 'cotizacion_pago',
      timestamps: false
    })
    return CotizacionPago
  }
}
