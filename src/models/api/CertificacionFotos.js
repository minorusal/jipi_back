const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return CertificacionFotos.init(sequelize, DataTypes)
}

class CertificacionFotos extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      idcertificacion_fotos: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      idcertificacion: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cert_f_url: {
        type: DataTypes.STRING(250),
        allowNull: true
      },
      cert_f_status: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cert_f_update: {
        type: DataTypes.DATE,
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'certificacion_fotos',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'idcertificacion_fotos' }
          ]
        }
      ]
    })
    return CertificacionFotos
  }
}
