const Joi = require('joi');

const revenueQuerySchema = Joi.object({
  fromDate: Joi.date().optional().allow('', null),
  toDate: Joi.date().optional().allow('', null),
  timeframe: Joi.string().valid('TODAY', 'YESTERDAY', 'THIS_WEEK', 'THIS_MONTH', 'LAST_MONTH', 'THIS_QUARTER', 'THIS_YEAR', 'CUSTOM').optional().allow('', null),
  categoryId: Joi.string().optional().allow('', null).trim(),
  interval: Joi.string().valid('daily', 'weekly', 'monthly').default('daily'),
});

module.exports = {
  revenueQuerySchema,
};
