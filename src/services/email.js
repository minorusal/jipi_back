'use strict'
const nodemailer = require('nodemailer')
const Boom = require('@hapi/boom')
const db = require('../lib/db')
const { email: emailConfig } = require('../config') // Importamos la configuración

class EmailService {
  constructor () {
    if (EmailService.instance) {
      return EmailService.instance
    }
    EmailService.instance = this
  }

  /**
   * Orquesta el envío de notificaciones por correo para un reporte de impago.
   * @param {object} reporte - El objeto del reporte de impago, incluyendo sus asociaciones.
   */
  async enviarNotificacionesDeImpago (reporte) {
    if (!reporte.dar_seguimiento) {
      console.log(`Seguimiento deshabilitado para el reporte de impago #${reporte.id_boletinaje_reporte_impago}. No se enviarán correos.`)
      return
    }

    const plantillaMailjetId = (await parametrosService.getParametroPorNombre('email_punto_10'))?.valor
    const nombreProveedor = reporte.grupo.empresa_proveedor.emp_nombre // Asumiendo que tenemos la info del proveedor

    // 1. Notificación al Deudor
    if (reporte.contactos_deudor && reporte.contactos_deudor.length > 0) {
      for (const contacto of reporte.contactos_deudor) {
        if (contacto.correo_electronico) {
          if (plantillaMailjetId) {
            await this.enviarConMailjet(plantillaMailjetId, contacto.correo_electronico, 'Notificación de Adeudo Vencido', { reporte, nombreProveedor })
          } else {
            await this.enviarConNodemailer(contacto.correo_electronico, 'Notificación de Adeudo Vencido', reporte, nombreProveedor)
          }
        }
      }
    }

    // 2. Notificación de confirmación al Proveedor
    const correoProveedor = await this.getCorreoPrincipalProveedor(reporte.grupo.id_empresa_proveedor)
    if (correoProveedor) {
      // Para el proveedor, podríamos usar otra plantilla o un correo de texto simple.
      await this.enviarCorreoConfirmacionProveedor(correoProveedor, reporte);
    }
  }

  async enviarConMailjet (plantillaId, destinatario, asunto, data) {
    // Lógica para enviar con Mailjet (a implementar)
    console.log(`Simulando envío con Mailjet a ${destinatario} usando plantilla ${plantillaId}`)
    return Promise.resolve()
  }

  async enviarConNodemailer (destinatario, asunto, reporte, nombreProveedor) {
    console.log(`Preparando envío con Nodemailer a ${destinatario}`)

    if (!emailConfig || !emailConfig.user || !emailConfig.pass) {
      throw Boom.internal('No se encontraron las credenciales para el envío de correo en el archivo de configuración.')
    }

    const transporter = nodemailer.createTransport({
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.port === 465, // `secure` es true solo si el puerto es 465
      auth: {
        user: emailConfig.user,
        pass: emailConfig.pass
      }
    })

    const textoProveedor = reporte.divulgar_nombre_proveedor
      ? `Les comunicamos que nuestro cliente ${nombreProveedor}`
      : 'Les comunicamos que uno de sus proveedores actuales'

    const mailOptions = {
      from: `Credibusiness <${emailConfig.user}>`,
      to: destinatario,
      subject: asunto,
      html: `
        <p>Estimados Srs. ${reporte.nombre_empresa_deudora}</p>
        <p>${textoProveedor} ha reportado un adeudo vencido con ustedes por un total de facturas vencidas de: $${reporte.monto_adeudo} y un número de facturas vencidas de: ${reporte.numero_facturas_vencidas}.</p>
        <p>Les instamos a comunicarse con su proveedor, realizar el pago correspondiente y/o presentarle su respectivo plan de pagos.</p>
        <p><b>NOTA:</b> Se les informa que su proveedor será responsable de mandar a Credibusiness la actualización, conciliación y resolución de esta incidencia. Nuestra función se limita solo a la notificación de la misma.</p>
        <p>Esperamos su pronta solución y gestión para resolver esta incidencia.</p>
        <p>Atentamente, CREDIBUSINESS</p>
      `
    }
    
    // return transporter.sendMail(mailOptions)
    console.log('Simulando envío de correo con Nodemailer.')
    return Promise.resolve()
  }

  async enviarCorreoConfirmacionProveedor (destinatario, reporte) {
    const asunto = `Confirmación de Reporte de Impago #${reporte.id_boletinaje_reporte_impago}`

    // La URL del front-end podría venir de la config también si se centraliza
    const urlActualizacion = `https://credibusiness.com/boletinaje/actualizar/${reporte.id_boletinaje_reporte_impago}`

    const html = `
      <p>Estimados Srs. ${reporte.grupo.empresa_proveedor.emp_nombre},</p>
      <p>Les comunicamos que hemos enviado una notificación a la empresa ${reporte.nombre_empresa_deudora}, su comprador en estatus de impago con ustedes.</p>
      <p>De acuerdo a su requerimiento y con una frecuencia de seguimiento de <b>${reporte.frecuencia_seguimiento} días</b>, estaremos enviado futuros recordatorios para el cumplimiento en los pagos.</p>
      <p>Si desea usted cancelar estas notificaciones a su comprador, por favor de dar click en el siguiente enlace, confirmar la cancelación y actualizar el estatus de su incidencia:</p>
      <p><a href="${urlActualizacion}">${urlActualizacion}</a></p>
      <p>Si desea actualizar el estatus de la incidencia previo a recibir estas notificaciones, le invitamos a ingresar directamente al Modulo Boletinaje / Actualizar mi boletín / Ingresar Folio.</p>
      <p>Quedamos atentos para apoyarle.<br>Atentamente,<br>CREDIBUSINESS</p>
    `

    // Por ahora, solo simularemos con Nodemailer. La lógica para usar una plantilla de Mailjet se puede añadir aquí.
    return this.enviarConNodemailerSimple(destinatario, asunto, html)
  }

  /**
   * Método simplificado para enviar correos con Nodemailer sin la lógica de impago.
   */
  async enviarConNodemailerSimple (destinatario, asunto, html) {
    if (!emailConfig || !emailConfig.user || !emailConfig.pass) {
      throw Boom.internal('No se encontraron las credenciales para el envío de correo en el archivo de configuración.')
    }

    const transporter = nodemailer.createTransport({
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.port === 465,
      auth: {
        user: emailConfig.user,
        pass: emailConfig.pass
      }
    })

    const mailOptions = { from: `Credibusiness <${emailConfig.user}>`, to: destinatario, subject: asunto, html }

    console.log(`Simulando envío de correo de confirmación a ${destinatario}`)
    return Promise.resolve() // Reemplazar con transporter.sendMail(mailOptions) para envío real
  }

  /**
   * Obtiene el correo del primer usuario asociado a una empresa.
   * @param {number} idEmpresa - El ID de la empresa.
   * @returns {Promise<string|null>} - El correo electrónico o null si no se encuentra.
   */
  async getCorreoPrincipalProveedor (idEmpresa) {
    const relacion = await db.models.EmpresaUsuario.findOne({
      where: { emp_id: idEmpresa },
      order: [['usu_id', 'ASC']] // Aseguramos que sea el "primer" usuario
    })

    if (relacion) {
      const usuario = await db.models.Usuario.findOne({
        where: { usu_id: relacion.usu_id }
      })
      return usuario ? usuario.usu_email : null
    }

    return null
  }
}

const inst = new EmailService()
Object.freeze(inst)

module.exports = inst 