const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return VendedoresMetas.init(sequelize, DataTypes)
}

class VendedoresMetas extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      usuario_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      meta: {
        type: DataTypes.FLOAT,
        allowNull: false
      },
      periodo: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        primaryKey: true
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'vendedores_metas',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'usuario_id' },
            { name: 'periodo' }
          ]
        }
      ]
    })
    return VendedoresMetas
  }
}
