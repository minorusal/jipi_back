const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return BlogComments.init(sequelize, DataTypes)
}

class BlogComments extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      comment_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      art_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      usu_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      comment: {
        type: DataTypes.TEXT,
        allowNull: false
      }
    }, {
      sequelize,
      tableName: 'blog_comments',
      timestamps: true,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'comment_id' }
          ]
        },
        {
          name: 'comment_id',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'comment_id' }
          ]
        }
      ]
    })
    return BlogComments
  }
}
