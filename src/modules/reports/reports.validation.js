const Joi = require('joi');

const reportQuerySchema = Joi.object({
  filter: Joi.string().valid('today', 'yesterday', 'this_week', 'week', 'last_week', 'this_month', 'month', 'last_month', 'this_year', 'year', 'custom').optional().allow('', null),
  fromDate: Joi.date().optional().allow('', null),
  toDate: Joi.date().optional().allow('', null),
  startDate: Joi.date().optional().allow('', null),
  endDate: Joi.date().optional().allow('', null),
  categoryId: Joi.string().optional().allow('', null),
  productId: Joi.string().optional().allow('', null),
  farmerId: Joi.string().optional().allow('', null),
  supplierId: Joi.string().optional().allow('', null),
  paymentMethod: Joi.string().optional().allow('', null),
  paymentStatus: Joi.string().optional().allow('', null),
  sortBy: Joi.string().valid('quantity', 'revenue', 'profit', 'purchases', 'date', 'name').optional().default('revenue'),
  sortOrder: Joi.string().valid('asc', 'desc').optional().default('desc'),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  shopId: Joi.string().optional().allow('', null),
});

module.exports = {
  reportQuerySchema,
  dateRangeSchema: reportQuerySchema,
};
