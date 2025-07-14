'use strict'
const { Model, DataTypes } = require('sequelize')

module.exports = (sequelize) => {
  const BoletinajeRespuestas = sequelize.define('BoletinajeRespuestas', {
    id_boletinaje_respuesta: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      field: 'id_boletinaje_respuesta'
    },
    id_boletinaje_grupo: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'id_boletinaje_grupo'
    },
    id_boletinaje_pregunta: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'id_boletinaje_pregunta'
    },
    respuesta: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      field: 'respuesta'
    }
  }, {
    sequelize,
    modelName: 'BoletinajeRespuestas',
    tableName: 'boletinaje_respuestas',
    timestamps: false
  })
  return BoletinajeRespuestas
} 