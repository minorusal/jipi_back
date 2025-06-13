const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return CatTipoCertificacion.init(sequelize, DataTypes)
}

class CatTipoCertificacion extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      ctcer_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      ctcer_desc_esp: {
        type: DataTypes.STRING(250),
        allowNull: true
      },
      ctcer_desc_ing: {
        type: DataTypes.STRING(250),
        allowNull: true
      },
      ctcer_tit_esp: {
        type: DataTypes.STRING(150),
        allowNull: true
      },
      ctcer_tit_ing: {
        type: DataTypes.STRING(150),
        allowNull: true
      },
      ctcer_precio: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      cmon_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      ctcer_status: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      ctcer_update: {
        type: DataTypes.DATE,
        allowNull: true
      },
      cter_tipo: {
        type: DataTypes.INTEGER,
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'cat_tipo_certificacion',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'ctcer_id' }
          ]
        }
      ]
    })
    return CatTipoCertificacion
  }
}
