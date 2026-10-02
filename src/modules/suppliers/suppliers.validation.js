const Joi = require('joi');

const createSupplierSchema = Joi.object({
  name: Joi.string().required().trim().min(2).max(100),
  companyName: Joi.string().optional().allow('', null).trim(),
  phone: Joi.string().required().trim().min(8).max(20),
  alternatePhone: Joi.string().optional().allow('', null).trim(),
  email: Joi.string().email().optional().allow('', null).trim(),
  address: Joi.string().optional().allow('', null).trim(),
  gstin: Joi.string().optional().allow('', null).trim(),
  suppliedProducts: Joi.string().optional().allow('', null).trim(),
  fertilizerLicense: Joi.string().optional().allow('', null).trim(),
  pesticideLicense: Joi.string().optional().allow('', null).trim(),
  khataBalance: Joi.number().optional().default(0),
});

const updateSupplierSchema = createSupplierSchema.fork(
  ['name', 'phone'],
  (schema) => schema.optional()
);

const recordSupplierPaymentSchema = Joi.object({
  amount: Joi.number().positive().required(),
  method: Joi.string().valid('CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE').default('CASH'),
  referenceNo: Joi.string().optional().allow('', null),
  notes: Joi.string().optional().allow('', null),
});

module.exports = {
  createSupplierSchema,
  updateSupplierSchema,
  recordSupplierPaymentSchema,
};
