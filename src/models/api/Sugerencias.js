const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return Sugerencias.init(sequelize, DataTypes)
}

class Sugerencias extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      sugerencia_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      usu_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      sugerencia: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      imagen: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      fecha_creacion: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
      }
    }, {
      sequelize,
      tableName: 'sugerencias',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'sugerencia_id' }
          ]
        }
      ]
    })
    return Sugerencias
  }
}
