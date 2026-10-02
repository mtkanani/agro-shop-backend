const Joi = require('joi');

const createCategorySchema = Joi.object({
  name: Joi.string().required().trim().min(2).max(100),
  code: Joi.string().optional().allow('', null).trim(),
  description: Joi.string().optional().allow('', null).trim(),
});

const updateCategorySchema = Joi.object({
  name: Joi.string().optional().trim().min(2).max(100),
  code: Joi.string().optional().allow('', null).trim(),
  description: Joi.string().optional().allow('', null).trim(),
});

const categoryQuerySchema = Joi.object({
  search: Joi.string().trim().optional().allow('', null),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  shopId: Joi.string().optional().allow('', null),
});

module.exports = {
  createCategorySchema,
  updateCategorySchema,
  categoryQuerySchema,
};

