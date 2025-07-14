const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
  class BoletinajeNotificacionSinImpagoIncidentes extends Model {
    static associate(models) {
      // un incidente pertenece a una notificación
      this.belongsTo(models.BoletinajeNotificacionSinImpago, {
        foreignKey: 'id_boletinaje_notificacion_sin_impago',
      });
      // un incidente tiene un tipo
      this.belongsTo(models.CatBoletinajeTipoIncidenciaSinImpago, {
        foreignKey: 'id_cat_boletinaje_tipo_incidencia_sin_impago',
      });
    }
  }

  BoletinajeNotificacionSinImpagoIncidentes.init({
    id_boletinaje_notificacion_sin_impago_incidente: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      field: 'id_boletinaje_notificacion_sin_impago_incidente',
    },
    id_boletinaje_notificacion_sin_impago: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'id_boletinaje_notificacion_sin_impago',
    },
    id_cat_boletinaje_tipo_incidencia_sin_impago: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'id_cat_boletinaje_tipo_incidencia_sin_impago',
    },
    razon_social_relacionada: {
      type: DataTypes.STRING(255),
      field: 'razon_social_relacionada',
    },
    rfc_relacionado: {
      type: DataTypes.STRING(13),
      field: 'rfc_relacionado',
    },
    detalles: {
      type: DataTypes.TEXT,
      field: 'detalles',
    },
  }, {
    sequelize,
    modelName: 'BoletinajeNotificacionSinImpagoIncidentes',
    tableName: 'boletinaje_notificacion_sin_impago_incidentes',
    timestamps: false,
  });

  return BoletinajeNotificacionSinImpagoIncidentes;
}; 