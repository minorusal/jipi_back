const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return EmpresaCalif.init(sequelize, DataTypes)
}

class EmpresaCalif extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      emp_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      usu_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      emp_calif: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      emp_callif_comentario: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      emp_udpate: {
        type: DataTypes.DATE,
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'empresa_calif',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'emp_id' }
          ]
        }
      ]
    })
    return EmpresaCalif
  }
}
