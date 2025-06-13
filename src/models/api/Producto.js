const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return Producto.init(sequelize, DataTypes)
}

class Producto extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      prod_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      emp_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
      ctprod_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
      prod_nuevo: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
      prod_clearance: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
      cmon_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
      prod_precio_lista: {
        type: DataTypes.FLOAT,
        allowNull: true,
        defaultValue: 0
      },
      prod_precio_promo: {
        type: DataTypes.FLOAT,
        allowNull: true,
        defaultValue: 0
      },
      prod_precio_envio: {
        type: DataTypes.FLOAT,
        allowNull: true,
        defaultValue: 0
      },
      prod_compra_minima: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
      cuni_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
      cmetodo_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
      prod_cobertura_loc: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      prod_cobertura_nac: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      prod_cobertura_int: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cenvio_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
      prod_disponible: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
      prod_marca: {
        type: DataTypes.STRING(150),
        allowNull: true
      },
      prod_status: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
      prod_update: {
        type: DataTypes.DATE,
        allowNull: true
      },
      prod_precio_envio_nacional: {
        type: DataTypes.FLOAT,
        allowNull: true
      },
      prod_precio_envio_internacional: {
        type: DataTypes.FLOAT,
        allowNull: true
      },
      prod_categoria_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'producto',
      timestamps: true,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'prod_id' }
          ]
        }
      ]
    })
    return Producto
  }
}
