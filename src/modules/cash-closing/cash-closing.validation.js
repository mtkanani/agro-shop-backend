const Joi = require('joi');

const openCashClosingSchema = Joi.object({
  shopId: Joi.string().optional().allow('', null),
  openingCash: Joi.number().min(0).required(),
  notes: Joi.string().optional().allow('', null),
});

const performCashClosingSchema = Joi.object({
  actualCash: Joi.number().min(0).required(),
  cashExpense: Joi.number().min(0).default(0),
  notes: Joi.string().optional().allow('', null),
});

module.exports = {
  openCashClosingSchema,
  performCashClosingSchema,
};
