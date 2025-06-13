const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return ProductoReview.init(sequelize, DataTypes)
}

class ProductoReview extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      review_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      usu_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      prod_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      calidad: {
        type: DataTypes.DECIMAL(3, 1),
        allowNull: false
      },
      precio: {
        type: DataTypes.DECIMAL(3, 1),
        allowNull: false
      },
      entrega: {
        type: DataTypes.DECIMAL(3, 1),
        allowNull: false
      },
      titulo: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      cuerpo: {
        type: DataTypes.STRING(100),
        allowNull: true
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
      tableName: 'producto_review',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'review_id' }
          ]
        }
      ]
    })
    return ProductoReview
  }
}
