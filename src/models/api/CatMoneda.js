const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return CatMoneda.init(sequelize, DataTypes)
}

class CatMoneda extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      cmon_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      cmon_desc_esp: {
        type: DataTypes.STRING(150),
        allowNull: true,
        defaultValue: '""'
      },
      cmon_desc_ing: {
        type: DataTypes.STRING(150),
        allowNull: true,
        defaultValue: '""'
      },
      cmon_status: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
      cmon_update: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: '0000-00-00 00:00:00'
      }
    }, {
      sequelize,
      tableName: 'cat_moneda',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'cmon_id' }
          ]
        }
      ]
    })
    return CatMoneda
  }
}
