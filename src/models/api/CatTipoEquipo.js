const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return CatTipoEquipo.init(sequelize, DataTypes)
}

class CatTipoEquipo extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      cteq_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      cteq_desc_esp: {
        type: DataTypes.STRING(150),
        allowNull: true
      },
      cteq_desc_ing: {
        type: DataTypes.STRING(150),
        allowNull: true
      },
      cteq_status: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      cteq_update: {
        type: DataTypes.DATE,
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'cat_tipo_equipo',
      timestamps: false,
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'cteq_id' }
          ]
        }
      ]
    })
    return CatTipoEquipo
  }
}
