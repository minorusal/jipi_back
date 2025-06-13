const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return ProductoFoto.init(sequelize, DataTypes)
}

class ProductoFoto extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      producto_foto_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      prod_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
      foto_num: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
      foto_url: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: ''
      },
      foto_tipo: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
      }
    }, {
      sequelize,
      tableName: 'producto_foto',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'producto_foto_id' }
          ]
        }
      ]
    })
    return ProductoFoto
  }
}
