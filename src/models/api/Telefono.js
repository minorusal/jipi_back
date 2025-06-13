const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return Telefono.init(sequelize, DataTypes)
}

class Telefono extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      telefono_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      domicilio_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'domicilio',
          key: 'domicilio_id'
        }
      },
      numero: {
        type: DataTypes.STRING(50),
        allowNull: false
      },
      fecha_creacion: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
      },
      fecha_actualizacion: {
        type: DataTypes.DATE,
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'telefono',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'telefono_id' }
          ]
        },
        {
          name: 'fk_telefono_domicilio_idx',
          using: 'BTREE',
          fields: [
            { name: 'domicilio_id' }
          ]
        }
      ]
    })
    return Telefono
  }
}
