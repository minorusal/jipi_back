const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return EventosFotos.init(sequelize, DataTypes)
}

class EventosFotos extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      foto_uuid: {
        type: DataTypes.STRING(25),
        allowNull: false,
        primaryKey: true
      },
      evento_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      usuario_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      url: {
        type: DataTypes.STRING(255),
        allowNull: false
      }
    }, {
      sequelize,
      tableName: 'eventos_fotos',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'foto_uuid' }
          ]
        }
      ]
    })
    return EventosFotos
  }
}
