const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return Pagos.init(sequelize, DataTypes)
}

class Pagos extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      pago_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      usu_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      cargo: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
      },
      moneda: {
        type: DataTypes.STRING(3),
        allowNull: false
      },
      concepto: {
        type: DataTypes.ENUM('Certification', 'CreditReport'),
        allowNull: false
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
      }
    }, {
      sequelize,
      tableName: 'pagos',
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
    return Pagos
  }
}
