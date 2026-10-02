const Joi = require('joi');

const createFarmerSchema = Joi.object({
  name: Joi.string().required().trim(),
  phone: Joi.string().required().trim(),
  email: Joi.string().email().optional().allow('', null).trim(),
  village: Joi.string().optional().allow('', null).trim(),
  address: Joi.string().optional().allow('', null).trim(),
  aadhaarNo: Joi.string().optional().allow('', null).trim(),
  creditLimit: Joi.number().min(0).optional().default(0),
  khataBalance: Joi.number().optional().default(0),
  preferredLanguage: Joi.string().valid('en', 'gu', 'gujlish').optional().default('gujlish'),
});

const updateFarmerSchema = Joi.object({
  name: Joi.string().optional().trim(),
  phone: Joi.string().optional().trim(),
  email: Joi.string().email().optional().allow('', null).trim(),
  village: Joi.string().optional().allow('', null).trim(),
  address: Joi.string().optional().allow('', null).trim(),
  aadhaarNo: Joi.string().optional().allow('', null).trim(),
  creditLimit: Joi.number().min(0).optional(),
  khataBalance: Joi.number().optional(),
  preferredLanguage: Joi.string().valid('en', 'gu', 'gujlish').optional(),
});

const recordFarmerPaymentSchema = Joi.object({
  amount: Joi.number().positive().required(),
  method: Joi.string().valid('CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE').optional().default('CASH'),
  txnRef: Joi.string().optional().allow('', null).trim(),
  notes: Joi.string().optional().allow('', null).trim(),
});

module.exports = {
  createFarmerSchema,
  updateFarmerSchema,
  recordFarmerPaymentSchema,
};
