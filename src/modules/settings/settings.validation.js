const Joi = require('joi');

const updateShopProfileSchema = Joi.object({
  shopName: Joi.string().trim().min(2).optional(),
  mobile: Joi.string().trim().optional(),
  email: Joi.string().email().optional().allow('', null),
  address: Joi.string().trim().optional().allow('', null),
  villageCity: Joi.string().trim().optional().allow('', null),
  state: Joi.string().trim().optional().allow('', null),
  pincode: Joi.string().trim().optional().allow('', null),
  fertilizerLicense: Joi.string().trim().optional().allow('', null),
  pesticideLicense: Joi.string().trim().optional().allow('', null),
  seedLicense: Joi.string().trim().optional().allow('', null),
});

const updateOwnerProfileSchema = Joi.object({
  fullName: Joi.string().trim().min(2).optional(),
  email: Joi.string().email().optional(),
  mobile: Joi.string().trim().optional(),
});

const updateBillingSettingsSchema = Joi.object({
  allowCreditSales: Joi.boolean().optional(),
  requireFarmerForCredit: Joi.boolean().optional(),
  allowDiscount: Joi.boolean().optional(),
  maxDiscountPercent: Joi.number().min(0).max(100).optional(),
  defaultPaymentMethod: Joi.string().valid('CASH', 'UPI', 'CARD', 'CREDIT', 'BANK_TRANSFER').optional(),
});

const updateTaxSettingsSchema = Joi.object({
  gstEnabled: Joi.boolean().optional(),
  gstin: Joi.string().trim().optional().allow('', null),
  defaultTaxRate: Joi.number().min(0).max(100).default(0), // Agriculture zero tax default
  pricingType: Joi.string().valid('INCLUSIVE', 'EXCLUSIVE').optional(),
});

const updateInventorySettingsSchema = Joi.object({
  allowNegativeStock: Joi.boolean().optional(),
  expiryWarningDays: Joi.number().integer().min(1).max(365).optional(),
  minStockDefault: Joi.number().integer().min(0).optional(),
});

const updateCreditSettingsSchema = Joi.object({
  defaultCreditPeriodDays: Joi.number().integer().min(1).max(365).optional(),
  dueReminderDays: Joi.number().integer().min(1).max(30).optional(),
  maxCreditLimit: Joi.number().min(0).optional(),
});

const updateRegionalSettingsSchema = Joi.object({
  language: Joi.string().valid('en', 'gu', 'gujlish').optional(),
  currency: Joi.string().default('INR').optional(),
  symbol: Joi.string().default('₹').optional(),
  timezone: Joi.string().default('Asia/Kolkata').optional(),
  dateFormat: Joi.string().valid('DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD').optional(),
});

const updateInvoiceSettingsSchema = Joi.object({
  invoicePrefix: Joi.string().trim().max(10).optional(),
  invoiceFooter: Joi.string().trim().optional().allow('', null),
  showShopLogo: Joi.boolean().optional(),
  showGST: Joi.boolean().optional(),
});

module.exports = {
  updateShopProfileSchema,
  updateOwnerProfileSchema,
  updateBillingSettingsSchema,
  updateTaxSettingsSchema,
  updateInventorySettingsSchema,
  updateCreditSettingsSchema,
  updateRegionalSettingsSchema,
  updateInvoiceSettingsSchema,
};
