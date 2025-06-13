const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return CertificacionesPais.init(sequelize, DataTypes)
}

class CertificacionesPais extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      pais_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      idioma_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      nombre: {
        type: DataTypes.STRING(200),
        allowNull: false
      }
    }, {
      sequelize,
      tableName: 'certificaciones_pais',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'pais_id' }
          ]
        }
      ]
    })
    return CertificacionesPais
  }
}
