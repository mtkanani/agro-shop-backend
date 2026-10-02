const Joi = require('joi');

const validExpenseCategories = [
  'DEALER_PROCUREMENT',
  'FREIGHT_TRANSPORT',
  'LABOR_HAMALI',
  'SHOP_RENT',
  'ELECTRICITY_UTILITIES',
  'STAFF_SALARY',
  'PACKAGING',
  'MAINTENANCE',
  'OTHER',
];

const validPaymentMethods = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'KHATA'];

const createExpenseSchema = Joi.object({
  title: Joi.string().required().trim().min(2).max(200).messages({
    'any.required': 'Expense title is required.',
    'string.empty': 'Expense title cannot be empty.',
  }),
  amount: Joi.number().min(0.01).required().messages({
    'any.required': 'Expense amount is required.',
    'number.min': 'Amount must be greater than 0.',
  }),
  category: Joi.string().valid(...validExpenseCategories).required().messages({
    'any.required': 'Expense category is required.',
    'any.only': `Category must be one of: ${validExpenseCategories.join(', ')}`,
  }),
  supplierId: Joi.string().optional().allow('', null),
  paymentMethod: Joi.string().valid(...validPaymentMethods).default('CASH'),
  paymentRef: Joi.string().optional().allow('', null).trim(),
  billNumber: Joi.string().optional().allow('', null).trim(),
  billDate: Joi.date().optional().allow('', null),
  expenseDate: Joi.date().optional().allow('', null),
  notes: Joi.string().optional().allow('', null).trim(),
  receiptUrl: Joi.string().optional().allow('', null).trim(),
});

const updateExpenseSchema = Joi.object({
  title: Joi.string().optional().trim().min(2).max(200),
  amount: Joi.number().min(0.01).optional(),
  category: Joi.string().valid(...validExpenseCategories).optional(),
  supplierId: Joi.string().optional().allow('', null),
  paymentMethod: Joi.string().valid(...validPaymentMethods).optional(),
  paymentRef: Joi.string().optional().allow('', null).trim(),
  billNumber: Joi.string().optional().allow('', null).trim(),
  billDate: Joi.date().optional().allow('', null),
  expenseDate: Joi.date().optional().allow('', null),
  notes: Joi.string().optional().allow('', null).trim(),
  receiptUrl: Joi.string().optional().allow('', null).trim(),
});

const expenseQuerySchema = Joi.object({
  search: Joi.string().optional().allow('', null).trim(),
  category: Joi.string().valid(...validExpenseCategories).optional().allow('', null),
  supplierId: Joi.string().optional().allow('', null),
  paymentMethod: Joi.string().valid(...validPaymentMethods).optional().allow('', null),
  fromDate: Joi.date().optional().allow('', null),
  toDate: Joi.date().optional().allow('', null),
  timeframe: Joi.string().valid('TODAY', 'YESTERDAY', 'THIS_WEEK', 'THIS_MONTH', 'LAST_MONTH', 'CUSTOM').optional().allow('', null),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string().valid('expenseDate', 'amount', 'createdAt').default('expenseDate'),
  sortOrder: Joi.string().valid('asc', 'desc', 'ASC', 'DESC').default('desc'),
});

module.exports = {
  createExpenseSchema,
  updateExpenseSchema,
  expenseQuerySchema,
  validExpenseCategories,
  validPaymentMethods,
};
