const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return Problemas.init(sequelize, DataTypes)
}

class Problemas extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      problema_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      usu_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      problema: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      imagen: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      fecha_creacion: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
      }
    }, {
      sequelize,
      tableName: 'problemas',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'problema_id' }
          ]
        }
      ]
    })
    return Problemas
  }
}
