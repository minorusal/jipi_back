const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return CertificacionesReferenciasComerciales.init(sequelize, DataTypes)
}

class CertificacionesReferenciasComerciales extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      certificacion_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      empresa: {
        type: DataTypes.STRING(500),
        allowNull: false
      },
      nombre: {
        type: DataTypes.STRING(500),
        allowNull: false
      },
      correo: {
        type: DataTypes.STRING(500),
        allowNull: false
      },
      telefono: {
        type: DataTypes.STRING(500),
        allowNull: false
      },
      pais_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      }
    }, {
      sequelize,
      tableName: 'certificaciones_referencias_comerciales',
      timestamps: false
    })
    return CertificacionesReferenciasComerciales
  }
}
