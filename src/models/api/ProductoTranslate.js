const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return ProductoTranslate.init(sequelize, DataTypes)
}

class ProductoTranslate extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      prod_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        primaryKey: true
      },
      idioma_id: {
        type: DataTypes.STRING(45),
        allowNull: false,
        defaultValue: '',
        primaryKey: true
      },
      prod_nombre: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: ''
      },
      prod_desc: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      prod_video: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: ''
      }
    }, {
      sequelize,
      tableName: 'producto_translate',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'prod_id' },
            { name: 'idioma_id' }
          ]
        }
      ]
    })
    return ProductoTranslate
  }
}
