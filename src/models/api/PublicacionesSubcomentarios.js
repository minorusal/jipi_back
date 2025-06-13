const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return PublicacionesSubcomentarios.init(sequelize, DataTypes)
}

class PublicacionesSubcomentarios extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      subcomentario_uuid: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      usuario_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      comentario_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      comentario: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'publicaciones_subcomentarios',
      timestamps: false
    })
    return PublicacionesSubcomentarios
  }
}
