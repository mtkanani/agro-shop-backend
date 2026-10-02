const Joi = require('joi');

const createProductSchema = Joi.object({
  name: Joi.string().required().trim().min(2).max(150),
  shortName: Joi.string().required().trim().min(1).max(50).messages({
    'any.required': 'Short Name is required for quick POS search, dashboard display, and stock alerts.',
    'string.empty': 'Short Name cannot be empty.',
  }),
  code: Joi.string().optional().allow('', null).trim(),
  hsnCode: Joi.string().optional().allow('', null).trim(),
  brand: Joi.string().optional().allow('', null).trim(),
  barcode: Joi.string().optional().allow('', null).trim(),
  categoryId: Joi.string().required().messages({
    'any.required': 'Category selection is required.',
  }),
  productTypeId: Joi.string().optional().allow('', null),
  unitId: Joi.string().optional().allow('', null),
  uom: Joi.string().optional().default('unit'),
  taxRate: Joi.number().optional().min(0).max(100).default(0),
  minStock: Joi.number().optional().min(0).default(5),
  purchasePrice: Joi.number().optional().min(0).default(0),
  mrp: Joi.number().optional().min(0).default(0),
  sellingPrice: Joi.number().optional().min(0).default(0),
  variants: Joi.array()
    .items(
      Joi.object({
        variantName: Joi.string().required().trim(),
        shortName: Joi.string().optional().allow('', null).trim(),
        sku: Joi.string().optional().allow('', null).trim(),
        barcode: Joi.string().optional().allow('', null).trim(),
        unit: Joi.string().optional().allow('', null).trim(),
        purchasePrice: Joi.number().optional().min(0).default(0),
        mrp: Joi.number().optional().min(0).default(0),
        sellingPrice: Joi.number().optional().min(0).default(0),
        taxRate: Joi.number().optional().min(0).max(100).default(0),
      })
    )
    .optional(),
});

const updateProductSchema = Joi.object({
  name: Joi.string().optional().trim().min(2).max(150),
  shortName: Joi.string().optional().trim().min(1).max(50),
  code: Joi.string().optional().trim().min(2).max(50),
  hsnCode: Joi.string().optional().allow('', null).trim(),
  brand: Joi.string().optional().allow('', null).trim(),
  barcode: Joi.string().optional().allow('', null).trim(),
  categoryId: Joi.string().optional(),
  productTypeId: Joi.string().optional().allow('', null),
  unitId: Joi.string().optional().allow('', null),
  uom: Joi.string().optional(),
  taxRate: Joi.number().optional().min(0).max(100),
  minStock: Joi.number().optional().min(0),
  purchasePrice: Joi.number().optional().min(0),
  mrp: Joi.number().optional().min(0),
  sellingPrice: Joi.number().optional().min(0),
});

const createVariantSchema = Joi.object({
  variantName: Joi.string().required().trim(),
  shortName: Joi.string().optional().allow('', null).trim(),
  sku: Joi.string().optional().allow('', null).trim(),
  barcode: Joi.string().optional().allow('', null).trim(),
  unit: Joi.string().optional().allow('', null).trim(),
  purchasePrice: Joi.number().optional().min(0).default(0),
  mrp: Joi.number().optional().min(0).default(0),
  sellingPrice: Joi.number().optional().min(0).default(0),
  taxRate: Joi.number().optional().min(0).max(100).default(0),
});

module.exports = {
  createProductSchema,
  updateProductSchema,
  createVariantSchema,
};
