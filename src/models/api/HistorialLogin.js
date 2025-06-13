const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return HistorialLogin.init(sequelize, DataTypes)
}

class HistorialLogin extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      id_usuario: {
        type: DataTypes.INTEGER,
        allowNull: false
      }
    }, {
      sequelize,
      tableName: 'historial_login',
      timestamps: true,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'id' }
          ]
        },
        {
          name: 'id',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'id' }
          ]
        }
      ]
    })
    return HistorialLogin
  }
}
