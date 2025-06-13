const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return IndustriaTranslate.init(sequelize, DataTypes)
}

class IndustriaTranslate extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      industria_translate_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      industria_id: {
        type: DataTypes.INTEGER,
        allowNull: false
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
      tableName: 'industria_translate',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'industria_translate_id' }
          ]
        },
        {
          name: 'fk_industria_translate_idioma_idx',
          using: 'BTREE',
          fields: [
            { name: 'idioma_id' }
          ]
        }
      ]
    })
    return IndustriaTranslate
  }
}
