const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return CertificacionesRepresentantes.init(sequelize, DataTypes)
}

class CertificacionesRepresentantes extends Sequelize.Model {
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
      directivo: {
        type: DataTypes.ENUM('0', '1'),
        allowNull: false
      },
      consejo: {
        type: DataTypes.ENUM('0', '1'),
        allowNull: false
      },
      inversionista: {
        type: DataTypes.ENUM('0', '1'),
        allowNull: false
      },
      accionista: {
        type: DataTypes.ENUM('0', '1'),
        allowNull: false
      },
      porcentaje: {
        type: DataTypes.FLOAT,
        allowNull: false
      }
    }, {
      sequelize,
      tableName: 'certificaciones_representantes',
      timestamps: false
    })
    return CertificacionesRepresentantes
  }
}
