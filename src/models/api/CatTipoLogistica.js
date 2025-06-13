const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return CatTipoLogistica.init(sequelize, DataTypes)
}

class CatTipoLogistica extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      ctl_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      ctl_desc_esp: {
        type: DataTypes.STRING(250),
        allowNull: true
      },
      ctl_desc_ing: {
        type: DataTypes.STRING(250),
        allowNull: true
      },
      ctl_status: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      ctl_update: {
        type: DataTypes.DATE,
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'cat_tipo_logistica',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'ctl_id' }
          ]
        }
      ]
    })
    return CatTipoLogistica
  }
}
