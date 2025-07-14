const { emailjet: { key, secretKey, sender: { from } } } = require('../../config');
const mailjet = require('node-mailjet').apiConnect(key, secretKey);
const mysqlLib = require('../../lib/db');
const solicitudCreditoService = require('../../services/solicitudCredito');
const certificationService = require('../../services/certification');

const sendCompaniEmail = async ({ email, nombre, templateID, empresa, tabla_clientes }) => {
  try {
    if (!email || !templateID || !empresa || !tabla_clientes) {
      throw new Error('Faltan datos obligatorios: email, templateID, empresa o tabla_clientes');
    }

    /*
    console.log('🚀 ===== INICIANDO ENVÍO DE CORREO =====');
    console.log('email', email);
    console.log('nombre', nombre);
    console.log('templateID', templateID);
    console.log('empresa', empresa);
    console.log('tabla_clientes', tabla_clientes);

    */

    //return { success: true, result: null };

    const response = await mailjet
      .post('send', { version: 'v3.1' })
      .request({
        
        Messages: [
          {
            From: {
              Email: 'mkt@credibusiness.site',  
              Name: 'credibusiness'
            },
            To: [
              {
                //Email: email,
                Email: 'jesus.lagunas@credibusiness.com',
                Name: nombre || ''
              }
            ],
            TemplateID: 7148435, //templateID,  
            TemplateLanguage: true,
            Variables: {
              empresa: empresa,
              tabla_clientes: tabla_clientes
            }
          }
        ]
        

        
        
      });

    console.log('Respuesta de Mailjet:');
    console.log(response.body);
    console.log(response);
    
    return { success: true, result: response.body };

  } catch (error) {
    console.error('Error al enviar el correo:', error.message);
    return { success: false, error: error.message };
  }
};

const generateClientTableHTML = (clientes) => {
  if (!clientes || clientes.length === 0) {
    return '<p>No hay clientes que cumplan con las condiciones especificadas.</p>';
  }

  let html = `
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-family: Arial, sans-serif;">
      <thead>
        <tr style="background-color: #f2f2f2;">
          <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">RFC </th>
          <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Razón Social</th>
          <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Fecha Reporte</th>
          <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Línea de Crédito Solicitada</th>
          <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Línea de Crédito Recomendada</th>
        </tr>
      </thead>
      <tbody>
  `;

  clientes.forEach(cliente => {
    html += `
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">${cliente.emp_rfc || 'N/A'}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${cliente.emp_razon_social || 'N/A'}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${formatFechaDMY(cliente.fecha_reporte) || 'N/A'}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${formatMoneda(cliente.linea_credito_solicitada)}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${formatMoneda(cliente.linea_credito_sugerida)}</td>
      </tr>
    `;
  });

  html += `
      </tbody>
    </table>
  `;

  return html;
};

const formatFechaDMY = (fecha) => {
  if (!fecha) return 'N/A';
  const d = new Date(fecha);
  if (isNaN(d)) return fecha;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

const formatMoneda = (valor) => {
  const num = Number(valor) || 0;
  return num.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });
};

