const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return CotBitacora.init(sequelize, DataTypes)
}

class CotBitacora extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      cot_bit_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      cot_father_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cot_children_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'cot_bitacora',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'cot_bit_id' }
          ]
        }
      ]
    })
    return CotBitacora
  }
}
