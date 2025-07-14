const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
  class CatBoletinajeMotivosImpago extends Model {}

  CatBoletinajeMotivosImpago.init({
    id_cat_boletinaje_motivo_impago: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      field: 'id_cat_boletinaje_motivo_impago',
    },
    motivo: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'motivo',
    },
    activo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'activo',
    },
  }, {
    sequelize,
    modelName: 'CatBoletinajeMotivosImpago',
    tableName: 'cat_boletinaje_motivos_impago',
    timestamps: false,
  });

  return CatBoletinajeMotivosImpago;
}; 