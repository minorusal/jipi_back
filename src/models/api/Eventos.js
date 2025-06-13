const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return Eventos.init(sequelize, DataTypes)
}

class Eventos extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      evento_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      nombre: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      alias: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      descripcion: {
        type: DataTypes.STRING(500),
        allowNull: false
      },
      host_usuario: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      host_empresa: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      privacidad: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      capacidad: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      direccion: {
        type: DataTypes.STRING(5000),
        allowNull: false
      },
      google_id: {
        type: DataTypes.STRING(5000),
        allowNull: false
      },
      imagen: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      fecha_creacion: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
      },
      fecha_actualizacion: {
        type: DataTypes.DATE,
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'eventos',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'evento_id' }
          ]
        }
      ]
    })
    return Eventos
  }
}
