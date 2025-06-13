const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return ProductoReviewFoto.init(sequelize, DataTypes)
}

class ProductoReviewFoto extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      review_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      foto: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      fecha_creacion: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
      }
    }, {
      sequelize,
      tableName: 'producto_review_foto',
      timestamps: false
    })
    return ProductoReviewFoto
  }
}
