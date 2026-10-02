const Joi = require('joi');

const auditLogQuerySchema = Joi.object({
  module: Joi.string().optional().allow('', null),
  action: Joi.string().optional().allow('', null),
  userId: Joi.string().optional().allow('', null),
  fromDate: Joi.date().iso().optional().allow('', null),
  toDate: Joi.date().iso().optional().allow('', null),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

module.exports = {
  auditLogQuerySchema,
};
