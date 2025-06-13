const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return UsuarioInvitacion.init(sequelize, DataTypes)
}

class UsuarioInvitacion extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      emp_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      nombre: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      apellido: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      correo: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      tipo: {
        type: DataTypes.TINYINT,
        allowNull: false
      }
    }, {
      sequelize,
      tableName: 'usuario_invitacion',
      timestamps: false,
      indexes: [
        {
          name: 'correo',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'correo' }
          ]
        }
      ]
    })
    return UsuarioInvitacion
  }
}
