const Joi = require('joi');

const createSalesReturnSchema = Joi.object({
  invoiceId: Joi.string().required().messages({
    'any.required': 'Invoice ID is required',
  }),
  items: Joi.array().items(
    Joi.object({
      invoiceItemId: Joi.string().required(),
      quantity: Joi.number().integer().min(1).required(),
      condition: Joi.string().valid('GOOD', 'DAMAGED', 'EXPIRED').default('GOOD'),
    })
  ).min(1).required().messages({
    'array.min': 'At least one return item is required',
  }),
  reason: Joi.string().valid(
    'DAMAGED',
    'DEFECTIVE',
    'WRONG_PRODUCT',
    'EXPIRED',
    'CUSTOMER_CHANGED_MIND',
    'WRONG_QUANTITY',
    'QUALITY_ISSUE',
    'OTHER'
  ).required(),
  refundMethod: Joi.string().valid(
    'STORE_CREDIT',
    'CASH',
    'UPI',
    'BANK_TRANSFER',
    'ADJUST_DUE'
  ).default('STORE_CREDIT'),
  notes: Joi.string().optional().allow('', null),
});

const createPurchaseReturnSchema = Joi.object({
  restockId: Joi.string().optional().allow('', null),
  supplierId: Joi.string().optional().allow('', null),
  items: Joi.array().items(
    Joi.object({
      batchId: Joi.string().required(),
      quantity: Joi.number().integer().min(1).required(),
      condition: Joi.string().valid('GOOD', 'DAMAGED', 'EXPIRED').default('DAMAGED'),
    })
  ).min(1).required().messages({
    'array.min': 'At least one return item is required',
  }),
  reason: Joi.string().valid(
    'DAMAGED',
    'DEFECTIVE',
    'EXPIRED',
    'WRONG_SUPPLY',
    'QUALITY_ISSUE',
    'OTHER'
  ).required(),
  settlementMethod: Joi.string().valid(
    'SUPPLIER_CREDIT',
    'SUPPLIER_REFUND',
    'ADJUST_PAYABLE'
  ).default('SUPPLIER_CREDIT'),
  notes: Joi.string().optional().allow('', null),
});

const reverseReturnSchema = Joi.object({
  reason: Joi.string().required().messages({
    'any.required': 'Reversal reason is required',
  }),
});

const returnQuerySchema = Joi.object({
  search: Joi.string().optional().allow('', null),
  fromDate: Joi.date().optional().allow('', null),
  toDate: Joi.date().optional().allow('', null),
  status: Joi.string().optional().allow('', null),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

module.exports = {
  createSalesReturnSchema,
  createPurchaseReturnSchema,
  reverseReturnSchema,
  returnQuerySchema,
};
