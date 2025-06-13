'use strict'


const boom = require('boom')
const { obtenerCodigosPromociones, getEnviadas, getEnviadasExternas, getRecibidas, actualizarSaldoCodigosPromocion, obtenerSaldoCodigosMayorCero, obtenerSaldoCodigos, obtenerSaldo, actualizarSaldo, guardarSolicitudCreditoExterno, obtenerSolitudesCreditoExternasPendientes, actualizarEstatusSolicitudCreditoExterno, getSCE } = require('../../services/solicitudCredito')

const { guardaRelacionCompradorVendedor } = require('../../services/certification')
const { globalAuth: { keyCipher } } = require('../../config')
const { emailjet: { key, secretKey, sender: { from } } } = require('../../config')
const mailjet = require('node-mailjet').apiConnect(key, secretKey)
const companiesService = require('../../services/companies')
const cipher = require('../../utils/cipherService')
const logger = require('../../utils/logs/logger')

const certificationService = require('../../services/certification')


const consultarCreditos = async (req, res, next) => {

    try {
        const {
            idEmpresa
        } = req.params

        let vigencia = null
        let creditos = 0

        const SaldoEmpresa = await obtenerSaldo(idEmpresa)
        const saldo_codigo = await obtenerSaldoCodigos(idEmpresa)
        if (SaldoEmpresa && SaldoEmpresa.result) {
            creditos = SaldoEmpresa?.result?.[0]?.creditos
        }

        if (SaldoEmpresa && SaldoEmpresa.result) {
            vigencia = SaldoEmpresa?.result?.[0]?.vigencia?.toISOString().substring(0, 10)
        }

        const results = {
            vigencia,
            creditos,
            codigos: saldo_codigo
        }

        return res.json({
            error: false,
            results
        })

    } catch (err) {
        next(err)
    }
}

const agregarCreditos = async (req, res, next) => {

    try {

        const { creditos, idEmpresa } = req.body
        if (!creditos || !idEmpresa) return next(boom.badRequest('Bad request. Some parameters are missing. Check your request.'))

        //creditos += creditos;

        // Obtenbemos creditos actuales
        const SaldoEmpresa = await obtenerSaldo(idEmpresa);
        if (SaldoEmpresa && SaldoEmpresa.result) {
            let _creditos = SaldoEmpresa?.result?.[0]?.creditos;
            _creditos += creditos;
            // Actualizamos saldo
            const result = await actualizarSaldo(idEmpresa, _creditos);
        }

        return res.json({
            error: false,
            results: 'Créditos agregados correctamente'
        })

    } catch (err) {
        next(err)
    }
}

const asignarCodigos = async (req, res, next) => {
    try {
        const parsedData = typeof req.decryptedBody === 'string' ? JSON.parse(req.decryptedBody) : req.decryptedBody
        const { id_empresa, codigo_promocion } = parsedData

        let codigo_estatus = true
        let message = 'Registro correcto'
        let codigo = []

        if (codigo_promocion.length) {
            [codigo] = await companiesService.getCodigoVigente(codigo_promocion)
            if (!codigo) {
                codigo_estatus = false
                message = 'El codigo ingresado no es valido o ya ha caducado'
                return next(boom.badRequest(message))
            }
        }

        if (codigo_estatus && codigo.codigo.length) {

            const [valida_codigo_asignado] = await companiesService.validaAsignacion(codigo_promocion, id_empresa)
            if (valida_codigo_asignado) return next(boom.badRequest('El codigo ya esta asignado a esta empresa'))
            await companiesService.asignaCodigo(codigo.id, id_empresa, codigo.valor)
        }

        const encryptedResponse = await cipher.encryptData(JSON.stringify({
            error: false,
            message
        }), keyCipher)

        return res.send(encryptedResponse)

    } catch (error) {
        next(error)
    }
}

const getCodigos = async (req, res, next) => {
    try {
        const { idEmpresa } = req.params
        const codigos_promociones = await obtenerCodigosPromociones(idEmpresa)
        if (!codigos_promociones) return next(boom.badRequest('La empresa no cuenta con codigos de promociones'))
        const encryptedResponse = await cipher.encryptData(JSON.stringify({
            error: false,
            codigos_promociones
        }), keyCipher)

        return res.send(encryptedResponse)

    } catch (error) {
        next(error)
    }
}

