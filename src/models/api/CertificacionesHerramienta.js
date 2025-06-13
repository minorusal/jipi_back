const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return CertificacionesHerramienta.init(sequelize, DataTypes)
}

class CertificacionesHerramienta extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      herramienta_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      herramienta: {
        type: DataTypes.STRING(500),
        allowNull: false
      }
    }, {
      sequelize,
      tableName: 'certificaciones_herramienta',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'herramienta_id' }
          ]
        }
      ]
    })
    return CertificacionesHerramienta
  }
}
