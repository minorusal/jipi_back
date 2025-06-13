const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return CotComentario.init(sequelize, DataTypes)
}

class CotComentario extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      cmt_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      cot_comentario: {
        type: DataTypes.STRING(500),
        allowNull: true
      },
      usu_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cot_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      prod_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cmt_visto: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
      cot_status: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cot_update: {
        type: DataTypes.DATE,
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'cot_comentario',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'cmt_id' }
          ]
        }
      ]
    })
    return CotComentario
  }
}
