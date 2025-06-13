const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return Publicaciones.init(sequelize, DataTypes)
}

class Publicaciones extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      imagen: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      video: {
        type: DataTypes.STRING(200),
        allowNull: true
      },
      descripcion: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      usuario_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      empresa_id: {
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
      },
      origen: {
        type: DataTypes.ENUM('Personal', 'Corporativo'),
        allowNull: false,
        defaultValue: 'Personal'
      }
    }, {
      sequelize,
      tableName: 'publicaciones',
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
    return Publicaciones
  }
}
