const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return BlogStatsVisit.init(sequelize, DataTypes)
}

class BlogStatsVisit extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      bsv_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      usu_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      art_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      browser: {
        type: DataTypes.TEXT,
        allowNull: false
      }
    }, {
      sequelize,
      tableName: 'blog_stats_visit',
      timestamps: true,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'bsv_id' }
          ]
        },
        {
          name: 'bsv_id',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'bsv_id' }
          ]
        }
      ]
    })
    return BlogStatsVisit
  }
}
