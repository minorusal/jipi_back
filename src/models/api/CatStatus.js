const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return CatStatus.init(sequelize, DataTypes)
}

class CatStatus extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      status_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      cat_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cat_tabla: {
        type: DataTypes.STRING(45),
        allowNull: true
      },
      cat_valor: {
        type: DataTypes.STRING(150),
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'cat_status',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'status_id' }
          ]
        }
      ]
    })
    return CatStatus
  }
}
