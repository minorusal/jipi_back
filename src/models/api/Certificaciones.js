const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return Certificaciones.init(sequelize, DataTypes)
}

class Certificaciones extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      certificacion_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      empresa_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: 'empresa_id'
      },
      nrp: {
        type: DataTypes.STRING(500),
        allowNull: false
      },
      herramienta_proteccion_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      capital_social: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      representante_legal: {
        type: DataTypes.STRING(500),
        allowNull: false
      },
      empleados: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      periodo_activo: {
        type: DataTypes.FLOAT,
        allowNull: false
      },
      periodo_pasivo: {
        type: DataTypes.FLOAT,
        allowNull: false
      },
      ventas: {
        type: DataTypes.FLOAT,
        allowNull: false
      },
      capital: {
        type: DataTypes.FLOAT,
        allowNull: false
      },
      unidad_neta: {
        type: DataTypes.FLOAT,
        allowNull: false
      },
      fecha: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
      }
    }, {
      sequelize,
      tableName: 'certificaciones',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'certificacion_id' }
          ]
        },
        {
          name: 'empresa_id',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'empresa_id' }
          ]
        }
      ]
    })
    return Certificaciones
  }
}
