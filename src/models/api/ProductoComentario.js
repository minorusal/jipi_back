const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return ProductoComentario.init(sequelize, DataTypes)
}

class ProductoComentario extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      producto_id: {
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
      tableName: 'producto_comentario',
      timestamps: false
    })
    return ProductoComentario
  }
}
