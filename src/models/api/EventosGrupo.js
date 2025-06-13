const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return EventosGrupo.init(sequelize, DataTypes)
}

class EventosGrupo extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      grupo_uuid: {
        type: DataTypes.STRING(50),
        allowNull: false
      },
      empresa_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      nombre: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      fecha_creacion: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
      },
      fecha_actualizacion: {
        type: DataTypes.DATE,
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'eventos_grupo',
      timestamps: false
    })
    return EventosGrupo
  }
}
