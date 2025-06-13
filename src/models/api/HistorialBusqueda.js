const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return HistorialBusqueda.init(sequelize, DataTypes)
}

class HistorialBusqueda extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      busqueda_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      usu_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      termino: {
        type: DataTypes.STRING(200),
        allowNull: false
      },
      fecha_creacion: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
      }
    }, {
      sequelize,
      tableName: 'historial_busqueda',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'busqueda_id' }
          ]
        }
      ]
    })
    return HistorialBusqueda
  }
}
