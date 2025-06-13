const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return CotExperiencia.init(sequelize, DataTypes)
}

class CotExperiencia extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      cot_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      vendedor_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      comprador_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      tiempo: {
        type: DataTypes.FLOAT,
        allowNull: false
      },
      calidad: {
        type: DataTypes.FLOAT,
        allowNull: false
      },
      servicio: {
        type: DataTypes.FLOAT,
        allowNull: false
      },
      comentario: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      estatus: {
        type: DataTypes.ENUM('Activo', 'Inactivo'),
        allowNull: true,
        defaultValue: 'Activo'
      },
      fecha_creacion: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
      }
    }, {
      sequelize,
      tableName: 'cot_experiencia',
      timestamps: false
    })
    return CotExperiencia
  }
}