const restarCreditos = async (req, res, next) => {

    try {

        const { creditos = 1, idEmpresa } = req.body
        if (!creditos || !idEmpresa) return next(boom.badRequest('Bad request. Some parameters are missing. Check your request.'))

        let _creditos = 0
        // Obtenemos el saldo de promociones disponibles para utilizarse
        const SaldoEmpresa = await obtenerSaldo(idEmpresa)
        const [saldo_codigo] = await obtenerSaldoCodigosMayorCero(idEmpresa);

        if (!(SaldoEmpresa.result.length) && !(saldo_codigo)) return next(boom.badRequest('No hay créditos suficientes'));

        if (saldo_codigo && saldo_codigo.valor_vigente && saldo_codigo.valor_vigente > 0) {
            // Si se encuentra un resultao tipo array se utilizara el valor del primer elemento
            // para posteriormente actualizarlo en la siguiente instruccion
            _creditos = saldo_codigo.valor_vigente;
            _creditos -= creditos;
            await actualizarSaldoCodigosPromocion(saldo_codigo.id, _creditos)
        } else if (SaldoEmpresa && SaldoEmpresa.result && SaldoEmpresa.result.length) {
            _creditos = SaldoEmpresa?.result?.[0]?.creditos
            _creditos -= creditos

            // Actualizamos saldo
            //const result = await actualizarSaldo(idEmpresa, _creditos);

            if (parseInt(_creditos) > 0) await actualizarSaldo(idEmpresa, _creditos)
            else await actualizarSaldo(idEmpresa, 0)
        }

        //creditos -= creditos;
        // Obtenbemos creditos actuales
        //const SaldoEmpresa = await obtenerSaldo(idEmpresa)
        //if (SaldoEmpresa && SaldoEmpresa.result && SaldoEmpresa.result.length) {
        //  _creditos = SaldoEmpresa?.result?.[0]?.creditos
        //_creditos -= creditos

        // Actualizamos saldo
        //const result = await actualizarSaldo(idEmpresa, _creditos);

        //if (parseInt(_creditos) > 0) await actualizarSaldo(idEmpresa, _creditos)
        // else await actualizarSaldo(idEmpresa, 0)

        // } else {
        // Se busca valor de codigos de promocion vigentes y mayor a 0 empezando por el mas antiguo
        //  const [saldo_codigo] = await obtenerSaldoCodigosMayorCero(idEmpresa)
        //if (saldo_codigo.valor_vigente) {
        // Si se encuentra un resultao tipo array se utilizara el valor del primer elemento
        // para posteriormente actualizarlo en la siguiente instruccion
        // _creditos = saldo_codigo.valor_vigente;
        // _creditos -= creditos;
        // await actualizarSaldoCodigosPromocion(saldo_codigo.id, _creditos)
        // }


        // }

        return res.json({
            error: false,
            results: 'Créditos restados correctamente'
        })

    } catch (err) {
        next(err)
    }
}

const actualizarCreditos = async (req, res, next) => {

    try {

        const { creditos = 1, idEmpresa } = req.body
        if (!creditos || !idEmpresa) return next(boom.badRequest('Bad request. Some parameters are missing. Check your request.'))

        //creditos = creditos;            

        if (idEmpresa && creditos) {
            const result = await actualizarSaldo(idEmpresa, creditos);
            console.log('result ', result);
        }

        return res.json({
            error: false,
            results: 'Créditos actualizados correctamente'
        })

    } catch (err) {
        next(err)
    }
}

const reintegrarCredito = async (req, res, next) => {
    try {

        const { creditos, idEmpresa } = req.body
        if (!creditos || !idEmpresa) return next(boom.badRequest('Bad request. Some parameters are missing. Check your request.'))

        // creditos += creditos;

        // Obtenbemos creditos actuales
        const SaldoEmpresa = await obtenerSaldo(idEmpresa);
        if (SaldoEmpresa && SaldoEmpresa.result) {
            let _creditos = SaldoEmpresa?.result?.[0]?.creditos;
            _creditos += creditos;
            // Actualizamos saldo
            const result = await actualizarSaldo(idEmpresa, _creditos);
        }

        return res.json({
            error: false,
            results: 'Créditos reintegrados correctamente'
        })

    } catch (err) {
        next(err)
    }
}

