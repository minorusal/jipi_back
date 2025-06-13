const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return CronosDirectorio.init(sequelize, DataTypes)
}

class CronosDirectorio extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      id_empresa: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      id_reporte: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      empresa: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      NombreSimple: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      tipoSociedad: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      rfc: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      web: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      domicilio: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      telefono: {
        type: DataTypes.STRING(255),
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'cronos_directorio',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'id' }
          ]
        },
        {
          name: 'id',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'id' }
          ]
        }
      ]
    })
    return CronosDirectorio
  }
}
