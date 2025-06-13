const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return BlogStatsSocial.init(sequelize, DataTypes)
}

class BlogStatsSocial extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      bssl_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      usu_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      browser: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      type: {
        type: DataTypes.INTEGER,
        allowNull: false
      }
    }, {
      sequelize,
      tableName: 'blog_stats_social',
      timestamps: true,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'bssl_id' }
          ]
        },
        {
          name: 'bssl_id',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'bssl_id' }
          ]
        }
      ]
    })
    return BlogStatsSocial
  }
}
