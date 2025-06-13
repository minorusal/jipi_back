const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return EmpresaFoto.init(sequelize, DataTypes)
}

class EmpresaFoto extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      ef_id: {
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
      ef_url: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: ''
      }
    }, {
      sequelize,
      tableName: 'empresa_foto',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'ef_id' }
          ]
        }
      ]
    })
    return EmpresaFoto
  }
}
