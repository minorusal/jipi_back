const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return EmpresaExportado.init(sequelize, DataTypes)
}

class EmpresaExportado extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      emp_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        primaryKey: true
      },
      cpais_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        primaryKey: true
      }
    }, {
      sequelize,
      tableName: 'empresa_exportado',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'emp_id' },
            { name: 'cpais_id' }
          ]
        }
      ]
    })
    return EmpresaExportado
  }
}
