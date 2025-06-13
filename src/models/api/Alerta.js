const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return Alerta.init(sequelize, DataTypes)
}

class Alerta extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      alerta_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      usu_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      usu_id_origen: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      alerta_desc_esp: {
        type: DataTypes.STRING(500),
        allowNull: true
      },
      alerta_desc_ing: {
        type: DataTypes.STRING(500),
        allowNull: true
      },
      alerta_status: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      alerta_update: {
        type: DataTypes.DATE,
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'alerta',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'alerta_id' }
          ]
        }
      ]
    })
    return Alerta
  }
}
