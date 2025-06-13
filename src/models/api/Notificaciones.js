const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return Notificaciones.init(sequelize, DataTypes)
}

class Notificaciones extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      notificacion_uuid: {
        type: DataTypes.STRING(50),
        allowNull: false
      },
      origen_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      destino_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      tipo: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      visto: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      data: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      fecha_creacion: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
      }
    }, {
      sequelize,
      tableName: 'notificaciones',
      timestamps: false
    })
    return Notificaciones
  }
}
