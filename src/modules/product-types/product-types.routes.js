const express = require('express');
const router = express.Router();
const productTypeController = require('./product-types.controller');
const productTypeValidation = require('./product-types.validation');
const { validate } = require('../../middleware/validation.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { requirePermission } = require('../../middleware/role.middleware');

router.use(authenticate);

router.post('/', requirePermission('PRODUCT_CREATE'), validate(productTypeValidation.createProductTypeSchema), productTypeController.handleCreateProductType);
router.get('/', requirePermission('PRODUCT_VIEW'), validate(productTypeValidation.productTypeQuerySchema, 'query'), productTypeController.handleGetAllProductTypes);
router.get('/:id', requirePermission('PRODUCT_VIEW'), productTypeController.handleGetProductTypeById);
router.put('/:id', requirePermission('PRODUCT_UPDATE'), validate(productTypeValidation.updateProductTypeSchema), productTypeController.handleUpdateProductType);
router.delete('/:id', requirePermission('PRODUCT_DELETE'), productTypeController.handleDeleteProductType);

module.exports = router;
