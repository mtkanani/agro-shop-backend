const express = require('express');
const router = express.Router();
const restockController = require('./restocks.controller');
const restockValidation = require('./restocks.validation');
const { validate } = require('../../middleware/validation.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { requirePermission } = require('../../middleware/role.middleware');

router.use(authenticate);

router.post('/', requirePermission('PRODUCT_CREATE'), validate(restockValidation.createRestockSchema), restockController.handleCreateRestock);
router.get('/', requirePermission('PRODUCT_VIEW'), restockController.handleGetAllRestocks);
router.get('/:id', requirePermission('PRODUCT_VIEW'), restockController.handleGetRestockById);

module.exports = router;
