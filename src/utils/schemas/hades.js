const Joi = require('joi')

const companyCertification = Joi.object({
  certification_id: Joi.number().min(1).required(),
  status: Joi.string().valid('Accepted', 'Rejected').required()
})

const creditReport = Joi.object({
  credit_report_id: Joi.number().min(1).required(),
  url: Joi.string().required()
})

module.exports = {
  companyCertification,
  creditReport
}
