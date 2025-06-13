const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return EventosFavoritoUsuario.init(sequelize, DataTypes)
}

class EventosFavoritoUsuario extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      evento_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      usuario_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      }
    }, {
      sequelize,
      tableName: 'eventos_favorito_usuario',
      timestamps: false
    })
    return EventosFavoritoUsuario
  }
}
