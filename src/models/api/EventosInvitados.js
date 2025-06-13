const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return EventosInvitados.init(sequelize, DataTypes)
}

class EventosInvitados extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      evento_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      usuario_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      tipo: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
      }
    }, {
      sequelize,
      tableName: 'eventos_invitados',
      timestamps: false
    })
    return EventosInvitados
  }
}
