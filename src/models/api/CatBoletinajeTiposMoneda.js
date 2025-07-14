const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
  class CatBoletinajeTiposMoneda extends Model {}

  CatBoletinajeTiposMoneda.init({
    id_cat_boletinaje_tipo_moneda: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      field: 'id_cat_boletinaje_tipo_moneda',
    },
    nombre_moneda: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'nombre_moneda',
    },
    codigo_moneda: {
      type: DataTypes.STRING(3),
      allowNull: false,
      field: 'codigo_moneda',
    },
    activo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'activo',
    },
  }, {
    sequelize,
    modelName: 'CatBoletinajeTiposMoneda',
    tableName: 'cat_boletinaje_tipos_moneda',
    timestamps: false,
  });

  return CatBoletinajeTiposMoneda;
}; 