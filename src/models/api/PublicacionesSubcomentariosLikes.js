const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return PublicacionesSubcomentariosLikes.init(sequelize, DataTypes)
}

class PublicacionesSubcomentariosLikes extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      subcomentario_uuid: {
        type: DataTypes.STRING(100),
        allowNull: false,
        primaryKey: true
      },
      usuario_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      valor: {
        type: DataTypes.ENUM('LIKE', 'EMPTY'),
        allowNull: true
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
      tableName: 'publicaciones_subcomentarios_likes',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'subcomentario_uuid' },
            { name: 'usuario_id' }
          ]
        }
      ]
    })
    return PublicacionesSubcomentariosLikes
  }
}
