const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return Seguidores.init(sequelize, DataTypes)
}

class Seguidores extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      usuario_origen: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      usuario_destino: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      estatus: {
        type: DataTypes.ENUM('Follow', 'Unfollow'),
        allowNull: false,
        defaultValue: 'Follow'
      },
      fecha_creacion: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
      },
      fecha_actualizacion: {
        type: DataTypes.DATE,
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'seguidores',
      timestamps: false
    })
    return Seguidores
  }
}
