const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return CertificacionEmpresa.init(sequelize, DataTypes)
}

class CertificacionEmpresa extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      idcertificacion_empresa: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      idcertificacion: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cert_e_razonsocial: {
        type: DataTypes.STRING(500),
        allowNull: true
      },
      cpais_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      idtipo_inmueble: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cert_e_status: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cert_e_update: {
        type: DataTypes.DATE,
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'certificacion_empresa',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'idcertificacion_empresa' }
          ]
        }
      ]
    })
    return CertificacionEmpresa
  }
}
