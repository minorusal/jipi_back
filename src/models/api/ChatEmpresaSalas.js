const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return ChatEmpresaSalas.init(sequelize, DataTypes)
}

class ChatEmpresaSalas extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      sala_uuid: {
        type: DataTypes.STRING(50),
        allowNull: false
      },
      usuario_comprador: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      usuario_vendedor: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      empresa_compradora: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      empresa_vendedora: {
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
      tableName: 'chat_empresa_salas',
      timestamps: false
    })
    return ChatEmpresaSalas
  }
}
