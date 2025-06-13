const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return PublicacionesVistas.init(sequelize, DataTypes)
}

class PublicacionesVistas extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      vista_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      usu_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      pub_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      fecha_creacion: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
      }
    }, {
      sequelize,
      tableName: 'publicaciones_vistas',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'vista_id' }
          ]
        }
      ]
    })
    return PublicacionesVistas
  }
}
