const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return ComentarioCotizacion.init(sequelize, DataTypes)
}

class ComentarioCotizacion extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      comentario_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      cot_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      autor: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      texto: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      visto: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0
      },
      cot_origen: {
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
      tableName: 'comentario_cotizacion',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'comentario_id' }
          ]
        }
      ]
    })
    return ComentarioCotizacion
  }
}
