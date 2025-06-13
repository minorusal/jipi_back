const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return DomicilioTipo.init(sequelize, DataTypes)
}

class DomicilioTipo extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      domicilio_tipo_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      tipo: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: 'tipo'
      }
    }, {
      sequelize,
      tableName: 'domicilio_tipo',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'domicilio_tipo_id' }
          ]
        },
        {
          name: 'tipo',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'tipo' }
          ]
        }
      ]
    })
    return DomicilioTipo
  }
}
