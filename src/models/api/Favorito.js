const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return Favorito.init(sequelize, DataTypes)
}

class Favorito extends Sequelize.Model {
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
        defaultValue: 0,
        primaryKey: true
      }
    }, {
      sequelize,
      tableName: 'favorito',
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
    return Favorito
  }
}
