const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return Comentario.init(sequelize, DataTypes)
}

class Comentario extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      cmt_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      cmt_titulo: {
        type: DataTypes.STRING(250),
        allowNull: true
      },
      cmt_desc: {
        type: DataTypes.STRING(1000),
        allowNull: true
      },
      cmt_nombre: {
        type: DataTypes.STRING(150),
        allowNull: true
      },
      cmt_correo: {
        type: DataTypes.STRING(150),
        allowNull: true
      },
      cmt_status: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cmt_update: {
        type: DataTypes.DATE,
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'comentario',
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
    return Comentario
  }
}
