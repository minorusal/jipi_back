const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return Tokens.init(sequelize, DataTypes)
}

class Tokens extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      usuario_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      token: {
        type: DataTypes.STRING(200),
        allowNull: false
      },
      tipo: {
        type: DataTypes.ENUM('Android', 'iOS'),
        allowNull: false
      }
    }, {
      sequelize,
      tableName: 'tokens',
      timestamps: false,
      indexes: [
        {
          name: 'token',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'token' }
          ]
        }
      ]
    })
    return Tokens
  }
}
