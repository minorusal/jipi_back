const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  const Empresa = sequelize.define('Empresa', {
    emp_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      field: 'emp_id'
    },
    emp_nombre: {
      type: DataTypes.STRING(200),
      allowNull: false,
      field: 'emp_nombre'
    },
    emp_razon_social: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'emp_razon_social'
    }
    // No es necesario mapear todos los campos, solo los que usamos.
  }, {
    tableName: 'empresa',
    timestamps: false
  })

  return Empresa
}
