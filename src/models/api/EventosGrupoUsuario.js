const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return EventosGrupoUsuario.init(sequelize, DataTypes)
}

class EventosGrupoUsuario extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      grupo_uuid: {
        type: DataTypes.STRING(50),
        allowNull: false
      },
      usuario_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      }
    }, {
      sequelize,
      tableName: 'eventos_grupo_usuario',
      timestamps: false
    })
    return EventosGrupoUsuario
  }
}
