const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return Industria.init(sequelize, DataTypes)
}

class Industria extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      industria_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      clave: {
        type: DataTypes.STRING(20),
        allowNull: false
      }
    }, {
      sequelize,
      tableName: 'industria',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'industria_id' }
          ]
        }
      ]
    })
    return Industria
  }
}
