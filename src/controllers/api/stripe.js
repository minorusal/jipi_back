//import Stripe from 'stripe';

const Stripe = require('stripe')

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const { guardarPayment, obtenerPayment, actualizarStatus } = require('../../services/stripe')
const { obtenerSaldo, actualizarSaldo, insertarSaldo } = require('../../services/solicitudCredito')

const getPaymentId = async (variable) => {
    try {
      var charSet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      var charSetSize = charSet.length;
      var strId = "";

      for (var i = 1; i <= 20; i++) {
        var randPos = Math.floor(Math.random() * charSetSize);
        strId += charSet[randPos];
      }

      return strId;
    } catch (ex) {
      return "";
    }
}

const createPaymentIntent = async (req, res) => {

    console.log('createPaymentIntent res ===  ', req.body);

    const { emp_id = 0, amount = 1, product_id = "1", description = "Dsc", creditos=0 } = req.body;

    const payment_id = await getPaymentId( product_id + '_' + amount + '_' + description + '_' + creditos );

    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
            {
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: description, //'Plan Base',
                    },
                    // unit_amount: 1000,
                    unit_amount: (amount || 1) * 100
                },
                quantity: 1,
            },
        ],
        mode: 'payment',
        // success_url: 'https://example.com/success',
        // cancel_url: 'https://example.com/cancel',

        //success_url: process.env.URL_CALLBACK_STRIPE + '/dashboard/profile',
        //cancel_url: process.env.URL_CALLBACK_STRIPE + '/dashboard/profile',

        success_url: process.env.URL_CALLBACK_STRIPE + '#/dashboard/administrador/facturacion/paquetes?status=success&hash='+payment_id,
        cancel_url: process.env.URL_CALLBACK_STRIPE + '#/dashboard/administrador/facturacion/paquetes?status=cancel&hash='+payment_id,

    })
    // .then((session) => {
    //     res.json({ id: session.id });
    // });

    // Guardamos el intento de pago
    const Payment = await guardarPayment(emp_id, payment_id, product_id, description, amount, creditos);

    res.json(session);

};

const confirmPayment = async (req, res) => {
    
    console.log('confirmPayment res ===  ', req.body);

    const { hash = "1", estatus = "exitoso" } = req.body;

    const Payment = await obtenerPayment(hash);

    if (Payment && Payment.result) {
        const { producto, descripcion, monto, creditos, emp_id } = Payment.result[0];

        if (Payment.result?.[0]?.status  === 'exitoso') {
            return res.json({
                error: true,
                message: 'El pago ya fue procesado'
            })
        }

        const UpdatePayment = await actualizarStatus(hash, estatus);

        // Acyualizamos Saldo
        if(emp_id){

            // Obtenbemos creditos actuales
            const SaldoEmpresa = await obtenerSaldo(emp_id);

            // console.log('SaldoEmpresa ', SaldoEmpresa);

            if(SaldoEmpresa && SaldoEmpresa.result?.length > 0){
                let _creditos = SaldoEmpresa?.result?.[0]?.creditos ?? 0;
                _creditos += creditos;
                // Actualizamos saldo
                const result = await actualizarSaldo(emp_id, _creditos);
            }else{
                // Agregamos nuevo registro de saldo
                const result = await insertarSaldo(emp_id, creditos);
            }

        }
        
        

        return res.json({
            error: false,
            data: {
                producto,
                descripcion,
                monto,
                creditos,
                estatus
            }
        })

    } else {
        return res.json({
            error: true,
            message: 'No se encontro el pago'
        })
    }
}

const cancelPayment = async (req, res) => {
    
    console.log('cancelPayment res ===  ', req.body);

    const { hash = "1", estatus = "cancelado" } = req.body;

    const Payment = await obtenerPayment(hash);

    if (Payment && Payment.result) {
        const { producto, descripcion, monto, creditos  } = Payment.result[0];

        if (Payment.result?.[0]?.status === 'cancelado') {
            return res.json({
                error: true,
                message: 'El pago ya fue cancelado'
            })
        }

        const UpdatePayment = await actualizarStatus(hash, estatus);

        return res.json({
            error: false,
            data: {
                producto,
                descripcion,
                monto,
                creditos,
                estatus
            }
        })

    } else {
        return res.json({
            error: true,
            message: 'No se encontro el pago'
        })
    }

}

module.exports = {
    createPaymentIntent,
    confirmPayment,
    cancelPayment
  }
  