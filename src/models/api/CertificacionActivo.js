const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return CertificacionActivo.init(sequelize, DataTypes)
}

class CertificacionActivo extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      idcertificacion_activo: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      idcertificacion: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cert_act_fecha: {
        type: DataTypes.STRING(45),
        allowNull: true
      },
      cert_act_caja: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      cert_act_inventario: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      cert_act_clientes: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      cert_act_deudores: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      cert_act_otros: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      cert_act_circulante: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      cert_act_fijo: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      cert_act_diferido: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      cert_act_total: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      cert_act_status: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cert_act_update: {
        type: DataTypes.DATE,
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'certificacion_activo',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'idcertificacion_activo' }
          ]
        }
      ]
    })
    return CertificacionActivo
  }
}
