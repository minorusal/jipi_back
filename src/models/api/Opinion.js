const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return Opinion.init(sequelize, DataTypes)
}

class Opinion extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      opinion_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      opinion_titulo: {
        type: DataTypes.STRING(500),
        allowNull: true
      },
      opinion_texto: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      usu_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      opinion_tipo: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      opinion_status: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      opinion_update: {
        type: DataTypes.DATE,
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'opinion',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'opinion_id' }
          ]
        }
      ]
    })
    return Opinion
  }
}
