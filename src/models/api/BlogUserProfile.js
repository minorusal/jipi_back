const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return BlogUserProfile.init(sequelize, DataTypes)
}

class BlogUserProfile extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      profile_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      usu_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: 'usu_id'
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false
      }
    }, {
      sequelize,
      tableName: 'blog_user_profile',
      timestamps: true,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'profile_id' }
          ]
        },
        {
          name: 'profile_id',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'profile_id' }
          ]
        },
        {
          name: 'usu_id',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'usu_id' }
          ]
        }
      ]
    })
    return BlogUserProfile
  }
}
