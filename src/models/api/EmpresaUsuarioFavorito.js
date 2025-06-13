const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return EmpresaUsuarioFavorito.init(sequelize, DataTypes)
}

class EmpresaUsuarioFavorito extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      usu_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      emp_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
      }
    }, {
      sequelize,
      tableName: 'empresa_usuario_favorito',
      timestamps: false
    })
    return EmpresaUsuarioFavorito
  }
}
