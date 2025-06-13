const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return Idioma.init(sequelize, DataTypes)
}

class Idioma extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      idioma_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      iso: {
        type: DataTypes.STRING(2),
        allowNull: false,
        unique: 'iso'
      }
    }, {
      sequelize,
      tableName: 'idioma',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'idioma_id' }
          ]
        },
        {
          name: 'iso',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'iso' }
          ]
        }
      ]
    })
    return Idioma
  }
}
