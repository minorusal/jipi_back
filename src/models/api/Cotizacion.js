const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return Cotizacion.init(sequelize, DataTypes)
}

class Cotizacion extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      cot_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      usu_id_comprador: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      emp_id_vendedor: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      cot_delivery: {
        type: DataTypes.DATEONLY,
        allowNull: false
      },
      cmetodo_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cpais_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cedo_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cot_comentario: {
        type: DataTypes.STRING(500),
        allowNull: true
      },
      cot_status: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
      },
      descuento: {
        type: DataTypes.DECIMAL(16, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      visto: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: 4
      },
      domicilio_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      usu_id_vendedor: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      emp_id_comprador: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      credito_fecha: {
        type: DataTypes.DATE,
        allowNull: true
      },
      credito_dias: {
        type: DataTypes.INTEGER,
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'cotizacion',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'cot_id' }
          ]
        }
      ]
    })
    return Cotizacion
  }
}
