const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return UsuarioTokensPago.init(sequelize, DataTypes)
}

class UsuarioTokensPago extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      usuario: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      token: {
        type: DataTypes.STRING(250),
        allowNull: false,
        primaryKey: true
      },
      fecha_creacion: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
      }
    }, {
      sequelize,
      tableName: 'usuario_tokens_pago',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'usuario' },
            { name: 'token' }
          ]
        },
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
    return UsuarioTokensPago
  }
}
