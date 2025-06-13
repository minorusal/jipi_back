const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return EmpresaOrigenRegistro.init(sequelize, DataTypes)
}

class EmpresaOrigenRegistro extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      emp_meta_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      emp_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: 'emp_id'
      },
      meta_from: {
        type: DataTypes.STRING(8),
        allowNull: false
      },
      meta_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      }
    }, {
      sequelize,
      tableName: 'empresa_origen_registro',
      timestamps: true,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'emp_meta_id' }
          ]
        },
        {
          name: 'emp_meta_id',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'emp_meta_id' }
          ]
        },
        {
          name: 'emp_id',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'emp_id' }
          ]
        }
      ]
    })
    return EmpresaOrigenRegistro
  }
}
