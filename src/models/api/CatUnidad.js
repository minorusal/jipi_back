const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return CatUnidad.init(sequelize, DataTypes)
}

class CatUnidad extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      cuni_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      cuni_desc_esp: {
        type: DataTypes.STRING(150),
        allowNull: true,
        defaultValue: '""'
      },
      cuni_desc_ing: {
        type: DataTypes.STRING(150),
        allowNull: true,
        defaultValue: '""'
      },
      cuni_status: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
      cuni_update: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: '0000-00-00 00:00:00'
      }
    }, {
      sequelize,
      tableName: 'cat_unidad',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'cuni_id' }
          ]
        }
      ]
    })
    return CatUnidad
  }
}