const consultarListaEnviadas = async (req, res, next) => {
    const fileMethod = `file: src/controllers/api/solicitud-credito.js - method: consultarListaEnviadas`;
    try {
        logger.info(`${fileMethod} - La solicitud de credito a buscar es: ${JSON.stringify(req.params)}`)
        const { idEmpresa } = req.params;

        const { result = [] } = await getEnviadas(idEmpresa)
        logger.info(`${fileMethod} -Estas son las solicitudes de credito obtenidas: ${JSON.stringify(result)}`)

        let vigencia = null;
        let creditos = 0;

        if (idEmpresa) {
            const SaldoEmpresa = await obtenerSaldo(idEmpresa)
            logger.info(`${fileMethod} - El saldo obtenido es: ${JSON.stringify(SaldoEmpresa)}`)
            if (SaldoEmpresa && SaldoEmpresa.result) {
                creditos = SaldoEmpresa?.result?.[0]?.creditos;
            }
            if (SaldoEmpresa && SaldoEmpresa.result) {
                vigencia = SaldoEmpresa?.result?.[0]?.vigencia?.toISOString().substring(0, 10);
            }
        }

        return res.json({
            error: false,
            data: {
                creditos_restantes: creditos,
                creditos_vigencia: vigencia,
                clientes: result

            }
        })
    } catch (error) {
        logger.info(`${fileMethod} - Error al obtener solicitudes enviadas: ${error}`)
        next(error)
    }

}

const consultarListaRecibidas = async (req, res, next) => {

    console.log('consultarListaRecibidas');
    const { idEmpresa } = req.params;

    console.log('params ', req.params);
    console.log('idEmpresa ', idEmpresa);

    const { result = [] } = await getRecibidas(idEmpresa);

    let vigencia = null;
    let creditos = 0;

    if (idEmpresa) {
        const SaldoEmpresa = await obtenerSaldo(idEmpresa);
        if (SaldoEmpresa && SaldoEmpresa.result) {
            creditos = SaldoEmpresa?.result?.[0]?.creditos;
        }
        if (SaldoEmpresa && SaldoEmpresa.result) {
            vigencia = SaldoEmpresa?.result?.[0]?.vigencia?.toISOString().substring(0, 10);
        }
    }

    return res.json({
        error: false,
        data: {
            creditos_restantes: creditos,
            clientes: result

        }
    })

}

// Enviamos invitación empresa externa
const enviarInvitacion = async (req, res, next) => {
    try {
        const { emp_id, nombre_empresa, tax_id, nombre_contacto, telefono, email_corporativo } = req.body
        if (!emp_id || !nombre_empresa || !tax_id || !nombre_contacto || !telefono || !email_corporativo) return next(boom.badRequest('Bad request. Some parameters are missing. Check your request.'))

        const nuevaSolicitud = await guardarSolicitudCreditoExterno(emp_id, nombre_empresa, tax_id, nombre_contacto, telefono, email_corporativo);

        const _empreaa = await companiesService.getEmpresa(emp_id)
        // console.log(_empreaa?.[0]?.emp_razon_social);
        const empresa_invita = _empreaa?.[0]?.emp_razon_social ?? 'Credi';

        const lnk = process.env.URL_CALLBACK_STRIPE ?? 'https://credibusiness.com';

        // Enviar invitación
        //enviaCorreoInvitacionLineaCredito(lnk, 'jesus.lagunas@credibusiness.com', nombre_contacto, empresa_invita);

        // Prueba Dani
        //enviaCorreoInvitacionLineaCredito(lnk, 'daniel.ochoa@credibusiness.com', nombre_contacto, empresa_invita);

        // console.log('MAILJET_EMAIL_DEFAULT ENV ', process.env.NODE_ENV);
        // console.log('MAILJET_EMAIL_DEFAULT ', process.env.MAILJET_EMAIL_DEFAULT);

        // Implementamos variables de Entorno
        // if (process.env.NODE_ENV == 'production') {
        // enviaCorreoInvitacionLineaCredito(lnk, email_corporativo, nombre_contacto, empresa_invita);
        //enviaCorreoInvitacionLineaCredito(lnk, 'jesus.lagunas@credibusiness.com', nombre_contacto, empresa_invita);
        // } else {
        // const MAILJET_EMAIL_DEFAULT = process.env.MAILJET_EMAIL_DEFAULT;
        // const MAILJET_EMAIL_DEFAULT_ARRAY = MAILJET_EMAIL_DEFAULT.split(',');
        // if (MAILJET_EMAIL_DEFAULT_ARRAY.length > 1) {
        //     for (const _email of MAILJET_EMAIL_DEFAULT_ARRAY) {
        //         enviaCorreoInvitacionLineaCredito(lnk, _email, nombre_contacto, empresa_invita);
        //     }
        // }

        // if (MAILJET_EMAIL_DEFAULT != '' && MAILJET_EMAIL_DEFAULT_ARRAY.length == 0) enviaCorreoInvitacionLineaCredito(lnk, process.env.MAILJET_EMAIL_DEFAULT, nombre_contacto, empresa_invita);
        // }

        return res.json({
            error: false,
            results: 'Invitación enviada correctamente'
        })

    } catch (err) {
        console.log(err);
        next(err)
    }
}



