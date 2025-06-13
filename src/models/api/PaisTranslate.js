const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return PaisTranslate.init(sequelize, DataTypes)
}

class PaisTranslate extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      pais_translate_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      pais_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'pais',
          key: 'pais_id'
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
        type: DataTypes.STRING(50),
        allowNull: false
      }
    }, {
      sequelize,
      tableName: 'pais_translate',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'pais_translate_id' }
          ]
        },
        {
          name: 'fk_pais_idx',
          using: 'BTREE',
          fields: [
            { name: 'pais_id' }
          ]
        },
        {
          name: 'fk_idioma_idx',
          using: 'BTREE',
          fields: [
            { name: 'idioma_id' }
          ]
        }
      ]
    })
    return PaisTranslate
  }
}
