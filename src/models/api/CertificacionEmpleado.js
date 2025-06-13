const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return CertificacionEmpleado.init(sequelize, DataTypes)
}

class CertificacionEmpleado extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      idcertificado_empleado: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      idcertificacion: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cert_emp_desc: {
        type: DataTypes.STRING(180),
        allowNull: true
      },
      cert_emp_numero: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cert_emp_status: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cert_emp_update: {
        type: DataTypes.DATE,
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'certificacion_empleado',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'idcertificado_empleado' }
          ]
        }
      ]
    })
    return CertificacionEmpleado
  }
}
