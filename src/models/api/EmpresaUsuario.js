const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return EmpresaUsuario.init(sequelize, DataTypes)
}

class EmpresaUsuario extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      emp_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        references: {
          model: 'empresa',
          key: 'emp_id'
        }
      },
      usu_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        references: {
          model: 'usuario',
          key: 'usu_id'
        }
      },
      tipo: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 2
      },
      reg_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      }
    }, {
      sequelize,
      tableName: 'empresa_usuario',
      timestamps: false,
      indexes: [
        {
          name: 'fk_empresa_usuario_empresa_idx',
          using: 'BTREE',
          fields: [
            { name: 'emp_id' }
          ]
        },
        {
          name: 'fk_empresa_usuario_usuario_idx',
          using: 'BTREE',
          fields: [
            { name: 'usu_id' }
          ]
        }
      ]
    })
    return EmpresaUsuario
  }
}
