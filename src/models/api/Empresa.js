const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return Empresa.init(sequelize, DataTypes)
}

class Empresa extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      emp_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      cin_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      emp_nombre: {
        type: DataTypes.STRING(200),
        allowNull: false
      },
      emp_razon_social: {
        type: DataTypes.STRING(200),
        allowNull: false,
        defaultValue: 'S.A. DE C.V.'
      },
      emp_rfc: {
        type: DataTypes.STRING(50),
        allowNull: false
      },
      emp_website: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      emp_phone: {
        type: DataTypes.STRING(25),
        allowNull: true
      },
      emp_logo: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      emp_banner: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      emp_video: {
        type: DataTypes.STRING(200),
        allowNull: true
      },
      emp_ventas_gob: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      emp_ventas_credito: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      emp_ventas_contado: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      emp_loc: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      emp_nac: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      emp_int: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      emp_exportacion: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      emp_credito: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      emp_certificada: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
      emp_empleados: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 1
      },
      emp_status: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
      emp_fecha_fundacion: {
        type: DataTypes.DATE,
        allowNull: true
      },
      emp_fecha_creacion: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
      },
      emp_update: {
        type: DataTypes.DATE,
        allowNull: true
      },
      emp_marcas: {
        type: DataTypes.STRING(5000),
        allowNull: true
      },
      reg_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      }
    }, {
      sequelize,
      tableName: 'empresa',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'emp_id' }
          ]
        }
      ]
    })
    return Empresa
  }
}
