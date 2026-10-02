const Joi = require('joi');

const notificationQuerySchema = Joi.object({
  isRead: Joi.boolean().optional(),
  type: Joi.string().valid(
    'LOW_STOCK',
    'OUT_OF_STOCK',
    'OVERDUE_CREDIT',
    'UPCOMING_DUE',
    'PAYMENT_RECEIVED',
    'RESTOCK_COMPLETED',
    'SALES_RETURN_CREATED',
    'PURCHASE_RETURN_CREATED',
    'EXPIRY_WARNING',
    'EXPIRY_TODAY',
    'SYSTEM_ALERT'
  ).optional().allow('', null),
  priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'CRITICAL').optional().allow('', null),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

const updatePreferencesSchema = Joi.object({
  enableLowStock: Joi.boolean().optional(),
  enableOutOfStock: Joi.boolean().optional(),
  enableOverdueCredit: Joi.boolean().optional(),
  enableUpcomingDue: Joi.boolean().optional(),
  enablePayment: Joi.boolean().optional(),
  enableRestock: Joi.boolean().optional(),
  enableReturns: Joi.boolean().optional(),
  enableExpiry: Joi.boolean().optional(),
});

module.exports = {
  notificationQuerySchema,
  updatePreferencesSchema,
};
