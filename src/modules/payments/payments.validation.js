const Joi = require('joi');

const recordPaymentSchema = Joi.object({
  farmerId: Joi.string().optional().allow('', null),
  supplierId: Joi.string().optional().allow('', null),
  invoiceId: Joi.string().optional().allow('', null),
  amount: Joi.number().positive().required(),
  method: Joi.string().valid('CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE').default('CASH'),
  txnRef: Joi.string().optional().allow('', null),
  notes: Joi.string().optional().allow('', null),
});

module.exports = {
  recordPaymentSchema,
};
