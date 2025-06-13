const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return Estado.init(sequelize, DataTypes)
}

class Estado extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      estado_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      pais_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'pais',
          key: 'pais_id'
        }
      },
      iso: {
        type: DataTypes.STRING(10),
        allowNull: false
      }
    }, {
      sequelize,
      tableName: 'estado',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'estado_id' }
          ]
        },
        {
          name: 'fk_estado_pais_idx',
          using: 'BTREE',
          fields: [
            { name: 'pais_id' }
          ]
        }
      ]
    })
    return Estado
  }
}
