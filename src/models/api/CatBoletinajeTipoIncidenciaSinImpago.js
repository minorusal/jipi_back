const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
  class CatBoletinajeTipoIncidenciaSinImpago extends Model {}

  CatBoletinajeTipoIncidenciaSinImpago.init({
    id_cat_boletinaje_tipo_incidencia_sin_impago: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      field: 'id_cat_boletinaje_tipo_incidencia_sin_impago',
    },
    codigo: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      field: 'codigo',
    },
    descripcion: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'descripcion',
    },
    activo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'activo',
    },
  }, {
    sequelize,
    modelName: 'CatBoletinajeTipoIncidenciaSinImpago',
    tableName: 'cat_boletinaje_tipo_incidencia_sin_impago',
    timestamps: false,
  });

  return CatBoletinajeTipoIncidenciaSinImpago;
}; 