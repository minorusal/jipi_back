const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return PublicacionesLikes.init(sequelize, DataTypes)
}

class PublicacionesLikes extends Sequelize.Model {
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
      tableName: 'publicaciones_likes',
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
    return PublicacionesLikes
  }
}
