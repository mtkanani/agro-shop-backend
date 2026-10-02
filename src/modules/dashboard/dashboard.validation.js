const Joi = require('joi');

const dashboardQuerySchema = Joi.object({
  filter: Joi.string().valid('today', 'yesterday', 'this_week', 'week', 'last_week', 'this_month', 'month', 'last_month', 'this_year', 'custom').optional().allow('', null),
  fromDate: Joi.date().optional().allow('', null),
  toDate: Joi.date().optional().allow('', null),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string().valid('quantity', 'revenue', 'profit').optional().default('quantity'),
  shopId: Joi.string().optional().allow('', null),
});

module.exports = {
  dashboardQuerySchema,
};
