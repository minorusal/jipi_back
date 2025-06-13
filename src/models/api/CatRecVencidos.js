const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return CatRecVencidos.init(sequelize, DataTypes)
}

class CatRecVencidos extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      crecup_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      crecup_desc_esp: {
        type: DataTypes.STRING(150),
        allowNull: true,
        defaultValue: '""'
      },
      crecup_desc_ing: {
        type: DataTypes.STRING(150),
        allowNull: true,
        defaultValue: '""'
      },
      crecup_status: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
      crecup_update: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: '0000-00-00 00:00:00'
      }
    }, {
      sequelize,
      tableName: 'cat_rec_vencidos',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'crecup_id' }
          ]
        }
      ]
    })
    return CatRecVencidos
  }
}
