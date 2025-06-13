const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return BlogArticles.init(sequelize, DataTypes)
}

class BlogArticles extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      art_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      profile_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      title: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      article: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      subtitle: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      image: {
        type: DataTypes.TEXT,
        allowNull: false
      }
    }, {
      sequelize,
      tableName: 'blog_articles',
      timestamps: true,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'art_id' }
          ]
        },
        {
          name: 'art_id',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'art_id' }
          ]
        }
      ]
    })
    return BlogArticles
  }
}
