const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return UsuarioVisita.init(sequelize, DataTypes)
}

class UsuarioVisita extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      origen: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      destino: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      visitas: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      fecha: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
      }
    }, {
      sequelize,
      tableName: 'usuario_visita',
      timestamps: false
    })
    return UsuarioVisita
  }
}
