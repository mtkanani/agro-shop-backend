const Joi = require('joi');

const createProductTypeSchema = Joi.object({
  name: Joi.string().required().trim().min(2).max(100),
  shortName: Joi.string().optional().allow('', null).trim(),
  description: Joi.string().optional().allow('', null).trim(),
});

const updateProductTypeSchema = Joi.object({
  name: Joi.string().optional().trim().min(2).max(100),
  shortName: Joi.string().optional().allow('', null).trim(),
  description: Joi.string().optional().allow('', null).trim(),
});

const productTypeQuerySchema = Joi.object({
  search: Joi.string().trim().optional().allow('', null),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  shopId: Joi.string().optional().allow('', null),
});

module.exports = {
  createProductTypeSchema,
  updateProductTypeSchema,
  productTypeQuerySchema,
};

