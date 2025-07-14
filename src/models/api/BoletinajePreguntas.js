'use strict'
const { Model, DataTypes } = require('sequelize')

module.exports = (sequelize) => {
  const BoletinajePreguntas = sequelize.define('BoletinajePreguntas', {
    id_boletinaje_pregunta: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      field: 'id_boletinaje_pregunta' // Indicar explícitamente el nombre del campo
    },
    pregunta: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    orden: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    activo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    }
  }, {
    sequelize,
    tableName: 'boletinaje_preguntas',
    modelName: 'BoletinajePreguntas',
    timestamps: false
  })

  return BoletinajePreguntas
} 