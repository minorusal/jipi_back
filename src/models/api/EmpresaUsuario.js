const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  const EmpresaUsuario = sequelize.define('EmpresaUsuario', {
    emp_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
      field: 'emp_id'
    },
    usu_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
      field: 'usu_id'
    }
  }, {
    tableName: 'empresa_usuario',
    timestamps: false
  })

  EmpresaUsuario.associate = function (models) {
    this.belongsTo(models.Usuario, { foreignKey: 'usu_id' })
    this.belongsTo(models.Empresa, { foreignKey: 'emp_id' })
  }

  return EmpresaUsuario
}
