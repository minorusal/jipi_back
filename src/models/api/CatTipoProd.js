const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return CatTipoProd.init(sequelize, DataTypes)
}

class CatTipoProd extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      ctprod_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      ctprod_desc_esp: {
        type: DataTypes.STRING(150),
        allowNull: true,
        defaultValue: '""'
      },
      ctprod_desc_ing: {
        type: DataTypes.STRING(150),
        allowNull: true,
        defaultValue: '""'
      },
      ctprod_status: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
      ctprod_update: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: '0000-00-00 00:00:00'
      }
    }, {
      sequelize,
      tableName: 'cat_tipo_prod',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'ctprod_id' }
          ]
        }
      ]
    })
    return CatTipoProd
  }
}
