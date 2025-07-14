const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  const Usuario = sequelize.define('Usuario', {
    usu_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      field: 'usu_id'
    },
    usu_nombre: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'usu_nombre'
    },
    usu_app: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'usu_app'
    },
    usu_email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      field: 'usu_email'
    },
    usu_psw: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'usu_psw'
    }
    // No es necesario mapear todos los campos, solo los que usamos.
  }, {
    tableName: 'usuario',
    timestamps: false // La tabla tiene created_at, pero no updated_at
  })

  return Usuario
}
