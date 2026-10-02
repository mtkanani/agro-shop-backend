const Joi = require('joi');

const recordFarmerPaymentSchema = Joi.object({
  farmerId: Joi.string().required().messages({
    'any.required': 'Farmer ID is required.',
  }),
  invoiceId: Joi.string().optional().allow('', null),
  amount: Joi.number().positive().required().messages({
    'number.positive': 'Payment amount must be greater than 0.',
    'any.required': 'Payment amount is required.',
  }),
  method: Joi.string().valid('CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE').default('CASH'),
  txnRef: Joi.string().optional().allow('', null).trim(),
  notes: Joi.string().optional().allow('', null).trim(),
});

const settleInvoiceSchema = Joi.object({
  paymentMethod: Joi.string().valid('CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE').default('CASH'),
  paymentRef: Joi.string().optional().allow('', null).trim(),
  notes: Joi.string().optional().allow('', null).trim(),
});

const updateCreditLimitSchema = Joi.object({
  creditLimit: Joi.number().min(0).required().messages({
    'number.min': 'Credit limit cannot be negative.',
    'any.required': 'Credit limit is required.',
  }),
});

const openingBalanceSchema = Joi.object({
  amount: Joi.number().min(0).required().messages({
    'number.min': 'Opening balance cannot be negative.',
    'any.required': 'Opening balance amount is required.',
  }),
  type: Joi.string().valid('DEBIT', 'CREDIT').default('DEBIT'),
  reason: Joi.string().optional().allow('', null).trim(),
});

const adjustmentSchema = Joi.object({
  farmerId: Joi.string().required().messages({
    'any.required': 'Farmer ID is required.',
  }),
  amount: Joi.number().positive().required().messages({
    'number.positive': 'Adjustment amount must be greater than 0.',
    'any.required': 'Adjustment amount is required.',
  }),
  type: Joi.string().valid('CREDIT', 'DEBIT').required().messages({
    'any.required': 'Adjustment type (CREDIT or DEBIT) is required.',
  }),
  reason: Joi.string().required().trim().min(3).messages({
    'any.required': 'Reason for adjustment is required.',
  }),
  notes: Joi.string().optional().allow('', null).trim(),
});

const reversePaymentSchema = Joi.object({
  reason: Joi.string().required().trim().min(3).messages({
    'any.required': 'Reversal reason is required.',
  }),
});

const farmerCreditQuerySchema = Joi.object({
  search: Joi.string().optional().allow('', null).trim(),
  status: Joi.string().valid('ALL', 'DUE', 'OVERDUE', 'NO_DUE').optional().allow('', null),
  minDue: Joi.number().min(0).optional(),
  maxDue: Joi.number().min(0).optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  shopId: Joi.string().optional().allow('', null),
});

const sendFarmerBillsSchema = Joi.object({
  billType: Joi.string().valid('ALL', 'PENDING', 'COMPLETED').required().messages({
    'any.only': 'Bill type must be one of ALL, PENDING, or COMPLETED.',
    'any.required': 'Bill type is required.',
  }),
  channels: Joi.array()
    .items(Joi.string().valid('EMAIL', 'WHATSAPP'))
    .min(1)
    .default(['EMAIL', 'WHATSAPP'])
    .messages({
      'array.min': 'At least one notification channel (EMAIL or WHATSAPP) must be selected.',
    }),
  recipientEmail: Joi.string().email().optional().allow('', null).trim(),
  recipientPhone: Joi.string().optional().allow('', null).trim(),
  customNote: Joi.string().max(500).optional().allow('', null).trim(),
  lang: Joi.string().valid('en', 'gu', 'gujlish').optional(),
});

module.exports = {
  recordFarmerPaymentSchema,
  settleInvoiceSchema,
  updateCreditLimitSchema,
  openingBalanceSchema,
  adjustmentSchema,
  reversePaymentSchema,
  farmerCreditQuerySchema,
  sendFarmerBillsSchema,
};

