const express = require('express')
const router = express.Router()
const validEmailsCtrl = require('../../controllers/api/validation')
const authMiddleware = require('../../utils/middlewares/authMiddleware')

router.get('/', authMiddleware, validEmailsCtrl.isEmailValid)
router.post('/sendEmail',  validEmailsCtrl.sendEmail)
router.post('/sendEmailTemplateRegister',  validEmailsCtrl.sendEmailTemplateRegister)
router.put('/validaToken/:token/:userId', validEmailsCtrl.validToken)
router.put('/estatusRegistro', validEmailsCtrl.estatusRegistro)

/// 
router.post('/sendEmailTemplate',  validEmailsCtrl.sendEmailTemplate)

module.exports = router
