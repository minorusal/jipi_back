const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return CatTipoInmueble.init(sequelize, DataTypes)
}

class CatTipoInmueble extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      idtipo_inmueble: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      idtipo_desc: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      idtipo_status: {
        type: DataTypes.INTEGER,
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'cat_tipo_inmueble',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'idtipo_inmueble' }
          ]
        }
      ]
    })
    return CatTipoInmueble
  }
}
