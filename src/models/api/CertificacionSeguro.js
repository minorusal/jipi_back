const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return CertificacionSeguro.init(sequelize, DataTypes)
}

class CertificacionSeguro extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      idcertificacion_seguro: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      idcertificacion: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cert_seg_aseguradora: {
        type: DataTypes.STRING(250),
        allowNull: true
      },
      cert_seg_tipo: {
        type: DataTypes.STRING(250),
        allowNull: true
      },
      cert_seg_numero: {
        type: DataTypes.STRING(250),
        allowNull: true
      },
      cert_seg_sumaaseg: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      cert_seg_tipocobertura: {
        type: DataTypes.STRING(250),
        allowNull: true
      },
      cert_seg_inicio: {
        type: DataTypes.DATEONLY,
        allowNull: true
      },
      cert_seg_fin: {
        type: DataTypes.DATEONLY,
        allowNull: true
      },
      cert_seg_status: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cert_seg_update: {
        type: DataTypes.DATE,
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'certificacion_seguro',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'idcertificacion_seguro' }
          ]
        }
      ]
    })
    return CertificacionSeguro
  }
}
