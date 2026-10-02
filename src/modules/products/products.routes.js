const express = require('express');
const router = express.Router();
const productController = require('./products.controller');
const productValidation = require('./products.validation');
const { validate } = require('../../middleware/validation.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { requirePermission } = require('../../middleware/role.middleware');

router.use(authenticate);

router.post('/', requirePermission('PRODUCT_CREATE'), validate(productValidation.createProductSchema), productController.handleCreateProduct);
router.get('/', requirePermission('PRODUCT_VIEW'), productController.handleGetAllProducts);
router.get('/:id', requirePermission('PRODUCT_VIEW'), productController.handleGetProductById);
router.put('/:id', requirePermission('PRODUCT_UPDATE'), validate(productValidation.updateProductSchema), productController.handleUpdateProduct);
router.delete('/:id', requirePermission('PRODUCT_DELETE'), productController.handleDeleteProduct);

module.exports = router;
