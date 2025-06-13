const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return CertificacionResultado.init(sequelize, DataTypes)
}

class CertificacionResultado extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      idcertificacion_resultado: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      idcertificacion: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cert_res_fecha: {
        type: DataTypes.STRING(45),
        allowNull: true
      },
      cert_res_ventas: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      cert_res_costos: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      cert_res_utilidad: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      cert_res_gastosop: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      cert_res_utilidadop: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      cert_res_gastosfin: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      cert_res_otrosingresos: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      cert_res_otrosegresos: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      cert_res_otrosgastos: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      cert_res_resultados: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      cert_res_status: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cert_res_update: {
        type: DataTypes.DATE,
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'certificacion_resultado',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'idcertificacion_resultado' }
          ]
        }
      ]
    })
    return CertificacionResultado
  }
}
