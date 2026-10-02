const express = require('express');
const router = express.Router();
const settingController = require('./settings.controller');
const settingValidation = require('./settings.validation');
const { validate } = require('../../middleware/validation.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');

router.use(authenticate);

// Read-only settings and audit logs
router.get('/', settingController.handleGetAllSettings);
router.get('/audit-logs', requireRole(['OWNER', 'SUPER_ADMIN']), settingController.handleGetAuditLogs);

// Owner-only domain settings update endpoints
router.put('/shop', requireRole(['OWNER', 'SUPER_ADMIN']), validate(settingValidation.updateShopProfileSchema), settingController.handleUpdateShopProfile);
router.put('/profile', requireRole(['OWNER', 'SUPER_ADMIN']), validate(settingValidation.updateOwnerProfileSchema), settingController.handleUpdateOwnerProfile);
router.put('/billing', requireRole(['OWNER', 'SUPER_ADMIN']), validate(settingValidation.updateBillingSettingsSchema), settingController.handleUpdateBillingSettings);
router.put('/tax', requireRole(['OWNER', 'SUPER_ADMIN']), validate(settingValidation.updateTaxSettingsSchema), settingController.handleUpdateTaxSettings);
router.put('/inventory', requireRole(['OWNER', 'SUPER_ADMIN']), validate(settingValidation.updateInventorySettingsSchema), settingController.handleUpdateInventorySettings);
router.put('/credit', requireRole(['OWNER', 'SUPER_ADMIN']), validate(settingValidation.updateCreditSettingsSchema), settingController.handleUpdateCreditSettings);
router.put('/regional', requireRole(['OWNER', 'SUPER_ADMIN']), validate(settingValidation.updateRegionalSettingsSchema), settingController.handleUpdateRegionalSettings);
router.put('/invoice', requireRole(['OWNER', 'SUPER_ADMIN']), validate(settingValidation.updateInvoiceSettingsSchema), settingController.handleUpdateInvoiceSettings);
router.patch('/language', requireRole(['OWNER', 'SUPER_ADMIN']), settingController.handleUpdateShopLanguage);
router.put('/language', requireRole(['OWNER', 'SUPER_ADMIN']), settingController.handleUpdateShopLanguage);

module.exports = router;
