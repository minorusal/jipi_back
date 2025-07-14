const cron = require('node-cron')
const logger = require('../../utils/logs/logger')
const konesh = require('../../services/konesh')
const cipher = require('../../utils/cipherService')
const axios = require('axios')
const { globalAuth: { keyCipher } } = require('../../config')
const certificationService = require('../../services/certification')
const utilitiesService = require('../../services/utilities')
const authService = require('../../services/auth')
const solicitudCreditoService = require('../../services/solicitudCredito')
const { emailjet: { key, secretKey, sender: { from } } } = require('../../config')
const mailjet = require('node-mailjet').apiConnect(key, secretKey)
const nodemailer = require('nodemailer')
const { sendCreditReportToProviders } = require('./mailjet-controler')


const currentDate = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const seconds = String(now.getSeconds()).padStart(2, '0')
    const milliseconds = String(now.getMilliseconds()).padStart(3, '0')
    const current_date = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}:${milliseconds}`
    return current_date
}

const calcularDiferenciaHoras = (fechaInicio, fechaFin) => {
    const MS_POR_HORA = 1000 * 60 * 60
    const inicio = new Date(fechaInicio)
    const fin = new Date(fechaFin)
    if (isNaN(inicio) || isNaN(fin)) {
        throw new Error('Fechas inválidas')
    }
    const diferenciaMs = fin - inicio
    const diferenciaHoras = diferenciaMs / MS_POR_HORA
    return diferenciaHoras.toFixed(2)
}

const esperar = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const enviaCorreoReferenciasExternas = async () => {
  const fileMethod = `file: src/controllers/api/cron.js - method: enviaCorreoReferenciasExternas (refactored)`;
  logger.info(`${fileMethod} | Iniciando job de recordatorios para referencias comerciales.`);

  try {
    const referenciasParaRecordatorio = await certificationService.getReferenciasParaRecordatorio();

    if (!referenciasParaRecordatorio || referenciasParaRecordatorio.length === 0) {
      logger.info(`${fileMethod} | No hay referencias comerciales que necesiten un recordatorio en este momento.`);
      return;
    }

    logger.info(`${fileMethod} | Se encontraron ${referenciasParaRecordatorio.length} referencias para procesar.`);

    for (const referencia of referenciasParaRecordatorio) {
      try {
        // Validar que el ID de referencia existe y es válido
        if (!referencia.id_certification_referencia_comercial) {
          logger.warn(`${fileMethod} | Referencia sin ID válido: ${JSON.stringify(referencia)}. Saltando.`);
          continue;
        }
        
        const contactos = await certificationService.getContactos(referencia.id_certification_referencia_comercial);
        if (!contactos || contactos.length === 0) {
          logger.info(`${fileMethod} | No se encontraron contactos para la referencia ${referencia.id_certification_referencia_comercial}. Saltando.`);
          continue;
        }

        // Validar que el ID de certificación existe
        if (!referencia.id_certification) {
          logger.warn(`${fileMethod} | Referencia sin ID de certificación válido: ${JSON.stringify(referencia)}. Saltando.`);
          continue;
        }
        
        const informacion_hash = await certificationService.obtenerUltimoHashCertification(referencia.id_certification);
        if (!informacion_hash) {
            logger.warn(`${fileMethod} | No se encontró hash para la certificación: ${referencia.id_certification}. Saltando referencia.`);
            continue;
        }
        
        const { hash, emp_id, id_empresa_cliente_contacto } = informacion_hash;
        
        // Validar que los datos del hash son válidos
        if (!hash || !emp_id || !id_empresa_cliente_contacto) {
          logger.warn(`${fileMethod} | Datos de hash incompletos para certificación ${referencia.id_certification}: ${JSON.stringify(informacion_hash)}. Saltando.`);
          continue;
        }
        const globalConfig = await utilitiesService.getParametros();
        const urlConfig = globalConfig.find(item => item.nombre === 'url_credibusiness_web');
        if (!urlConfig || !urlConfig.valor) {
          logger.warn(`${fileMethod} | No se encontró configuración de URL para credibusiness_web. Saltando referencia.`);
          continue;
        }
        const url_credibusiness_web = urlConfig.valor;
        const link = `${url_credibusiness_web}/#/referencias-comerciales?hash=${hash}`;
        
        const [empresa] = await certificationService.getCompanyByID(emp_id);
        const [empresa_envia] = await certificationService.getCompanyByID(id_empresa_cliente_contacto);


        for (const contacto of contactos) {
          const ahora = new Date();
          const fechaUltimoRecordatorio = contacto.fecha_ultimo_recordatorio ? new Date(contacto.fecha_ultimo_recordatorio) : null;
          
          if (fechaUltimoRecordatorio && (ahora - fechaUltimoRecordatorio) < (12 * 60 * 60 * 1000)) {
            logger.info(`${fileMethod} | Contacto ${contacto.id_certification_contacto} ya recibió un recordatorio en las últimas 12 horas. Saltando.`);
            continue;
          }

          const regex_email = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
          if (!regex_email.test(contacto.correo_contacto)) {
              logger.warn(`${fileMethod} | El correo del contacto ${contacto.id_certification_contacto} no es válido. Saltando.`);
              continue;
          }

          logger.info(`${fileMethod} | Enviando recordatorio al contacto ${contacto.id_certification_contacto} (${contacto.correo_contacto})`);

          const request_email = {
              Messages: [{
                  From: { Email: 'mkt@credibusiness.site', Name: 'credibusiness' },
                  To: [{ Email: contacto.correo_contacto, Name: contacto.nombre_contacto }],
                  TemplateID: 6279989, // ID de la plantilla de recordatorio
                  TemplateLanguage: true,
                  Variables: {
                      link: link,
                      empresa: empresa?.empresa_nombre || '',
                      empresa_envia: empresa_envia?.empresa_nombre || ''
                  }
              }]
          };

          const envio_email = await mailjet.post('send', { version: 'v3.1' }).request(request_email);
          logger.info(`${fileMethod} | Respuesta de Mailjet para contacto ${contacto.id_certification_contacto}: ${JSON.stringify(envio_email.body)}`);

          await certificationService.updateFechaRecordatorio(contacto.id_certification_contacto);
        }
      } catch (error) {
        logger.error(`${fileMethod} | Error procesando la referencia ${referencia.id_certification_referencia_comercial}: ${error.message} - ${error.stack}`);
        // Continuamos con la siguiente referencia
      }
    }
  } catch (error) {
    logger.error(`${fileMethod} | Error fatal en el job de recordatorios: ${error.message} - ${error.stack}`);
  }
}

