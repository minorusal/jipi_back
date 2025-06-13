const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return Evento.init(sequelize, DataTypes)
}

class Evento extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      eve_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      emp_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
      eve_cohost: {
        type: DataTypes.STRING(200),
        allowNull: true,
        defaultValue: ''
      },
      usu_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
      eve_titulo: {
        type: DataTypes.STRING(200),
        allowNull: true,
        defaultValue: ''
      },
      eve_descripcion: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      eve_ubicacion: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      eve_fecha: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: '0000-00-00 00:00:00'
      },
      eve_img: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: ''
      },
      eve_status: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
      eve_update: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: '0000-00-00 00:00:00'
      },
      eve_invitados: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
      }
    }, {
      sequelize,
      tableName: 'evento',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'eve_id' }
          ]
        }
      ]
    })
    return Evento
  }
}
