const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return Perfiles.init(sequelize, DataTypes)
}

class Perfiles extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      id_perfiles: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      descripcion: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      permiso_web: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      permiso_app: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      status_perfil: {
        type: DataTypes.INTEGER,
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'perfiles',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'id_perfiles' }
          ]
        }
      ]
    })
    return Perfiles
  }
}
