const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return CatUsoPropiedad.init(sequelize, DataTypes)
}

class CatUsoPropiedad extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      idcat_porpiedad: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      cat_propiedad_desc: {
        type: DataTypes.STRING(150),
        allowNull: true
      },
      cat_propiedad_status: {
        type: DataTypes.INTEGER,
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'cat_uso_propiedad',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'idcat_porpiedad' }
          ]
        }
      ]
    })
    return CatUsoPropiedad
  }
}
