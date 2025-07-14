const { DataTypes, Model } = require('sequelize')

/**
 * Modelo para la tabla `parametros`.
 * Almacena configuraciones y parámetros generales de la aplicación.
 *
 * @param {object} sequelize - Instancia de Sequelize.
 * @returns {object} - El modelo Sequelize definido.
 */
module.exports = (sequelize) => {
  const Parametro = sequelize.define('Parametro', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    nombre: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    valor: {
      type: DataTypes.STRING,
      allowNull: false
    },
    descripcion: {
      type: DataTypes.TEXT
    },
    tipo_dato: {
      type: DataTypes.ENUM('string', 'int', 'boolean', 'float', 'json', 'date'),
      allowNull: false
    }
  }, {
    tableName: 'parametros',
    timestamps: true,
    createdAt: 'fecha_creacion',
    updatedAt: 'fecha_modificacion'
  })

  return Parametro
} 