const Joi = require('joi');

const createRestockItemSchema = Joi.object({
  productId: Joi.string().required().messages({
    'any.required': 'Product ID is required for restock item.',
  }),
  variantId: Joi.string().optional().allow('', null),
  quantity: Joi.number().integer().positive().required().messages({
    'number.positive': 'Restock quantity must be greater than 0.',
    'any.required': 'Quantity is required.',
  }),
  purchasePrice: Joi.number().min(0).required().messages({
    'any.required': 'Purchase price is required.',
  }),
  sellingPrice: Joi.number().min(0).optional().default(0),
  mrp: Joi.number().min(0).optional().default(0),
  batchNumber: Joi.string().optional().allow('', null).trim(),
  mfgDate: Joi.date().optional().allow('', null),
  expiryDate: Joi.date().optional().allow('', null),
});

const createRestockSchema = Joi.object({
  supplierId: Joi.string().required().messages({
    'any.required': 'Supplier ID is required for restock.',
  }),
  restockDate: Joi.date().optional().default(() => new Date()),
  notes: Joi.string().optional().allow('', null).trim(),
  items: Joi.array().items(createRestockItemSchema).min(1).required().messages({
    'array.min': 'At least one product item is required for restock.',
    'any.required': 'Restock items are required.',
  }),
});

module.exports = {
  createRestockSchema,
  createRestockItemSchema,
};
