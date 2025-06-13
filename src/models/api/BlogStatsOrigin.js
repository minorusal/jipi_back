const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return BlogStatsOrigin.init(sequelize, DataTypes)
}

class BlogStatsOrigin extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      bso_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      usu_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      type: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      browser: {
        type: DataTypes.TEXT,
        allowNull: false
      }
    }, {
      sequelize,
      tableName: 'blog_stats_origin',
      timestamps: true,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'bso_id' }
          ]
        },
        {
          name: 'bso_id',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'bso_id' }
          ]
        }
      ]
    })
    return BlogStatsOrigin
  }
}
