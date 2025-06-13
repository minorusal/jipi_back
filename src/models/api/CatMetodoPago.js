const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return CatMetodoPago.init(sequelize, DataTypes)
}

class CatMetodoPago extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      cmetodo_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      cmetodo_desc_esp: {
        type: DataTypes.STRING(150),
        allowNull: true,
        defaultValue: '""'
      },
      cmetodo_desc_ing: {
        type: DataTypes.STRING(150),
        allowNull: true,
        defaultValue: '""'
      },
      cmetodo_status: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
      cmetodo_update: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: '0000-00-00 00:00:00'
      }
    }, {
      sequelize,
      tableName: 'cat_metodo_pago',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'cmetodo_id' }
          ]
        }
      ]
    })
    return CatMetodoPago
  }
}
