const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return Usuario.init(sequelize, DataTypes)
}

class Usuario extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      usu_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      usu_nombre: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      usu_app: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      usu_puesto: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      usu_email: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      usu_psw: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      usu_boletin: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      usu_verificado: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      usu_idioma: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      usu_foto: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      usu_card: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      usu_tipo: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '1: vendedor\\n2: comprador'
      },
      usu_status: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      usu_update: {
        type: DataTypes.DATE,
        allowNull: true
      },
      token: {
        type: DataTypes.STRING(15),
        allowNull: true
      },
      reg_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
      }
    }, {
      sequelize,
      tableName: 'usuario',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'usu_id' }
          ]
        }
      ]
    })
    return Usuario
  }
}
