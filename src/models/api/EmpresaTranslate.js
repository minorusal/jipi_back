const Sequelize = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  return EmpresaTranslate.init(sequelize, DataTypes)
}

class EmpresaTranslate extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    super.init({
      emp_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'empresa',
          key: 'emp_id'
        }
      },
      idioma_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'idioma',
          key: 'idioma_id'
        }
      },
      emp_desc: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      emp_lema: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      emp_mision: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      emp_vision: {
        type: DataTypes.TEXT,
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'empresa_translate',
      timestamps: false,
      indexes: [
        {
          name: 'fk_empresa_translate_idioma_idx',
          using: 'BTREE',
          fields: [
            { name: 'idioma_id' }
          ]
        },
        {
          name: 'fk_empresa_translate_empresa_idx',
          using: 'BTREE',
          fields: [
            { name: 'emp_id' }
          ]
        }
      ]
    })
    return EmpresaTranslate
  }
}
