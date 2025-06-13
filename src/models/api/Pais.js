const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return Pais.init(sequelize, DataTypes)
}

class Pais extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      pais_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      iso: {
        type: DataTypes.STRING(3),
        allowNull: false,
        unique: 'iso'
      }
    }, {
      sequelize,
      tableName: 'pais',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'pais_id' }
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
    return Pais
  }
}
