const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return UsuarioSistema.init(sequelize, DataTypes)
}

class UsuarioSistema extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      id_usuario_sistema: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      id_perfiles: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      username: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      nip: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      register_date: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      name: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      cliente_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      usu_status: {
        type: DataTypes.INTEGER,
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'usuario_sistema',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'id_usuario_sistema' }
          ]
        }
      ]
    })
    return UsuarioSistema
  }
}
