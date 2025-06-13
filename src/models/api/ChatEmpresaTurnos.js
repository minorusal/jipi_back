const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return ChatEmpresaTurnos.init(sequelize, DataTypes)
}

class ChatEmpresaTurnos extends Sequelize.Model {
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
      tableName: 'chat_empresa_turnos',
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
    return ChatEmpresaTurnos
  }
}
