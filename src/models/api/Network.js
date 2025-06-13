const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return Network.init(sequelize, DataTypes)
}

class Network extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      usu_id_origen: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      usu_id_amigo: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      net_tipo: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      net_fecha: {
        type: DataTypes.DATEONLY,
        allowNull: true
      },
      net_status: {
        type: DataTypes.INTEGER,
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'network',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'usu_id_origen' },
            { name: 'usu_id_amigo' }
          ]
        }
      ]
    })
    return Network
  }
}
