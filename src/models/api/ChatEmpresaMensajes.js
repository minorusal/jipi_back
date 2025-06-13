const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return ChatEmpresaMensajes.init(sequelize, DataTypes)
}

class ChatEmpresaMensajes extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      sala_uuid: {
        type: DataTypes.STRING(50),
        allowNull: false
      },
      mensaje_uuid: {
        type: DataTypes.STRING(50),
        allowNull: false
      },
      usuario: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      mensaje: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      visto: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      producto_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      fecha_creacion: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
      }
    }, {
      sequelize,
      tableName: 'chat_empresa_mensajes',
      timestamps: false
    })
    return ChatEmpresaMensajes
  }
}
