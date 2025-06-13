const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return Domicilio.init(sequelize, DataTypes)
}

class Domicilio extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      domicilio_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      emp_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'empresa',
          key: 'emp_id'
        }
      },
      estado_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'estado',
          key: 'estado_id'
        }
      },
      domicilio_tipo: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 2,
        references: {
          model: 'domicilio_tipo',
          key: 'domicilio_tipo_id'
        }
      },
      nombre: {
        type: DataTypes.STRING(500),
        allowNull: false
      },
      direccion: {
        type: DataTypes.STRING(5000),
        allowNull: false
      },
      google_id: {
        type: DataTypes.STRING(5000),
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
      tableName: 'domicilio',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'domicilio_id' }
          ]
        },
        {
          name: 'fk_domicilio_tipo_idx',
          using: 'BTREE',
          fields: [
            { name: 'domicilio_tipo' }
          ]
        },
        {
          name: 'fk_domicilio_estado_idx',
          using: 'BTREE',
          fields: [
            { name: 'estado_id' }
          ]
        },
        {
          name: 'fk_domicilio_empresa_idx',
          using: 'BTREE',
          fields: [
            { name: 'emp_id' }
          ]
        }
      ]
    })
    return Domicilio
  }
}
