const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return CertificacionPasivo.init(sequelize, DataTypes)
}

class CertificacionPasivo extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      idcertificacion_pasivo: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      idcertificacion: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cert_pas_fecha: {
        type: DataTypes.STRING(45),
        allowNull: true
      },
      cert_pas_proveedor: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      cert_pas_acreedor: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      cert_pas_impuestos: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      cert_pas_otropasivo: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      cert_pas_otro: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      cert_pas_total_cortoplazo: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      cert_pas_total_largoplazo: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      cert_pas_diferido: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      cert_pas_total: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      cert_pas_status: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cert_pas_update: {
        type: DataTypes.DATE,
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'certificacion_pasivo',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'idcertificacion_pasivo' }
          ]
        }
      ]
    })
    return CertificacionPasivo
  }
}
