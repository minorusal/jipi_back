const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return CertificacionInmueble.init(sequelize, DataTypes)
}

class CertificacionInmueble extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      idcertificacion_inmueble: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      idcertificacion: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      idtipo_inmueble: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      idcat_porpiedad: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cert_inmueble_precio: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      cert_inmueble_direccion: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      cert_inmueble_status: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cert_inmueble_update: {
        type: DataTypes.DATE,
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'certificacion_inmueble',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'idcertificacion_inmueble' }
          ]
        }
      ]
    })
    return CertificacionInmueble
  }
}