const sendCreditReportToProviders = async () => {
  try {
    console.log('🚀 ===== INICIANDO ENVÍO DE REPORTES DE CRÉDITO A PROVEEDORES =====');

    /*
    // 1. Obtener todos los proveedores únicos
    const queryProveedores = `
      SELECT DISTINCT id_proveedor 
      FROM solicitud_credito 
      WHERE id_proveedor IS NOT NULL
      UNION
      SELECT DISTINCT emp_id 
      FROM solicitud_credito_externos 
      WHERE emp_id IS NOT NULL
    `;
    
    const { result: proveedores } = await mysqlLib.query(queryProveedores);
    */

    // Emp_id jesus.lagunas en Producción
    // 127
    // Emp_id jesus.lagunas en QA
    // 694
    const proveedores = [{
      id_proveedor: 127
    }]

    console.log(`📊 Se encontraron ${proveedores.length} proveedores`);

    const resultados = [];    

    // 2. Para cada proveedor, obtener sus clientes y filtrar
    for (const proveedor of proveedores) {
      const idProveedor = proveedor.id_proveedor || proveedor.emp_id;
      console.log(`\n🔍 Procesando proveedor ID: ${idProveedor}`);
      
      try {
        // Obtener clientes del proveedor
        const { result: clientesRaw } = await solicitudCreditoService.getEnviadas(idProveedor);
        console.log(`📋 Total de clientes encontrados: ${clientesRaw.length}`);
        
        // Filtrar clientes según los lineamientos correctos y extraer solo los datos necesarios
        const clientesFiltrados = clientesRaw.filter(cliente => {
          // 1. Evaluado
          const evaluado = cliente.estatus_certificacion &&
                           cliente.estatus_certificacion !== 'cancelada' &&
                           cliente.estatus_certificacion !== 'no registrada';
          
          // 2. Línea sugerida (debe ser mayor que 0)
          const lineaSugeridaNum = parseFloat(cliente.linea_credito_sugerida) || 0;
          const tieneLineaSugerida = lineaSugeridaNum > 0;
          
          // 3. Monto NO confirmado (debe ser 0 o vacío)
          const montoOtorgadoNum = parseFloat(cliente.monto_otorgado) || 0;
          const montoNoConfirmado = montoOtorgadoNum === 0 || montoOtorgadoNum === '0';
          
          // 4. Score diferente de 0
          const scoreNum = parseFloat(cliente.score) || 0;
          const tieneScore = scoreNum !== 0;
          
          const cumple = evaluado && tieneLineaSugerida && montoNoConfirmado && tieneScore;
          console.log(`   [FILTRO] RFC: ${cliente.emp_rfc || 'N/A'} | Evaluado: ${evaluado} | Línea sugerida: ${tieneLineaSugerida} (valor: ${cliente.linea_credito_sugerida}) | Monto no confirmado: ${montoNoConfirmado} (valor: ${cliente.monto_otorgado}) | Score: ${tieneScore} (valor: ${cliente.score}) => Cumple: ${cumple}`);
          return cumple;
        }).map(cliente => ({
          // Solo extraer los campos que necesitamos
          emp_rfc: cliente.emp_rfc,
          emp_razon_social: cliente.emp_razon_social,
          fecha_reporte: cliente.fecha_reporte,
          linea_credito_solicitada: cliente.linea_credito_solicitada,
          linea_credito_sugerida: cliente.linea_credito_sugerida
        }));
        if (clientesFiltrados.length === 0) {
          console.log('   ⚠️  Ningún cliente cumple las condiciones. Datos de clientes encontrados:', JSON.stringify(clientesRaw, null, 2));
        }

        console.log(`   ✅ Clientes que cumplen condiciones: ${clientesFiltrados.length}`);

        if (clientesFiltrados.length > 0) {
          // Mostrar detalles de los clientes filtrados
          console.log(`   📝 Detalles de clientes filtrados:`);
          clientesFiltrados.forEach((cliente, index) => {
            console.log(`${index + 1}. RFC: ${cliente.emp_rfc || 'N/A'}`);
            console.log(`Razón Social: ${cliente.emp_razon_social || 'N/A'}`);
            console.log(`Línea Sugerida: $${cliente.linea_credito_sugerida || '0'}`);
            console.log(`Monto Otorgado: $${cliente.monto_otorgado || '0'}`);
            console.log(`Score: ${cliente.score || '0'}`);
            console.log(`Estatus: ${cliente.estatus_certificacion || 'N/A'}`);
          });

          // Obtener correo del proveedor usando el método específico y eficiente
          const [proveedorData] = await certificationService.getEmailProveedorByIdProveedor(idProveedor);
          console.log(`   [DEPURACIÓN] Resultado de getEmailProveedorByIdProveedor:`, JSON.stringify(proveedorData, null, 2));
          
          if (!proveedorData || !proveedorData.email_proveedor) {
            console.log(`   ⚠️  Proveedor ${idProveedor} omitido: sin email registrado.`);
            continue;
          }
          
          const emailProveedor = proveedorData.email_proveedor;
          const nombreProveedor = proveedorData.empresa_proveedor || 'Proveedor';
          
          console.log(`   📧 Email del proveedor: ${emailProveedor}`);
          console.log(`   👤 Nombre del proveedor: ${nombreProveedor}`);
          
          // Generar tabla HTML
          const tablaClientes = generateClientTableHTML(clientesFiltrados);
          console.log(`   📊 Tabla HTML generada con ${clientesFiltrados.length} filas`);
          
          // Log detallado de cada cliente que se enviará
          console.log(`   📋 === CLIENTES A ENVIAR ===`);
          clientesFiltrados.forEach((cliente, index) => {
            console.log(`   📄 Cliente ${index + 1}:`);
            console.log(`      - RFC: ${cliente.emp_rfc || 'N/A'}`);
            console.log(`      - Razón Social: ${cliente.emp_razon_social || 'N/A'}`);
            console.log(`      - Fecha del Reporte: ${cliente.fecha_reporte || 'N/A'}`);
            console.log(`      - Línea de Crédito Solicitada: $${cliente.linea_credito_solicitada || '0'}`);
            console.log(`      - Línea de Crédito Recomendada: $${cliente.linea_credito_sugerida || '0'}`);
            console.log(`   `);
          });
          
          // Enviar correo
          console.log(`   📤 Enviando correo...`);
          console.log(`   📧 Detalles del envío:`);
          console.log(`      - Destinatario: ${emailProveedor}`);
          console.log(`      - Nombre: ${nombreProveedor}`);
          console.log(`      - Template ID: 6967845`);
          console.log(`      - Clientes incluidos: ${clientesFiltrados.length}`);
          
          const resultadoEnvio = await sendCompaniEmail({
            email: emailProveedor,
            nombre: nombreProveedor,
            templateID: 7148435,
            empresa: nombreProveedor,
            tabla_clientes: tablaClientes
          });
          
          console.log(`   ✅ Respuesta de Mailjet:`, JSON.stringify(resultadoEnvio, null, 2));
          
          if (resultadoEnvio && resultadoEnvio.Messages && resultadoEnvio.Messages[0]) {
            const messageInfo = resultadoEnvio.Messages[0];
            console.log(`   📊 Información del mensaje:`);
            console.log(`      - Message ID: ${messageInfo.To[0]?.MessageID || 'N/A'}`);
            console.log(`      - Status: ${messageInfo.To[0]?.Status || 'N/A'}`);
            console.log(`      - Error Code: ${messageInfo.To[0]?.ErrorCode || 'N/A'}`);
            console.log(`      - Error Message: ${messageInfo.To[0]?.ErrorMessage || 'N/A'}`);
          }
          
          if (resultadoEnvio.success) {
            console.log(`   ✅ Correo enviado exitosamente`);
            resultados.push({
              proveedor_id: idProveedor,
              empresa_proveedor: nombreProveedor,
              email: emailProveedor,
              clientes_enviados: clientesFiltrados.length,
              status: 'enviado'
            });
          } else {
            console.log(`   ❌ Error al enviar correo: ${resultadoEnvio.error}`);
            resultados.push({
              proveedor_id: idProveedor,
              empresa_proveedor: nombreProveedor,
              email: emailProveedor,
              clientes_enviados: clientesFiltrados.length,
              status: 'error',
              error: resultadoEnvio.error
            });
          }
        } else {
          console.log(`   ⚠️  No hay clientes que cumplan las condiciones`);
          resultados.push({
            proveedor_id: idProveedor,
            empresa_proveedor: 'No encontrada',
            email: 'No encontrado',
            clientes_enviados: 0,
            status: 'sin_clientes'
          });
        }
      } catch (error) {
        console.error(`   💥 Error procesando proveedor ${idProveedor}:`, error.message);
        resultados.push({
          proveedor_id: idProveedor,
          empresa_proveedor: 'Error',
          email: 'Error',
          clientes_enviados: 0,
          status: 'error',
          error: error.message
        });
      }
    }

    // Resumen final
    console.log('\n📊 ===== RESUMEN FINAL =====');
    const enviados = resultados.filter(r => r.status === 'enviado').length;
    const errores = resultados.filter(r => r.status === 'error').length;
    const sinClientes = resultados.filter(r => r.status === 'sin_clientes').length;
    
    console.log(`✅ Correos enviados exitosamente: ${enviados}`);
    console.log(`❌ Errores en envío: ${errores}`);
    console.log(`⚠️  Proveedores sin clientes válidos: ${sinClientes}`);
    console.log(`📧 Total de proveedores procesados: ${proveedores.length}`);
    
    // Log detallado de todos los correos enviados
    if (enviados > 0) {
      console.log(`\n📬 === CORREOS ENVIADOS EXITOSAMENTE ===`);
      resultados.filter(r => r.status === 'enviado').forEach((resultado, index) => {
        console.log(`${index + 1}. Proveedor ID: ${resultado.proveedor_id}`);
        console.log(`   - Empresa: ${resultado.empresa_proveedor}`);
        console.log(`   - Email: ${resultado.email}`);
        console.log(`   - Clientes enviados: ${resultado.clientes_enviados}`);
        console.log(`   - Status: ${resultado.status}`);
        console.log(``);
      });
    }
    
    // Log detallado de errores
    if (errores > 0) {
      console.log(`\n❌ === ERRORES EN ENVÍO ===`);
      resultados.filter(r => r.status === 'error').forEach((resultado, index) => {
        console.log(`${index + 1}. Proveedor ID: ${resultado.proveedor_id}`);
        console.log(`   - Empresa: ${resultado.empresa_proveedor}`);
        console.log(`   - Email: ${resultado.email}`);
        console.log(`   - Error: ${resultado.error}`);
        console.log(``);
      });
    }
    
    // Log de proveedores sin clientes
    /*if (sinClientes > 0) {
      console.log(`\n⚠️  === PROVEEDORES SIN CLIENTES VÁLIDOS ===`);
      resultados.filter(r => r.status === 'sin_clientes').forEach((resultado, index) => {
        console.log(`${index + 1}. Proveedor ID: ${resultado.proveedor_id}`);
        console.log(`   - Empresa: ${resultado.empresa_proveedor}`);
        console.log(`   - Email: ${resultado.email}`);
        console.log(``);
      });
    }*/
    
    return {
      success: true,
      total_proveedores: resultados.length,
      enviados: enviados,
      errores: errores,
      sin_clientes: sinClientes,
      resultados: resultados
    };

  } catch (error) {
    console.error('💥 Error general en sendCreditReportToProviders:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = { 
  sendCompaniEmail,
  sendCreditReportToProviders,
  generateClientTableHTML
};
