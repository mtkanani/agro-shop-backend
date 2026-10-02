const Joi = require('joi');

const scanQuerySchema = Joi.object({
  code: Joi.string().required().trim().min(2).messages({
    'any.required': 'Barcode or product code parameter "code" is required.',
    'string.empty': 'Barcode or product code cannot be empty.',
    'string.min': 'Barcode or product code must be at least 2 characters long.',
  }),
});

const catalogueQuerySchema = Joi.object({
  cursor: Joi.string().optional().allow('', null).trim(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).default(18),
  categoryId: Joi.string().optional().allow('', null).trim(),
  search: Joi.string().optional().allow('', null).trim(),
});

module.exports = {
  scanQuerySchema,
  catalogueQuerySchema,
};
