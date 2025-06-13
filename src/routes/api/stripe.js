const express = require('express')
const router = express.Router()

const authMiddleware = require('../../utils/middlewares/authMiddleware')

const { 
    createPaymentIntent,
    confirmPayment,
    cancelPayment    
} = require('../../controllers/api/stripe')


router.post('/pagar', createPaymentIntent )
router.post('/confirmarPago', confirmPayment )
router.post('/cancelarPago', cancelPayment )




module.exports = router