const enviarEmailRegistrosSemanal = async (registros, total_registros) => {
    const fileMethod = `file: src/controllers/api/certification.js - method: enviarEmailRegistrosSemanal`
    try {
        logger.info(`${fileMethod}`)

        const globalConfig = await utilitiesService.getParametros()
        let correos_reporte_semanal = await globalConfig.find(item => item.nombre === 'correos_reporte_semanal').valor
        correos_reporte_semanal = JSON.parse(correos_reporte_semanal);
        let email_sender_encuesta = await globalConfig.find(item => item.nombre === 'email_sender_encuesta').valor
        let password_email_sender_encuesta = await globalConfig.find(item => item.nombre === 'password_email_sender_encuesta').valor
        
        const transporter = nodemailer.createTransport({
          host: 'credibusiness.com',
          port: 465,
          secure: true,
          auth: {
            user: email_sender_encuesta,
            pass: password_email_sender_encuesta
          }
        })
    
        const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Reporte de Nuevos Usuarios</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      color: #333;
      background-color: #f9f9f9;
      padding: 20px;
    }
    .container {
      background-color: #ffffff;
      border: 1px solid #ddd;
      border-radius: 5px;
      padding: 20px;
      max-width: 600px;
      margin: auto;
    }
    h2 {
      color: #2c3e50;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
    }
    th, td {
      padding: 10px;
      text-align: left;
    }
    thead th {
      background-color: #2c3e50;
      color: #ffffff;
    }
    tbody tr:nth-child(even) {
      background-color: #f2f2f2;
    }
    tbody tr:nth-child(odd) {
      background-color: #ffffff;
    }
    .summary {
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h2>📊 Reporte Semanal de Nuevos Usuarios</h2>
    <div class="summary">
      <p><strong>Total de registrados en la semana:</strong> ${registros.length}</p>
      <p><strong>Acumulado desde que empezamos:</strong> ${total_registros[0].total_registros}</p>
    </div>
    <table>
      <thead>
        <tr>
          <th>RFC</th>
          <th>Nombre</th>
          <th>Tipo</th>
        </tr>
      </thead>
      <tbody>
        ${registros.map((registro) => {
          return `
            <tr>
              <td>${registro.emp_rfc}</td>
              <td>${registro.emp_nombre}</td>
              <td>${registro.tipo}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  </div>
</body>
</html>
        `

        const envLabel = process.env.NODE_ENV === 'production' ? 'Productivo' : 'Desarrollo'
        const mailOptions = {
          from: `"credibusiness" <${email_sender_encuesta}>`,
          to: correos_reporte_semanal,
          subject: `[${envLabel}] Resumen semanal de nuevos registros`,
          html: htmlContent
        }

        const info = await transporter.sendMail(mailOptions)
        logger.info(info)
        console.log({info})
        return info
    } catch (error) {
        logger.error(`${error}`)
        console.log(error)
    }
}

const enviarEmailSaldoEmpresas = async (saldo_empresas) => {
  const fileMethod = `file: src/controllers/api/certification.js - method: enviarEmailSaldoEmpresas`
  try {
        logger.info(`${fileMethod}`)
        const globalConfig = await utilitiesService.getParametros()
        let correos_reporte_semanal = await globalConfig.find(item => item.nombre === 'correos_reporte_semanal').valor
        correos_reporte_semanal = JSON.parse(correos_reporte_semanal);
        let email_sender_encuesta = await globalConfig.find(item => item.nombre === 'email_sender_encuesta').valor
        let password_email_sender_encuesta = await globalConfig.find(item => item.nombre === 'password_email_sender_encuesta').valor
        
        const transporter = nodemailer.createTransport({
          host: 'credibusiness.com',
          port: 465,
          secure: true,
          auth: {
            user: email_sender_encuesta,
            pass: password_email_sender_encuesta
          }
        })
    
        const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Reporte de Consumo de Folios</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      color: #333;
      background-color: #f9f9f9;
      padding: 20px;
    }
    .container {
      background-color: #ffffff;
      border: 1px solid #ddd;
      border-radius: 5px;
      padding: 20px;
      max-width: 600px;
      margin: auto;
    }
    h2 {
      color: #2c3e50;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
    }
    th, td {
      padding: 10px;
      text-align: left;
    }
    thead th {
      background-color: #2c3e50;
      color: #ffffff;
    }
    tbody tr:nth-child(even) {
      background-color: #f2f2f2;
    }
    tbody tr:nth-child(odd) {
      background-color: #ffffff;
    }
    .summary {
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h2>📊 Reporte Semanal de Consumo de Folios</h2>
    <table>
      <thead>
        <tr>
          <th>Empresa</th>
          <th>Saldo disponible</th>
          <th>Consumo de saldo total</th>
        </tr>
      </thead>
      <tbody>
        ${saldo_empresas.map((empresa) => {
          return `
            <tr>
              <td>${empresa.empresa}</td>
              <td>${empresa.saldo_disponible}</td>
              <td>${empresa.saldo_consumido}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  </div>
</body>
</html>
        `
        const envLabel = process.env.NODE_ENV === 'production' ? 'Productivo' : 'Desarrollo'
        const mailOptions = {
          from: `"credibusiness" <${email_sender_encuesta}>`,
          to: correos_reporte_semanal,
          subject: `[${envLabel}] Resumen semanal de consumo de folios`,
          html: htmlContent
        }

        const info = await transporter.sendMail(mailOptions)
        logger.info(info)
        console.log({info})
        return info
    } catch (error) {
        logger.error(`${error}`)
        console.log(error)
    }
}

const startCronJobs = () => {
    const fileMethod = `file: src/controllers/api/cron.js - method: startCronJobs`
    logger.info(`${fileMethod} | Iniciando cron jobs`)

    // Cron job para enviar recordatorios de referencias comerciales (cada hora)
    cron.schedule('0 * * * *', async () => {
        logger.info(`${fileMethod} | CRON: Iniciando job de recordatorios para referencias comerciales...`);
        try {
            await enviaCorreoReferenciasExternas();
            logger.info(`${fileMethod} | CRON: Job de recordatorios para referencias comerciales finalizado.`);
        } catch (error) {
            logger.error(`${fileMethod} | CRON: Error en el job de recordatorios para referencias comerciales: ${error.message} - ${error.stack}`);
        }
    });

    cron.schedule('30 3 * * *', async () => {
        try {
            const regex = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/
            const rfcs = await konesh.getEmpresas()
            if (rfcs.length) {
                for (let rfc of rfcs) {
                    if (regex.test(rfc.emp_rfc)) {
                        const resquest = {
                            rfc: rfc.emp_rfc
                        }
                        logger.info(`Request ${JSON.stringify(resquest)}`)
                        const resquestCript = await cipher.encryptData(
                            JSON.stringify(resquest),
                            keyCipher
                        )
                        logger.info(`Request Cifrada ${JSON.stringify(resquestCript)}`)
                        const headers = { "Content-Type": "text/plain" }
                        // const konesh_api = await axios.post(
                        //     'http://localhost:3000/api/konesh/ValidaListaService', resquestCript,
                        //     {
                        //         headers: headers,
                        //         responseType: 'text'
                        //     }
                        // )
                        // logger.info(`Cron ejecutandose ${await cipher.decryptData(konesh_api, keyCipher)}`)
                        //logger.info(`Cron ejecutandose ${konesh_api.data}`)
                    }
                }
            }
        } catch (error) {
            logger.info(`Error en la solicitud HTTP: ${JSON.stringify(error)}`)
        }
    })

    cron.schedule('* * * * *', async () => {
        try {
            logger.info('Cron que actualiza estatus de email con mailjet')
            const globalConfig = await utilitiesService.getParametros()
            const ids_message_queued = await certificationService.consultaEstatusQueued()
            logger.info(`Id's obtenidos con estatus queued: ${JSON.stringify(ids_message_queued)}`)

            if (ids_message_queued.length) {
                for (const id_message_queued of ids_message_queued) {
                    const id_message = id_message_queued.id_email
                    const url_consulta_estatus_mailjet = await globalConfig.find(item => item.nombre === 'url_consulta_estatus_mailjet').valor
                    const response_status_mailjet = await axios.get(`${url_consulta_estatus_mailjet}${id_message}`, {
                        auth: {
                            username: key,
                            password: secretKey
                        }
                    })
                    const result_estatus_envio = response_status_mailjet.data
                    const consulta_estatus_envio = result_estatus_envio.Data[0].Status
                    logger.info(`Respuesta de estatus de mailjet del id ${id_message}: ${JSON.stringify(result_estatus_envio)}`)
                    await certificationService.actualizaEstatusContactoMailjet(id_message, consulta_estatus_envio)
                }
            }

        } catch (error) {
            logger.error(`Error en el cron 2: ${JSON.stringify(error)}`)
        }
    })


    cron.schedule('0 * * * *', async () => {
        try {
            const globalConfig = await utilitiesService.getParametros()
            logger.info('Cron que realiza reenvio de correo a referencias comerciales')

            const referencias_comerciales = await certificationService.obtieneReferenciasComercialesNoContestadas()
            logger.info(`Referencias comerciales no contestadas, se valida que el id_certification este vigente en estatus inicial y que el campo contestada de la referencia sea no: ${JSON.stringify(referencias_comerciales)}`)

            const horas_maximo_reenvio_referencias = await globalConfig.find(item => item.nombre === 'horas_maximo_reenvio_referencias').valor
            const horas_recordatorio_reenvio_referencias = await globalConfig.find(item => item.nombre === 'horas_recordatorio_reenvio_referencias').valor

            for (const referencia_comercial of referencias_comerciales) {
                const contactos_referencia_comercial = await certificationService.obtieneContactosReferenciaComercialSent(referencia_comercial.id_certification_referencia_comercial)
                logger.info(`Contactos pertenecientes a la referencia comercial con ID: ${referencia_comercial.id_certification_referencia_comercial} con estatus sent: ${JSON.stringify(contactos_referencia_comercial)}`)
                if (contactos_referencia_comercial.length > 0) {
                    logger.info(`Contactos pertenecientes a la referencia comercial con ID: ${referencia_comercial.id_certification_referencia_comercial} con estatus sent: ${JSON.stringify(contactos_referencia_comercial)}`)
                }
                for (const contacto_referencia_comercial of contactos_referencia_comercial) {
                    logger.info(`Contactos de Referencias comerciales con estatus sent: ${JSON.stringify(contacto_referencia_comercial)}`)

                    let fecha_actual = new Date(currentDate())
                    let fecha_envio_email = new Date(contacto_referencia_comercial.fecha_envio_email)
                    let fecha_reenvio_email = contacto_referencia_comercial.fecha_reenvio_email
                        ? new Date(contacto_referencia_comercial.fecha_reenvio_email)
                        : null

                    logger.info(`Inicia validacion de fechas para calculo de horas: ${JSON.stringify(contacto_referencia_comercial)}`)
                    logger.info(`Fecha actual ${fecha_actual}, Fecha de envio de email: ${fecha_envio_email}, Fecha de reenvio de email: ${fecha_reenvio_email}`)

                    const diferencia_horas_envio_email = calcularDiferenciaHoras(fecha_envio_email, fecha_actual)
                    const diferencia_horas_reenvio_email = fecha_reenvio_email ? calcularDiferenciaHoras(fecha_reenvio_email, fecha_actual) : null

                    logger.info(`Horas desde el primer envío: ${diferencia_horas_envio_email}`)
                    if (fecha_reenvio_email) {
                        logger.info(`Horas desde el último reenvío: ${diferencia_horas_reenvio_email}`)
                    }

                    if (diferencia_horas_envio_email >= horas_maximo_reenvio_referencias) {
                        logger.info(`Reenvío no permitido: ya pasaron ${horas_maximo_reenvio_referencias} horas desde el primer envío.`)
                        continue
                    }

                    // Primer reenvío (si aún no hay reenvío)
                    if (!fecha_reenvio_email && diferencia_horas_envio_email >= horas_recordatorio_reenvio_referencias) {
                        logger.info(`Primer reenvío: han pasado al menos ${horas_recordatorio_reenvio_referencias} horas desde el envío inicial.`)
                        await enviaCorreoReferenciasExternas(referencia_comercial.id_certification_referencia_comercial, contacto_referencia_comercial)
                        continue
                    }

                    // Reenvíos continuos
                    if (fecha_reenvio_email && diferencia_horas_reenvio_email >= horas_recordatorio_reenvio_referencias) {
                        logger.info(`Reenvío continuo: han pasado al menos ${horas_recordatorio_reenvio_referencias} horas desde el último reenvío.`)
                        await enviaCorreoReferenciasExternas(referencia_comercial.id_certification_referencia_comercial, contacto_referencia_comercial)
                        continue
                    }
                }
            }
        } catch (error) {
            logger.error(`Error en el cron 2: ${JSON.stringify(error)}`)
        }
    })

    // Cron diario que marca como vencidas las referencias comerciales contestadas
    cron.schedule('0 2 * * *', async () => {
        try {
            logger.info('[CRON] Referencias comerciales vencidas: inicio de ejecución')

            // Paso 1: Obtener la variable del sistema para días de vigencia
            const globalConfig = await utilitiesService.getParametros()
            const diasVigencia = await globalConfig.find(item => item.nombre === 'dias_vigencia_rferencia_comercial').valor

            // Paso 2: Buscar referencias con más de X días desde su actualización
            const referenciasVencidas = await certificationService.getReferenciasContestadasVencidas(diasVigencia)

            // Paso 3: Marcar referencias vencidas en la tabla externa
            for (const ref of referenciasVencidas) {
                await certificationService.actualizarEstatusReferenciaExternaVencida(ref.id_certification_referencia_comercial)
            }

            logger.info(`[CRON] Total actualizadas: ${referenciasVencidas.length}`)
        } catch (error) {
            logger.error(`[CRON] Error al actualizar referencias comerciales vencidas: ${JSON.stringify(error)}`)
        }
    })

    // Nota: La libreria de cron no sabe que en México se quitó el horario de verano
    cron.schedule('0 18 * * 5', async () => {
        try {
            logger.info('Cron que envia correo de estadisticas de nuevos registros semanales')
            const registros = await authService.getNuevosRegistrosSemanal();
            const total_registros = await authService.getTotalRegistros();
            await enviarEmailRegistrosSemanal(registros, total_registros);
        } catch (error) {
            logger.error(`Error en el cron que envia correo de estadisticas de nuevos registros semanales: ${JSON.stringify(error)}`)
        }
    },
    {
      scheduled: true,
      timezone: 'America/Mexico_City',
    })

    // cron.schedule('* * * * *', async () => {
    //     try {
    //         const globalConfig = await utilitiesService.getParametros()
    //         logger.info('Inicia proceso ')
    //     } catch (error) {
    //         logger.error(`Error en el cron que verifica los días que tarda una referencia comercial : ${JSON.stringify(error)}`)
    //     }
    // })

    // TODO: Pendiente de liberar a Producción
    // Cron job para enviar lista de clientes pendientes a proveedores con lógica de periodicidad
    // Cada lunes durante el primer mes, luego solo el primer lunes de cada mes
    /*
    cron.schedule('0 9 * * 1', async () => { // Ejecuta todos los lunes a las 9:00 AM
        const fileMethod = `file: src/controllers/api/cron.js - CRON: sendCreditReportToProviders`;
        
        try {
            // Obtener fecha de activación del sistema (guardar en BD o config)
            const globalConfig = await utilitiesService.getParametros();
            let fechaActivacion = await globalConfig.find(item => item.nombre === 'fecha_activacion_creditos_pendientes');
            
            // Si no existe la fecha de activación, crearla ahora
            if (!fechaActivacion) {
                const fechaActual = new Date();
                // Aquí deberías guardar la fecha en la BD, por ahora usamos la fecha actual
                logger.info(`${fileMethod} | Primera ejecución - estableciendo fecha de activación: ${fechaActual.toISOString()}`);
                fechaActivacion = { valor: fechaActual.toISOString() };
            }
            
            const fechaActivacionDate = new Date(fechaActivacion.valor);
            const fechaActual = new Date();
            
            // Calcular diferencia en meses
            const mesesTranscurridos = (fechaActual.getFullYear() - fechaActivacionDate.getFullYear()) * 12 + 
                                     (fechaActual.getMonth() - fechaActivacionDate.getMonth());
            
            // Verificar si es el primer lunes del mes (después del primer mes)
            const esPrimerLunesDelMes = fechaActual.getDate() <= 7;
            
            // Lógica de ejecución
            let debeEjecutar = false;
            
            if (mesesTranscurridos < 1) {
                // Primer mes: ejecutar todos los lunes
                debeEjecutar = true;
                logger.info(`${fileMethod} | Primer mes - ejecutando (mes ${mesesTranscurridos + 1})`);
            } else if (esPrimerLunesDelMes) {
                // Después del primer mes: solo el primer lunes
                debeEjecutar = true;
                logger.info(`${fileMethod} | Después del primer mes - ejecutando primer lunes del mes`);
            } else {
                logger.info(`${fileMethod} | No es momento de ejecutar (mes ${mesesTranscurridos + 1}, primer lunes: ${esPrimerLunesDelMes})`);
            }
            
            if (debeEjecutar) {
                logger.info(`${fileMethod} | Iniciando envío de lista de clientes pendientes a proveedores...`);
                const resultado = await sendCreditReportToProviders();
                logger.info(`${fileMethod} | Resultado: ${JSON.stringify(resultado)}`);
            }
            
        } catch (error) {
            logger.error(`${fileMethod} | Error: ${error.message} - ${error.stack}`);
        }
    });
    */




    // Cron job para enviar lista de clientes pendientes a proveedores cada 2 minutos (NUEVO)
  //cron.schedule('*/2 * * * *', async () => {
  //  const fileMethod = `file: src/controllers/api/cron.js - CRON: sendCreditReportToProviders`;
  //  logger.info(`${fileMethod} | Iniciando envío de lista de clientes pendientes a proveedores...`);
  //  try {
  //      const resultado = await sendCreditReportToProviders();
  //      logger.info(`${fileMethod} | Resultado: ${JSON.stringify(resultado)}`);
  //  } catch (error) {
  //      logger.error(`${fileMethod} | Error: ${error.message} - ${error.stack}`);
  //  }
  //});

}

// Nota: La libreria de cron no sabe que en México se quitó el horario de verano
    cron.schedule('5 10 * * 1', async () => {
        try {
            logger.info('Cron que envia correo semanal de estadisticas de saldo ocupado por empresa')
            const saldo_empresas = await solicitudCreditoService.getSaldoEmpresasResporte();
            await enviarEmailSaldoEmpresas(saldo_empresas.result);
        } catch (error) {
            logger.error(`Error en el cron que envia correo semanal de estadisticas de saldo ocupado por empresa: ${JSON.stringify(error)}`)
        }
    },
    {
      scheduled: true,
      timezone: 'America/Mexico_City',
    })

module.exports = { startCronJobs }

// Ejecutamos manualmente el cron para enviar el correo de prueba
/*
console.log('🚀 ===== Email de prueba =====');
sendCreditReportToProviders();
console.log('🚀 ===== Termino Email de prueba =====');
*/