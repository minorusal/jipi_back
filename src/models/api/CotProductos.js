const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return CotProductos.init(sequelize, DataTypes)
}

class CotProductos extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      cot_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      prod_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      emp_id_vendedor: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cot_version: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      cp_cantidad: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cp_precio: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      cot_mejorprecio: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
      cot_prod_status: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cot_prod_update: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
      },
      cot_calificacion: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
      cot_calificacion_comentario: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      cot_visto: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
      cot_solicita_calificacion: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
      cot_prod_comentario: {
        type: DataTypes.TEXT,
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'cot_productos',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'cot_id' },
            { name: 'prod_id' },
            { name: 'cot_version' }
          ]
        }
      ]
    })
    return CotProductos
  }
}
