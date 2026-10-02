const Joi = require('joi');

const inventoryQuerySchema = Joi.object({
  search: Joi.string().optional().allow('', null).trim(),
  categoryId: Joi.string().optional().allow('', null),
  status: Joi.string().valid('IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK').optional().allow('', null),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  shopId: Joi.string().optional().allow('', null),
});

const stockInSchema = Joi.object({
  productId: Joi.string().required().messages({
    'any.required': 'Product ID is required for Stock IN.',
  }),
  variantId: Joi.string().optional().allow('', null),
  supplierId: Joi.string().optional().allow('', null),
  batchNumber: Joi.string().required().trim().messages({
    'any.required': 'Batch number is required.',
  }),
  quantity: Joi.number().integer().required().min(1).messages({
    'number.min': 'Stock IN quantity must be at least 1.',
  }),
  purchasePrice: Joi.number().optional().min(0).default(0),
  sellingPrice: Joi.number().optional().min(0).default(0),
  mrp: Joi.number().optional().min(0).default(0),
  expiryDate: Joi.date().required().messages({
    'any.required': 'Expiry date is required for batch tracking.',
  }),
});

const createBatchSchema = stockInSchema;

const stockAdjustmentSchema = Joi.object({
  batchId: Joi.string().required().messages({
    'any.required': 'Batch ID is required for stock adjustment.',
  }),
  type: Joi.string().valid('INCREASE', 'DECREASE').optional().default('DECREASE'),
  adjustmentQuantity: Joi.number().integer().required().not(0).messages({
    'any.required': 'Adjustment quantity is required.',
  }),
  reason: Joi.string().required().trim().min(3).messages({
    'any.required': 'Reason is required for stock adjustment (e.g. Physical stock shortage, Damaged packaging).',
    'string.empty': 'Reason cannot be empty.',
  }),
  notes: Joi.string().optional().allow('', null).trim(),
});

const adjustStockSchema = Joi.object({
  quantity: Joi.number().integer().required().not(0),
  type: Joi.string().valid('INCREASE', 'DECREASE').optional().default('DECREASE'),
  reason: Joi.string().required().trim().min(3).messages({
    'any.required': 'Reason is required for batch stock adjustment.',
  }),
  notes: Joi.string().optional().allow('', null).trim(),
});

const historyQuerySchema = Joi.object({
  productId: Joi.string().optional().allow('', null),
  batchId: Joi.string().optional().allow('', null),
  type: Joi.string().valid('RESTOCK', 'STOCK_IN', 'SALE', 'ADJUSTMENT', 'DAMAGE', 'RETURN', 'EXPIRED', 'OPENING_STOCK').optional().allow('', null),
  fromDate: Joi.date().optional().allow('', null),
  toDate: Joi.date().optional().allow('', null),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  shopId: Joi.string().optional().allow('', null),
});

module.exports = {
  inventoryQuerySchema,
  createBatchSchema,
  stockInSchema,
  stockAdjustmentSchema,
  adjustStockSchema,
  historyQuerySchema,
};
