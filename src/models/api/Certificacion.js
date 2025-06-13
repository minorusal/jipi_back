const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return Certificacion.init(sequelize, DataTypes)
}

class Certificacion extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      idcertificacion: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      cert_rfc: {
        type: DataTypes.STRING(45),
        allowNull: true
      },
      cert_padron_i_e: {
        type: DataTypes.STRING(150),
        allowNull: true
      },
      cert_contacto: {
        type: DataTypes.STRING(250),
        allowNull: true
      },
      cert_telefono: {
        type: DataTypes.STRING(45),
        allowNull: true
      },
      cert_correo: {
        type: DataTypes.STRING(150),
        allowNull: true
      },
      cert_sector: {
        type: DataTypes.STRING(150),
        allowNull: true
      },
      cert_actividad_giro: {
        type: DataTypes.STRING(150),
        allowNull: true
      },
      cert_ventas_anuales: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      cert_nace: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cert_nrp: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cert_herramienta_proteccion: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      cert_historia_empresa: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      cert_maquinaria_equipo: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      cert_ac_finicio: {
        type: DataTypes.DATEONLY,
        allowNull: true
      },
      cert_ac_fconstitucion: {
        type: DataTypes.DATEONLY,
        allowNull: true
      },
      cert_ac_numescritura: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      cert_ac_tomo: {
        type: DataTypes.STRING(45),
        allowNull: true
      },
      cert_ac_volumen: {
        type: DataTypes.STRING(45),
        allowNull: true
      },
      cert_ac_libro: {
        type: DataTypes.STRING(45),
        allowNull: true
      },
      cert_ac_seccion: {
        type: DataTypes.STRING(45),
        allowNull: true
      },
      cert_ac_notario: {
        type: DataTypes.STRING(250),
        allowNull: true
      },
      cert_ac_notaria: {
        type: DataTypes.STRING(45),
        allowNull: true
      },
      cert_ac_estado: {
        type: DataTypes.STRING(150),
        allowNull: true
      },
      cert_ac_relexteriores: {
        type: DataTypes.STRING(45),
        allowNull: true
      },
      cert_ac_frelexteriores: {
        type: DataTypes.DATEONLY,
        allowNull: true
      },
      cert_ac_foliomercantil: {
        type: DataTypes.STRING(45),
        allowNull: true
      },
      cert_ac_finscripcion: {
        type: DataTypes.DATEONLY,
        allowNull: true
      },
      cert_ac_lugarinscripcion: {
        type: DataTypes.STRING(150),
        allowNull: true
      },
      cert_ac_vigencia: {
        type: DataTypes.STRING(45),
        allowNull: true
      },
      cert_ac_capitalinicial: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      cert_ac_capitalactual: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      cert_ac_protocolizaciones: {
        type: DataTypes.STRING(150),
        allowNull: true
      },
      cert_ef_dictamen: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cert_ef_cmon_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cert_ef_tipoexpresado: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      usu_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      emp_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      ctcer_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cert_fechainicio: {
        type: DataTypes.DATEONLY,
        allowNull: true
      },
      cert_file: {
        type: DataTypes.STRING(250),
        allowNull: true
      },
      cert_status: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cert_update: {
        type: DataTypes.DATE,
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'certificacion',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'idcertificacion' }
          ]
        }
      ]
    })
    return Certificacion
  }
}
