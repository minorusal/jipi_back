const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return CertificacionAccionista.init(sequelize, DataTypes)
}

class CertificacionAccionista extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      idcertificacion_accionista: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      idcertificacion: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cert_ac_nombre: {
        type: DataTypes.STRING(250),
        allowNull: true
      },
      cert_ac_porcentaje: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      cert_ac_cargoDir: {
        type: DataTypes.STRING(500),
        allowNull: true
      },
      cert_ac_cargoConsejo: {
        type: DataTypes.STRING(500),
        allowNull: true
      },
      cert_ac_titulos: {
        type: DataTypes.STRING(500),
        allowNull: true
      },
      cert_ac_status: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cert_ac_update: {
        type: DataTypes.DATE,
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'certificacion_accionista',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'idcertificacion_accionista' }
          ]
        }
      ]
    })
    return CertificacionAccionista
  }
}
