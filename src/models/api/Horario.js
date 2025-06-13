const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return Horario.init(sequelize, DataTypes)
}

class Horario extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      horario_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      emp_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'empresa',
          key: 'emp_id'
        }
      },
      lunes_apertura: {
        type: DataTypes.STRING(5),
        allowNull: true
      },
      lunes_cierre: {
        type: DataTypes.STRING(5),
        allowNull: true
      },
      martes_apertura: {
        type: DataTypes.STRING(5),
        allowNull: true
      },
      martes_cierre: {
        type: DataTypes.STRING(5),
        allowNull: true
      },
      miercoles_apertura: {
        type: DataTypes.STRING(5),
        allowNull: true
      },
      miercoles_cierre: {
        type: DataTypes.STRING(5),
        allowNull: true
      },
      jueves_apertura: {
        type: DataTypes.STRING(5),
        allowNull: true
      },
      jueves_cierre: {
        type: DataTypes.STRING(5),
        allowNull: true
      },
      viernes_apertura: {
        type: DataTypes.STRING(5),
        allowNull: true
      },
      viernes_cierre: {
        type: DataTypes.STRING(5),
        allowNull: true
      },
      sabado_apertura: {
        type: DataTypes.STRING(5),
        allowNull: true
      },
      sabado_cierre: {
        type: DataTypes.STRING(5),
        allowNull: true
      },
      domingo_apertura: {
        type: DataTypes.STRING(5),
        allowNull: true
      },
      domingo_cierre: {
        type: DataTypes.STRING(5),
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'horario',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'horario_id' }
          ]
        },
        {
          name: 'fk_horario_empresa_idx',
          using: 'BTREE',
          fields: [
            { name: 'emp_id' }
          ]
        }
      ]
    })
    return Horario
  }
}
