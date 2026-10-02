const Joi = require('joi');

const createUserSchema = Joi.object({
  fullName: Joi.string().required().trim(),
  email: Joi.string().email().required().trim().lowercase(),
  mobile: Joi.string().optional().allow('', null).trim(),
  password: Joi.string().required().min(6),
  role: Joi.string().valid('SUPER_ADMIN', 'OWNER', 'BILLING_STAFF', 'ADMIN').default('BILLING_STAFF'),
  shopId: Joi.string().optional().allow('', null),
});

const updateUserSchema = Joi.object({
  fullName: Joi.string().optional().trim(),
  mobile: Joi.string().optional().allow('', null).trim(),
  role: Joi.string().valid('SUPER_ADMIN', 'OWNER', 'BILLING_STAFF', 'ADMIN').optional(),
  shopId: Joi.string().optional().allow('', null),
  status: Joi.string().valid('ACTIVE', 'INACTIVE', 'SUSPENDED').optional(),
});

module.exports = {
  createUserSchema,
  updateUserSchema,
};
