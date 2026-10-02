const Joi = require('joi');

const createInvoiceItemSchema = Joi.object({
  productId: Joi.string().optional().allow('', null),
  productVariantId: Joi.string().optional().allow('', null),
  variantId: Joi.string().optional().allow('', null),
  batchId: Joi.string().optional().allow('', null),
  quantity: Joi.number().integer().min(1).required().messages({
    'number.min': 'Quantity must be at least 1.',
    'any.required': 'Quantity is required.',
  }),
  unitPrice: Joi.number().min(0).optional(),
  discount: Joi.number().min(0).default(0),
}).or('productId', 'productVariantId', 'variantId');

const createInvoiceSchema = Joi.object({
  shopId: Joi.string().optional().allow('', null),
  farmerId: Joi.string().optional().allow('', null),
  customerType: Joi.string().valid('FARMER', 'WALK_IN_CUSTOMER').optional().default('FARMER'),
  customerName: Joi.string().optional().allow('', null).trim(),
  customerPhone: Joi.string().optional().allow('', null).trim(),
  items: Joi.array().items(createInvoiceItemSchema).min(1).required().messages({
    'array.min': 'At least one product item is required for billing.',
    'any.required': 'Billing items are required.',
  }),
  discount: Joi.number().min(0).default(0),
  billDiscount: Joi.number().min(0).default(0),
  paidAmount: Joi.number().min(0).optional(),
  amountReceived: Joi.number().min(0).optional(),
  paymentType: Joi.string().valid('PAY_NOW', 'PAY_LATER', 'PARTIAL', 'CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'KHATA', 'CREDIT', 'CHEQUE').optional(),
  paymentMethod: Joi.string().valid('PAY_NOW', 'PAY_LATER', 'PARTIAL', 'CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'KHATA', 'CREDIT', 'CHEQUE').optional(),
  paymentRef: Joi.string().optional().allow('', null).trim(),
  notes: Joi.string().optional().allow('', null).trim(),
});

const billingQuerySchema = Joi.object({
  search: Joi.string().optional().allow('', null).trim(),
  farmerId: Joi.string().optional().allow('', null),
  paymentStatus: Joi.string().valid('PAID', 'PARTIAL', 'UNPAID', 'CANCELLED').optional().allow('', null),
  paymentMethod: Joi.string().optional().allow('', null),
  fromDate: Joi.date().optional().allow('', null),
  toDate: Joi.date().optional().allow('', null),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  shopId: Joi.string().optional().allow('', null),
});

const cancelInvoiceSchema = Joi.object({
  reason: Joi.string().required().trim().min(3).messages({
    'any.required': 'Cancellation reason is required.',
    'string.empty': 'Cancellation reason cannot be empty.',
  }),
});

module.exports = {
  createInvoiceSchema,
  billingQuerySchema,
  cancelInvoiceSchema,
};
