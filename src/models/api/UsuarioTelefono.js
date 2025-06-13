const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return UsuarioTelefono.init(sequelize, DataTypes)
}

class UsuarioTelefono extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      usu_phone_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      usu_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: 'usu_id'
      },
      usu_phone: {
        type: DataTypes.STRING(25),
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'usuario_telefono',
      timestamps: true,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'usu_phone_id' }
          ]
        },
        {
          name: 'usu_phone_id',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'usu_phone_id' }
          ]
        },
        {
          name: 'usu_id',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'usu_id' }
          ]
        }
      ]
    })
    return UsuarioTelefono
  }
}
