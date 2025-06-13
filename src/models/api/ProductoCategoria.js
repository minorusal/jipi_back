const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return ProductoCategoria.init(sequelize, DataTypes)
}

class ProductoCategoria extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      categoria_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      nombre: {
        type: DataTypes.STRING(500),
        allowNull: false
      }
    }, {
      sequelize,
      tableName: 'producto_categoria',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'categoria_id' }
          ]
        }
      ]
    })
    return ProductoCategoria
  }
}
