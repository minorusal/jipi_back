const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return PublicacionesComentariosLikes.init(sequelize, DataTypes)
}

class PublicacionesComentariosLikes extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      comentario_id: {
        type: DataTypes.INTEGER,
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
      tableName: 'publicaciones_comentarios_likes',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'comentario_id' },
            { name: 'usuario_id' }
          ]
        }
      ]
    })
    return PublicacionesComentariosLikes
  }
}