const enviaCorreoInvitacionLineaCredito = async (link, email, nombre, nombre_empresa = 'Credi') => {
    // console.log('enviaCorreoInvitacionLineaCredito ', link, email, nombre, nombre_empresa);
    const response = await mailjet
        .post('send', { version: 'v3.1' })
        .request({
            Messages: [
                {
                    From: {
                        Email: 'mkt@credibusiness.site',
                        Name: 'crediBusiness'
                    },
                    To: [
                        {
                            Email: email,
                            Name: nombre
                        }
                    ],
                    //   TemplateID: 6185967,
                    //   TemplateLanguage: true,
                    //   Variables: {
                    //     "token": 2222,
                    //     "idUser": 0
                    //   },

                    Subject: "Invitación - Solicitud de Linea de Crédito",
                    TextPart: "Sssss",
                    HTMLPart: `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Solicitud de Línea de Crédito</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
        }
        .container {
            background-color: white;
            border-radius: 10px;
            box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.1);
            padding: 30px;
            text-align: center;
            width: 400px;
        }
        .logo {
            width: 150px;
            margin-bottom: 20px;
        }
        .title {
            color: #0067b8;
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .subtitle {
            color: #333;
            font-size: 18px;
            margin-bottom: 10px;
        }
        .text {
            color: #666;
            font-size: 14px;
            margin-bottom: 20px;
        }
        .button {
            background-color: #28a745;
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            text-decoration: none;
            font-size: 16px;
        }
        .button:hover {
            background-color: #218838;
        }
    </style>
</head>
<body>
    <div class="container">
        <img src="https://media.licdn.com/dms/image/D4E0BAQELaTEWRcdexw/company-logo_200_200/0/1706647519265/market_choice_b2b_logo?e=2147483647&v=beta&t=f2M_pBx7IOcEh-SW-EbW44JI_w_FDz4l7lO7XmXQJwg" alt="Logo" class="logo">
        <div class="title">${nombre_empresa} te ha enviado una Solicitud de Línea de Crédito</div>
        <div class="subtitle">Regístrate sin costo a Credibusiness y comienza a establecer relaciones comerciales más seguras.</div>
        <div class="text">
            Este link te llevará a una página de registro.
        </div>
        <a href="${link}" class="button">Registrarme</a>
    </div>
</body>
</html>
`

                }
            ]
        })
        .then((result) => {
            console.log('result ', result.body);
        })
        .catch(err => console.log(err));
}


//   // test
// console.log('prueba de envio de correo');
// const _lnk = process.env.URL_CALLBACK_STRIPE ?? 'https://credibusiness.com';
// enviaCorreoInvitacionLineaCredito(_lnk, 'jesus.lagunas@credibusiness.com', 'nombre_contacto', 379);
// // //enviaCorreoInvitacionLineaCredito(_lnk, 'chumemo@hotmail.com', 'nombre_contacto', 379);


// //enviaCorreoInvitacionLineaCredito(_lnk, 'luis.pablo.peralta.tapia@gmail.com', 'nombre_contacto', 379);

// console.log(key, secretKey);


const enviarInvitacionSimple = async (req, res, next) => {
    try {
        const { nombre_empresa, nombre_contacto, telefono, email_corporativo } = req.body

        // if (!nombre_empresa || !nombre_contacto || !telefono || !email_corporativo ) return next(boom.badRequest('Bad request. Some parameters are missing. Check your request.'))

        if (!nombre_empresa || !nombre_contacto || !telefono || !email_corporativo) {
            console.log('Paratros incorrectos ', req.body);
            console.log(nombre_empresa, nombre_contacto, telefono, email_corporativo);
        }

        // const nuevaSolicitud = await guardarSolicitudCreditoExterno(emp_id, nombre_empresa, tax_id, nombre_contacto, telefono, email_corporativo);
        // TODO: Invitacion Email

        return res.json({
            error: false,
            results: 'Invitación enviada correctamente'
        })

    } catch (err) {
        next(err)
    }
}

