const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return CatEnvio.init(sequelize, DataTypes)
}

class CatEnvio extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      cenvio_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      cenvio_desc_esp: {
        type: DataTypes.STRING(150),
        allowNull: true,
        defaultValue: '""'
      },
      cenvio_desc_ing: {
        type: DataTypes.STRING(150),
        allowNull: true,
        defaultValue: '""'
      },
      cenvio_status: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
      cenvio_update: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: '0000-00-00 00:00:00'
      }
    }, {
      sequelize,
      tableName: 'cat_envio',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'cenvio_id' }
          ]
        }
      ]
    })
    return CatEnvio
  }
}
