const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return Etiqueta.init(sequelize, DataTypes)
}

class Etiqueta extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      etq_pantalla: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        primaryKey: true
      },
      etq_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        primaryKey: true
      },
      etq_p_desc: {
        type: DataTypes.STRING(45),
        allowNull: true,
        defaultValue: '""'
      },
      etq_esp: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: '""'
      },
      etq_ing: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: '""'
      }
    }, {
      sequelize,
      tableName: 'etiqueta',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'etq_pantalla' },
            { name: 'etq_id' }
          ]
        }
      ]
    })
    return Etiqueta
  }
}
