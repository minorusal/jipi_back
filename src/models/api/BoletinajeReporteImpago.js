const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  const BoletinajeReporteImpago = sequelize.define('BoletinajeReporteImpago', {
    id_boletinaje_reporte_impago: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      field: 'id_boletinaje_reporte_impago'
    },
    id_boletinaje_grupo: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      field: 'id_boletinaje_grupo'
    },
    nombre_empresa_deudora: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'nombre_empresa_deudora'
    },
    rfc_deudor: {
      type: DataTypes.STRING(13),
      allowNull: false,
      field: 'rfc_deudor'
    },
    nombre_representante_legal: {
      type: DataTypes.STRING(255),
      field: 'nombre_representante_legal'
    },
    numero_facturas_vencidas: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'numero_facturas_vencidas'
    },
    monto_adeudo: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      field: 'monto_adeudo'
    },
    id_cat_boletinaje_tipo_moneda: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'id_cat_boletinaje_tipo_moneda'
    },
    fecha_factura: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'fecha_factura'
    },
    folio_factura: {
      type: DataTypes.STRING(100),
      field: 'folio_factura'
    },
    id_cat_boletinaje_motivo_impago: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'id_cat_boletinaje_motivo_impago'
    },
    id_cat_boletinaje_estatus: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'id_cat_boletinaje_estatus'
    },
    comentarios_adicionales: {
      type: DataTypes.TEXT,
      field: 'comentarios_adicionales'
    },
    documento_factura_url: {
      type: DataTypes.STRING(500),
      field: 'documento_factura_url'
    },
    documento_adicional_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'URL del documento adicional (ej. pagaré, contrato).'
    },
    notificaciones_canceladas: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Indica si el seguimiento por correo electrónico ha sido cancelado.'
    },
    dar_seguimiento: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Indica si el usuario desea que se envíen correos de seguimiento.'
    },
    divulgar_nombre_proveedor: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Indica si el nombre del proveedor puede ser revelado.'
    },
    frecuencia_seguimiento: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Frecuencia en días para los recordatorios por correo.'
    },
    acepta_terminos: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      comment: 'Indica si el usuario aceptó los términos y condiciones.'
    }
  }, {
    tableName: 'boletinaje_reporte_impago',
    timestamps: true,
    createdAt: 'fecha_creacion',
    updatedAt: false
  })

  BoletinajeReporteImpago.associate = function (models) {
    this.hasMany(models.BoletinajeReporteImpagoContactos, {
      foreignKey: 'id_boletinaje_reporte_impago',
      as: 'contactos'
    })
    this.belongsTo(models.CatBoletinajeEstatus, {
      foreignKey: 'id_cat_boletinaje_estatus',
      as: 'estatus'
    })
    this.belongsTo(models.BoletinajeGrupo, {
      foreignKey: 'id_boletinaje_grupo',
      as: 'grupo'
    })
  }

  return BoletinajeReporteImpago
}