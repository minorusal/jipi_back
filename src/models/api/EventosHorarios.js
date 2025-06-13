const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return EventosHorarios.init(sequelize, DataTypes)
}

class EventosHorarios extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      horario_uuid: {
        type: DataTypes.STRING(25),
        allowNull: false
      },
      evento_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      fecha: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
      },
      apertura: {
        type: DataTypes.STRING(5),
        allowNull: true
      },
      cierre: {
        type: DataTypes.STRING(5),
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'eventos_horarios',
      timestamps: false
    })
    return EventosHorarios
  }
}
