const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return EstadoTranslate.init(sequelize, DataTypes)
}

class EstadoTranslate extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      estado_translate_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      estado_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'estado',
          key: 'estado_id'
        }
      },
      idioma_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'idioma',
          key: 'idioma_id'
        }
      },
      nombre: {
        type: DataTypes.STRING(100),
        allowNull: false
      }
    }, {
      sequelize,
      tableName: 'estado_translate',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'estado_translate_id' }
          ]
        },
        {
          name: 'fk_estado_translate_estado_idx',
          using: 'BTREE',
          fields: [
            { name: 'estado_id' }
          ]
        },
        {
          name: 'fk_estado_translate_idioma_idx',
          using: 'BTREE',
          fields: [
            { name: 'idioma_id' }
          ]
        }
      ]
    })
    return EstadoTranslate
  }
}
