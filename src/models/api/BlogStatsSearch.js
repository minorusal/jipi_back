const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return BlogStatsSearch.init(sequelize, DataTypes)
}

class BlogStatsSearch extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      bssh_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      usu_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      term: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      browser: {
        type: DataTypes.TEXT,
        allowNull: false
      }
    }, {
      sequelize,
      tableName: 'blog_stats_search',
      timestamps: true,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'bssh_id' }
          ]
        },
        {
          name: 'bssh_id',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'bssh_id' }
          ]
        }
      ]
    })
    return BlogStatsSearch
  }
}
