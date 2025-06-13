const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return EmpresaToken.init(sequelize, DataTypes)
}

class EmpresaToken extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      id: {
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
      emp_token: {
        type: DataTypes.STRING(1024),
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'empresa_token',
      timestamps: true,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'id' }
          ]
        },
        {
          name: 'id',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'id' }
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
    return EmpresaToken
  }
}
