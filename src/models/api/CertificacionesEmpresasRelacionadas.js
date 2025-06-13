const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return CertificacionesEmpresasRelacionadas.init(sequelize, DataTypes)
}

class CertificacionesEmpresasRelacionadas extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      certificacion_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      nombre: {
        type: DataTypes.STRING(500),
        allowNull: false
      },
      razon_social: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      pais_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      }
    }, {
      sequelize,
      tableName: 'certificaciones_empresas_relacionadas',
      timestamps: false
    })
    return CertificacionesEmpresasRelacionadas
  }
}
