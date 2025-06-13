const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return CertificacionesInmueble.init(sequelize, DataTypes)
}

class CertificacionesInmueble extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      certificacion_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      direccion: {
        type: DataTypes.STRING(5000),
        allowNull: false
      },
      propio: {
        type: DataTypes.ENUM('0', '1'),
        allowNull: false
      },
      comodato: {
        type: DataTypes.ENUM('0', '1'),
        allowNull: false
      },
      renta: {
        type: DataTypes.ENUM('0', '1'),
        allowNull: false
      },
      precio: {
        type: DataTypes.FLOAT,
        allowNull: true
      },
      oficinas_administrativas: {
        type: DataTypes.ENUM('0', '1'),
        allowNull: false
      },
      almacen: {
        type: DataTypes.ENUM('0', '1'),
        allowNull: false
      },
      area_produccion: {
        type: DataTypes.ENUM('0', '1'),
        allowNull: false
      }
    }, {
      sequelize,
      tableName: 'certificaciones_inmueble',
      timestamps: false
    })
    return CertificacionesInmueble
  }
}
