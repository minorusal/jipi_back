const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
  class CatBoletinajeEstatus extends Model {}

  CatBoletinajeEstatus.init({
    id_cat_boletinaje_estatus: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      field: 'id_cat_boletinaje_estatus',
    },
    nombre: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      field: 'nombre',
    },
    descripcion: {
      type: DataTypes.STRING(255),
      field: 'descripcion',
    },
  }, {
    sequelize,
    modelName: 'CatBoletinajeEstatus',
    tableName: 'cat_boletinaje_estatus',
    timestamps: false,
  });

  return CatBoletinajeEstatus;
}; 