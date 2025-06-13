const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return CertificacionBanco.init(sequelize, DataTypes)
}

class CertificacionBanco extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      idcertificacion_banco: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      idcertificacion: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cert_b_banco: {
        type: DataTypes.STRING(250),
        allowNull: true
      },
      cert_b_cuenta: {
        type: DataTypes.STRING(45),
        allowNull: true
      },
      cert_b_saldo: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      cert_b_lineacredito: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      cmon_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cert_b_status: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cert_b_update: {
        type: DataTypes.DATE,
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'certificacion_banco',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'idcertificacion_banco' }
          ]
        }
      ]
    })
    return CertificacionBanco
  }
}
