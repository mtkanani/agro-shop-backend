const express = require('express');
const router = express.Router();
const shopController = require('./shops.controller');
const shopValidation = require('./shops.validation');
const { validate } = require('../../middleware/validation.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/role.middleware');

router.use(authenticate);

router.post('/', authorize('SUPER_ADMIN', 'OWNER'), validate(shopValidation.createShopSchema), shopController.handleCreateShop);
router.get('/', authorize('SUPER_ADMIN', 'OWNER'), shopController.handleGetAllShops);
router.get('/:id', authorize('SUPER_ADMIN', 'OWNER', 'ADMIN'), shopController.handleGetShopById);
router.put('/:id', authorize('SUPER_ADMIN', 'OWNER'), validate(shopValidation.updateShopSchema), shopController.handleUpdateShop);
router.delete('/:id', authorize('SUPER_ADMIN'), shopController.handleDeleteShop);

module.exports = router;
