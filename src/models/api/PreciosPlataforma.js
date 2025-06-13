const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return PreciosPlataforma.init(sequelize, DataTypes)
}

class PreciosPlataforma extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      concepto: {
        type: DataTypes.STRING(255),
        allowNull: false,
        primaryKey: true
      },
      precio: {
        type: DataTypes.DECIMAL(10, 0),
        allowNull: false
      },
      descuento: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      moneda: {
        type: DataTypes.STRING(10),
        allowNull: false
      }
    }, {
      sequelize,
      tableName: 'precios_plataforma',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'concepto' }
          ]
        }
      ]
    })
    return PreciosPlataforma
  }
}
