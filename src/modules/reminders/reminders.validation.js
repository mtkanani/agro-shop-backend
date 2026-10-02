const Joi = require('joi');

const createReminderSchema = Joi.object({
  title: Joi.string().trim().min(2).max(200).required().messages({
    'string.empty': 'Reminder title is required.',
    'any.required': 'Reminder title is required.',
  }),
  description: Joi.string().trim().max(1000).optional().allow('', null),
  type: Joi.string()
    .valid('FARMER_PRODUCT_DEMAND', 'DEALER_ORDER', 'PAYMENT_FOLLOWUP', 'GENERAL')
    .default('FARMER_PRODUCT_DEMAND'),
  priority: Joi.string()
    .valid('LOW', 'MEDIUM', 'HIGH', 'URGENT')
    .default('MEDIUM'),
  dueDate: Joi.date().iso().required().messages({
    'date.base': 'Valid due date is required.',
    'any.required': 'Due date is required.',
  }),
  farmerId: Joi.string().uuid().optional().allow('', null),
  supplierId: Joi.string().uuid().optional().allow('', null),
  productName: Joi.string().trim().max(200).optional().allow('', null),
  quantityNeeded: Joi.number().positive().optional().allow(null),
  unit: Joi.string().trim().max(50).optional().allow('', null),
  estimatedCost: Joi.number().min(0).optional().allow(null),
  advancePaid: Joi.number().min(0).default(0),
});

const updateReminderSchema = Joi.object({
  title: Joi.string().trim().min(2).max(200).optional(),
  description: Joi.string().trim().max(1000).optional().allow('', null),
  type: Joi.string()
    .valid('FARMER_PRODUCT_DEMAND', 'DEALER_ORDER', 'PAYMENT_FOLLOWUP', 'GENERAL')
    .optional(),
  priority: Joi.string()
    .valid('LOW', 'MEDIUM', 'HIGH', 'URGENT')
    .optional(),
  dueDate: Joi.date().iso().optional(),
  farmerId: Joi.string().uuid().optional().allow('', null),
  supplierId: Joi.string().uuid().optional().allow('', null),
  productName: Joi.string().trim().max(200).optional().allow('', null),
  quantityNeeded: Joi.number().positive().optional().allow(null),
  unit: Joi.string().trim().max(50).optional().allow('', null),
  estimatedCost: Joi.number().min(0).optional().allow(null),
  advancePaid: Joi.number().min(0).optional(),
});

const updateReminderStatusSchema = Joi.object({
  status: Joi.string()
    .valid('PENDING', 'ORDERED_TO_DEALER', 'STOCK_ARRIVED', 'COMPLETED', 'CANCELLED')
    .required()
    .messages({
      'any.only': 'Invalid status. Allowed: PENDING, ORDERED_TO_DEALER, STOCK_ARRIVED, COMPLETED, CANCELLED.',
      'any.required': 'Status is required.',
    }),
  notes: Joi.string().trim().max(500).optional().allow('', null),
});

const snoozeReminderSchema = Joi.object({
  dueDate: Joi.date().iso().optional(),
  snoozeDays: Joi.number().integer().min(1).max(90).default(1),
});

const reminderQuerySchema = Joi.object({
  status: Joi.string()
    .valid('ALL', 'PENDING', 'ORDERED_TO_DEALER', 'STOCK_ARRIVED', 'COMPLETED', 'CANCELLED')
    .optional()
    .allow('', null),
  type: Joi.string()
    .valid('ALL', 'FARMER_PRODUCT_DEMAND', 'DEALER_ORDER', 'PAYMENT_FOLLOWUP', 'GENERAL')
    .optional()
    .allow('', null),
  priority: Joi.string()
    .valid('ALL', 'LOW', 'MEDIUM', 'HIGH', 'URGENT')
    .optional()
    .allow('', null),
  timeframe: Joi.string()
    .valid('ALL', 'OVERDUE', 'TODAY', 'UPCOMING')
    .optional()
    .allow('', null),
  farmerId: Joi.string().uuid().optional().allow('', null),
  supplierId: Joi.string().uuid().optional().allow('', null),
  search: Joi.string().trim().optional().allow('', null),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

module.exports = {
  createReminderSchema,
  updateReminderSchema,
  updateReminderStatusSchema,
  snoozeReminderSchema,
  reminderQuerySchema,
};
