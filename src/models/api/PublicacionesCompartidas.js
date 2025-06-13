const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return PublicacionesCompartidas.init(sequelize, DataTypes)
}

class PublicacionesCompartidas extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
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
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'publicaciones_compartidas',
      timestamps: false
    })
    return PublicacionesCompartidas
  }
}
