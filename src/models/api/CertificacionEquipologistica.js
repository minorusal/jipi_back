const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return CertificacionEquipologistica.init(sequelize, DataTypes)
}

class CertificacionEquipologistica extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      idcertificacion_equipologistica: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      idcertificacion: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      ctl_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cert_el_marca: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      cert_el_modelo: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      cert_el_cantidad: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cert_el_anio: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cert_el_comentario: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      cert_el_status: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cert_el_update: {
        type: DataTypes.DATE,
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'certificacion_equipologistica',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'idcertificacion_equipologistica' }
          ]
        }
      ]
    })
    return CertificacionEquipologistica
  }
}
