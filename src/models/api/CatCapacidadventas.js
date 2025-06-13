const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return CatCapacidadventas.init(sequelize, DataTypes)
}

class CatCapacidadventas extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      cat_capvt_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      cat_capvt_desc: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: '""'
      }
    }, {
      sequelize,
      tableName: 'cat_capacidadventas',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'cat_capvt_id' }
          ]
        }
      ]
    })
    return CatCapacidadventas
  }
}
