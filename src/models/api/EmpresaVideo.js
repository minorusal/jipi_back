const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return EmpresaVideo.init(sequelize, DataTypes)
}

class EmpresaVideo extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      ev_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      emp_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      ev_url: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: ''
      }
    }, {
      sequelize,
      tableName: 'empresa_video',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'ev_id' }
          ]
        }
      ]
    })
    return EmpresaVideo
  }
}
