const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return Turnos.init(sequelize, DataTypes)
}

class Turnos extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      empresa_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      turno: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
      }
    }, {
      sequelize,
      tableName: 'turnos',
      timestamps: false,
      indexes: [
        {
          name: 'empresa_id',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'empresa_id' }
          ]
        }
      ]
    })
    return Turnos
  }
}
