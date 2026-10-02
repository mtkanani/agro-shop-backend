const Joi = require('joi');

const salesHistoryQuerySchema = Joi.object({
  search: Joi.string().optional().allow('', null).trim(),
  farmerId: Joi.string().optional().allow('', null),
  userId: Joi.string().optional().allow('', null),
  cashierId: Joi.string().optional().allow('', null),
  paymentStatus: Joi.string().valid('PAID', 'PARTIAL', 'UNPAID', 'CANCELLED').optional().allow('', null),
  paymentMethod: Joi.string().valid('CASH', 'UPI', 'BANK_TRANSFER', 'KHATA', 'CHEQUE', 'CARD').optional().allow('', null),
  categoryId: Joi.string().optional().allow('', null),
  productId: Joi.string().optional().allow('', null),
  batchNumber: Joi.string().optional().allow('', null).trim(),
  minAmount: Joi.number().min(0).optional(),
  maxAmount: Joi.number().min(0).optional(),
  fromDate: Joi.date().optional().allow('', null),
  toDate: Joi.date().optional().allow('', null),
  timeframe: Joi.string().valid('TODAY', 'YESTERDAY', 'THIS_WEEK', 'THIS_MONTH', 'LAST_MONTH', 'CUSTOM').optional().allow('', null),
  sortBy: Joi.string().valid('createdAt', 'totalAmount', 'invoiceNumber', 'paidAmount').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc', 'ASC', 'DESC').default('desc'),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

const salesMetricsQuerySchema = Joi.object({
  search: Joi.string().optional().allow('', null).trim(),
  farmerId: Joi.string().optional().allow('', null),
  userId: Joi.string().optional().allow('', null),
  cashierId: Joi.string().optional().allow('', null),
  paymentStatus: Joi.string().valid('PAID', 'PARTIAL', 'UNPAID', 'CANCELLED').optional().allow('', null),
  paymentMethod: Joi.string().valid('CASH', 'UPI', 'BANK_TRANSFER', 'KHATA', 'CHEQUE', 'CARD').optional().allow('', null),
  categoryId: Joi.string().optional().allow('', null),
  productId: Joi.string().optional().allow('', null),
  batchNumber: Joi.string().optional().allow('', null).trim(),
  minAmount: Joi.number().min(0).optional(),
  maxAmount: Joi.number().min(0).optional(),
  fromDate: Joi.date().optional().allow('', null),
  toDate: Joi.date().optional().allow('', null),
  timeframe: Joi.string().valid('TODAY', 'YESTERDAY', 'THIS_WEEK', 'THIS_MONTH', 'LAST_MONTH', 'CUSTOM').optional().allow('', null),
});

const itemSalesQuerySchema = Joi.object({
  search: Joi.string().optional().allow('', null).trim(),
  productId: Joi.string().optional().allow('', null),
  categoryId: Joi.string().optional().allow('', null),
  batchNumber: Joi.string().optional().allow('', null).trim(),
  farmerId: Joi.string().optional().allow('', null),
  fromDate: Joi.date().optional().allow('', null),
  toDate: Joi.date().optional().allow('', null),
  timeframe: Joi.string().valid('TODAY', 'YESTERDAY', 'THIS_WEEK', 'THIS_MONTH', 'LAST_MONTH', 'CUSTOM').optional().allow('', null),
  sortBy: Joi.string().valid('createdAt', 'quantity', 'totalPrice', 'unitPrice').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc', 'ASC', 'DESC').default('desc'),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

const farmerSalesQuerySchema = Joi.object({
  fromDate: Joi.date().optional().allow('', null),
  toDate: Joi.date().optional().allow('', null),
  timeframe: Joi.string().valid('TODAY', 'YESTERDAY', 'THIS_WEEK', 'THIS_MONTH', 'LAST_MONTH', 'CUSTOM').optional().allow('', null),
  paymentStatus: Joi.string().valid('PAID', 'PARTIAL', 'UNPAID', 'CANCELLED').optional().allow('', null),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

const exportSalesQuerySchema = Joi.object({
  format: Joi.string().valid('csv', 'json').default('csv'),
  type: Joi.string().valid('INVOICES', 'ITEMIZED').default('INVOICES'),
  search: Joi.string().optional().allow('', null).trim(),
  farmerId: Joi.string().optional().allow('', null),
  userId: Joi.string().optional().allow('', null),
  cashierId: Joi.string().optional().allow('', null),
  paymentStatus: Joi.string().valid('PAID', 'PARTIAL', 'UNPAID', 'CANCELLED').optional().allow('', null),
  paymentMethod: Joi.string().valid('CASH', 'UPI', 'BANK_TRANSFER', 'KHATA', 'CHEQUE', 'CARD').optional().allow('', null),
  categoryId: Joi.string().optional().allow('', null),
  productId: Joi.string().optional().allow('', null),
  batchNumber: Joi.string().optional().allow('', null).trim(),
  minAmount: Joi.number().min(0).optional(),
  maxAmount: Joi.number().min(0).optional(),
  fromDate: Joi.date().optional().allow('', null),
  toDate: Joi.date().optional().allow('', null),
  timeframe: Joi.string().valid('TODAY', 'YESTERDAY', 'THIS_WEEK', 'THIS_MONTH', 'LAST_MONTH', 'CUSTOM').optional().allow('', null),
});

module.exports = {
  salesHistoryQuerySchema,
  salesMetricsQuerySchema,
  itemSalesQuerySchema,
  farmerSalesQuerySchema,
  exportSalesQuerySchema,
};