const asignarSolicitudCreditoExterno = async (tax_id, emp_id) => {

    try {
        // Buscamos empresa
        const pendientes = await obtenerSolitudesCreditoExternasPendientes(tax_id);
        if (pendientes && pendientes.result) {
            // recorremos pendientes
            pendientes.result.map(async (pendiente) => {

                const data = {
                    id_proveedor: pendiente.emp_id,
                    id_cliente: emp_id
                }
                // Asignamos solicitud
                const nuevaSolicitud = await guardaRelacionCompradorVendedor(data);
                // Actualizamos estatus
                const update = await actualizarEstatusSolicitudCreditoExterno(pendiente.id, 'aceptado');

            });
        }

    } catch (err) {
        console.log(err);
    }
}

const reenviarSolicitudCredito = async (req, res, next) => {
    try {

        console.log('sendEmailTemplate ', req.body)

        const { id_cliente, id_proveedor, templateID, link, sce_id } = req.body

        let payload = {}
        if (!id_cliente) {
            // Solicitud de Credito Externa
            const { result: cliente } = await getSCE(sce_id);
            const proveedor = await companiesService.getProveedor(id_proveedor);
            payload = {
                email: cliente[0].email_corporativo,
                templateID: 6279999,
                empresa: cliente[0].nombre_empresa,
                empresa_envia: proveedor[0].emp_razon_social,
                link: link,
                nombre: cliente[0].nombre_contacto,
                templateID: templateID,
            }
        }

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
                                Email: payload.email,
                                Name: payload.nombre
                            }
                        ],
                        TemplateID: payload.templateID,
                        TemplateLanguage: true,
                        Variables: payload ? { ...payload } : {}

                    }
                ]
            });

        console.log('response.body == ');
        console.log(response.body);

        res.status(200).json(response.body)
    } catch (error) {
        console.log('errr ', error)
        next(error)
    }
}

const reenviarSolicitudCreditoInterna = async (req, res, next) => {
  try {
    console.log('Solicitud Interna', req.body);    
    const { id_cliente, id_proveedor } = req.body;     
    if (!id_cliente || !id_proveedor) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos.' });
    }  
    // Obtener correo y nombre del proveedor
    const empresa_info = await certificationService.getUsuarioEmail(id_cliente);

    if (!empresa_info || empresa_info.length === 0) {
        return res.status(404).json({ error: true, message: 'No se encontró la información del proveedor.' });
    }

    const [{ usu_nombre: nombre, usu_email: email }] = empresa_info;

    const templateID = 6992906;   

    const cliente = await certificationService.consultaEmpresaInfo(id_cliente);
    const _cliente = cliente?.result?.[0]?.emp_razon_social || 'No encontrado';
    logger.info(`cliente: ${JSON.stringify(_cliente, )}`);

    const proveedor = await certificationService.consultaEmpresaInfo(id_proveedor);
    const _proveedor = proveedor?.result?.[0]?.emp_razon_social || 'No encosntrado';
    logger.info(`proveedor: ${JSON.stringify(
    {
        email,
        nombre,
        templateID,
        empresa: _cliente,
        empresa_envia: _proveedor
      }
      )}`);
 
    const payload = {
      email: email,  
      nombre: nombre,           // cliente que recibirá el correo
      templateID,
      empresa: _cliente,
      empresa_envia: _proveedor            // nombre del contacto del cliente
    };     
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
                Email: payload.email,
                Name: payload.nombre
              }
            ],
            TemplateID: payload.templateID,
            TemplateLanguage: true,
            Variables: { ...payload }
          }
        ]
      });  
    console.log('response.body == ');
    console.log(response.body);    
    res.status(200).json(response.body);
  } catch (error) {
    console.log('Error en solicitud interna:', error);
    next(error);
  }
};


module.exports = {
    consultarCreditos,
    agregarCreditos,
    actualizarCreditos,
    reintegrarCredito,
    restarCreditos,
    consultarListaEnviadas,
    consultarListaRecibidas,
    enviarInvitacion,
    enviarInvitacionSimple,
    asignarSolicitudCreditoExterno,
    getCodigos,
    asignarCodigos,
    reenviarSolicitudCredito,
    reenviarSolicitudCreditoInterna
}
