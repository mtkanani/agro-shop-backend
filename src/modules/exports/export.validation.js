const Joi = require('joi');

const createExportSchema = Joi.object({
  type: Joi.string()
    .valid(
      'SALES',
      'PURCHASES',
      'FARMERS',
      'SUPPLIERS',
      'PRODUCTS',
      'INVENTORY',
      'PAYMENTS',
      'CREDIT',
      'SALES_RETURNS',
      'PURCHASE_RETURNS',
      'REPORTS'
    )
    .required(),
  format: Joi.string().valid('CSV', 'JSON', 'XLSX').default('CSV'),
  fromDate: Joi.date().iso().optional().allow('', null),
  toDate: Joi.date().iso().optional().allow('', null),
});

const exportQuerySchema = Joi.object({
  type: Joi.string().optional().allow('', null),
  format: Joi.string().optional().allow('', null),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

module.exports = {
  createExportSchema,
  exportQuerySchema,
};
