const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return RelMenuPerfil.init(sequelize, DataTypes)
}

class RelMenuPerfil extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      id_perfiles: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      id_menu: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      status_perfiles: {
        type: DataTypes.INTEGER,
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'rel_menu_perfil',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'id_perfiles' },
            { name: 'id_menu' }
          ]
        }
      ]
    })
    return RelMenuPerfil
  }
}
