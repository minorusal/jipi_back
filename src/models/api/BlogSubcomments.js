const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return BlogSubcomments.init(sequelize, DataTypes)
}

class BlogSubcomments extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      subcomment_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      usu_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      subcomment: {
        type: DataTypes.TEXT,
        allowNull: false
      }
    }, {
      sequelize,
      tableName: 'blog_subcomments',
      timestamps: true,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'subcomment_id' }
          ]
        },
        {
          name: 'subcomment_id',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'subcomment_id' }
          ]
        }
      ]
    })
    return BlogSubcomments
  }
}
