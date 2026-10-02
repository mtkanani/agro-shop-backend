const Joi = require('joi');

const manualKhataEntrySchema = Joi.object({
  farmerId: Joi.string().optional().allow('', null),
  supplierId: Joi.string().optional().allow('', null),
  type: Joi.string().valid('CREDIT', 'DEBIT').required(),
  amount: Joi.number().positive().required(),
  description: Joi.string().required().trim(),
});

module.exports = {
  manualKhataEntrySchema,
};
