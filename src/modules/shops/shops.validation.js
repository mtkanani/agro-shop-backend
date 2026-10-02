const Joi = require('joi');

const createShopSchema = Joi.object({
  shopName: Joi.string().required().trim(),
  code: Joi.string().optional().allow('', null).trim().uppercase(),
  ownerName: Joi.string().optional().allow('', null).trim(),
  mobile: Joi.string().required().trim(),
  email: Joi.string().email().optional().allow('', null),
  address: Joi.string().optional().allow('', null),
  villageCity: Joi.string().optional().allow('', null),
  state: Joi.string().optional().allow('', null),
  pincode: Joi.string().optional().allow('', null),
  status: Joi.string().valid('ACTIVE', 'INACTIVE', 'SUSPENDED').default('ACTIVE'),
  gstin: Joi.string().optional().allow('', null),
  fertilizerLicense: Joi.string().optional().allow('', null),
  pesticideLicense: Joi.string().optional().allow('', null),
  seedLicense: Joi.string().optional().allow('', null),
  logo: Joi.string().optional().allow('', null),
});

const updateShopSchema = createShopSchema.fork(['shopName', 'mobile'], (schema) => schema.optional());

module.exports = {
  createShopSchema,
  updateShopSchema,
};
