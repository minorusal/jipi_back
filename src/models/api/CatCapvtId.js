const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return CatCapvtId.init(sequelize, DataTypes)
}

class CatCapvtId extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      cat_envio_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        primaryKey: true
      },
      cat_envio_desc: {
        type: DataTypes.STRING(45),
        allowNull: true,
        defaultValue: '""'
      }
    }, {
      sequelize,
      tableName: 'cat_capvt_id',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'cat_envio_id' }
          ]
        }
      ]
    })
    return CatCapvtId
  }
}
