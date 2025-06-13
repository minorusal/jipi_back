const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return CertificacionCapital.init(sequelize, DataTypes)
}

class CertificacionCapital extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      idcertificacion_capital: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      idcertificacion: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cert_cap_fecha: {
        type: DataTypes.STRING(45),
        allowNull: true
      },
      cert_cap_fijo: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      cert_cap_redanterior: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      cert_cap_ejercicio: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      cert_cap_otros: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      cert_cap_capitalcontable: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      cert_cap_sumapasivocapital: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      cert_cap_status: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cert_cap_update: {
        type: DataTypes.DATE,
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'certificacion_capital',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'idcertificacion_capital' }
          ]
        }
      ]
    })
    return CertificacionCapital
  }
}
