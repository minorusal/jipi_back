const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return CatNombreComercial.init(sequelize, DataTypes)
}

class CatNombreComercial extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      nombre_comercial_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      nombre: {
        type: DataTypes.STRING(150),
        allowNull: false
      },
      pais: {
        type: DataTypes.ENUM('MEX', 'USA'),
        allowNull: false
      }
    }, {
      sequelize,
      tableName: 'cat_nombre_comercial',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'nombre_comercial_id' }
          ]
        }
      ]
    })
    return CatNombreComercial
  }
}
