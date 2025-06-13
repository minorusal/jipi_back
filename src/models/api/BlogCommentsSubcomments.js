const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return BlogCommentsSubcomments.init(sequelize, DataTypes)
}

class BlogCommentsSubcomments extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      bcs_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      comment_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      subcomment_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      }
    }, {
      sequelize,
      tableName: 'blog_comments_subcomments',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'bcs_id' }
          ]
        },
        {
          name: 'bcs_id',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'bcs_id' }
          ]
        }
      ]
    })
    return BlogCommentsSubcomments
  }
}
