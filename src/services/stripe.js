'use strict'
const debug = require('debug')('old-api:industries-service')
const mysqlLib = require('../lib/db')

class StripeService {
  constructor () {
    
  }

  async guardarPayment(emp_id, hash, producto, descripcion, monto, creditos){
    
      //console.log('Obtener Saldo ', id_emp);
      const queryString = `
      INSERT INTO empresa_creditos_payments ( emp_id, hash, producto, descripcion, monto, creditos, created_at) VALUES ( ${emp_id} , '${hash}', '${producto}', '${descripcion}', ${monto}, ${creditos}, NOW() );
    `;

    console.log(queryString);

    const result = await mysqlLib.query(queryString)
    return result

  }

  async actualizarStatus(hash, estatus){
      
      console.log('Actualizar status ', hash, estatus);
      const queryString = `
        UPDATE empresa_creditos_payments SET estatus = '${estatus}' WHERE hash = '${hash}';
      `;
  
      console.log(queryString);
  
      const result = await mysqlLib.query(queryString)
      return result
  }

  async obtenerPayment(hash){        
    console.log('Obtener Payment ', hash);
    const queryString = `
    SELECT
        emp_id,
        producto,
        descripcion,
        monto,
        creditos,
        estatus
    FROM empresa_creditos_payments WHERE hash = '${hash}';
    `;

    console.log(queryString);

    const result = await mysqlLib.query(queryString)
    return result
  }

 

}



const inst = new StripeService()
Object.freeze(inst)

module.exports = inst
