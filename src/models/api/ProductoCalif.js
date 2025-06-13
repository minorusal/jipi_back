const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return ProductoCalif.init(sequelize, DataTypes)
}

class ProductoCalif extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      prod_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        primaryKey: true
      },
      usu_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      cal_numero: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cal_fecha: {
        type: DataTypes.DATE,
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'producto_calif',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'prod_id' },
            { name: 'usu_id' }
          ]
        }
      ]
    })
    return ProductoCalif
  }
}
