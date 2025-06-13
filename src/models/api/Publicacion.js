const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return Publicacion.init(sequelize, DataTypes)
}

class Publicacion extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      pub_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      emp_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
      usu_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
      pub_id_padre: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
      pub_fecha: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: '0000-00-00 00:00:00'
      },
      pub_desc: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      pub_url: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: ''
      }
    }, {
      sequelize,
      tableName: 'publicacion',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'pub_id' }
          ]
        }
      ]
    })
    return Publicacion
  }
}
