const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return Menu.init(sequelize, DataTypes)
}

class Menu extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      id_menu: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      menu_nombre: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      caption: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      icon: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      menu_padre: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      pagina_padre: {
        type: DataTypes.TEXT,
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'menu',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'id_menu' }
          ]
        }
      ]
    })
    return Menu
  }
}
