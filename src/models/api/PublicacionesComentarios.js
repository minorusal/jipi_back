const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return PublicacionesComentarios.init(sequelize, DataTypes)
}

class PublicacionesComentarios extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      publicacion_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      usuario_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      comentario: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      imagen: {
        type: DataTypes.STRING(500),
        allowNull: true
      },
      video: {
        type: DataTypes.STRING(200),
        allowNull: true
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
      }
    }, {
      sequelize,
      tableName: 'publicaciones_comentarios',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'id' }
          ]
        }
      ]
    })
    return PublicacionesComentarios
  }
}
