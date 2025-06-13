const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return UsuarioRefreshToken.init(sequelize, DataTypes)
}

class UsuarioRefreshToken extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      urt_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      usu_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      urt_login_uuid: {
        type: DataTypes.STRING(36),
        allowNull: false
      },
      urt_sessionToken_uuid: {
        type: DataTypes.STRING(36),
        allowNull: false,
        unique: 'urt_sessionToken_uuid'
      },
      urt_refreshToken_uuid: {
        type: DataTypes.STRING(36),
        allowNull: false,
        unique: 'urt_refreshToken_uuid'
      },
      urt_refreshToken: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      urt_sessionToken: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      urt_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: 1
      }
    }, {
      sequelize,
      tableName: 'usuario_refresh_token',
      timestamps: true,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'urt_id' }
          ]
        },
        {
          name: 'urt_id',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'urt_id' }
          ]
        },
        {
          name: 'urt_sessionToken_uuid',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'urt_sessionToken_uuid' }
          ]
        },
        {
          name: 'urt_refreshToken_uuid',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'urt_refreshToken_uuid' }
          ]
        }
      ]
    })
    return UsuarioRefreshToken
  }
}
