const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
  class BoletinajeNotificacionSinImpago extends Model {
    static associate(models) {
      // una notificación tiene muchos incidentes
      this.hasMany(models.BoletinajeNotificacionSinImpagoIncidentes, {
        foreignKey: 'id_boletinaje_notificacion_sin_impago',
      });
    }
  }

  BoletinajeNotificacionSinImpago.init({
    id_boletinaje_notificacion_sin_impago: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      field: 'id_boletinaje_notificacion_sin_impago',
    },
    id_empresa_proveedor: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'id_empresa_proveedor',
    },
    id_empresa_cliente: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'id_empresa_cliente',
    },
    acepta_responsabilidad: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      field: 'acepta_responsabilidad',
    },
    fecha_creacion: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'fecha_creacion',
    },
  }, {
    sequelize,
    modelName: 'BoletinajeNotificacionSinImpago',
    tableName: 'boletinaje_notificacion_sin_impago',
    timestamps: false,
  });

  return BoletinajeNotificacionSinImpago;
}; 