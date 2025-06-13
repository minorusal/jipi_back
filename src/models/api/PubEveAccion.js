const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return PubEveAccion.init(sequelize, DataTypes)
}

class PubEveAccion extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      pea_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      pub_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
      usu_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
      emp_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      eve_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
      pea_tipo: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
        comment: '1 like \n2 compartir\n\n'
      },
      pea_fecha: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: '0000-00-00 00:00:00'
      }
    }, {
      sequelize,
      tableName: 'pub_eve_accion',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'pea_id' }
          ]
        }
      ]
    })
    return PubEveAccion
  }
}
