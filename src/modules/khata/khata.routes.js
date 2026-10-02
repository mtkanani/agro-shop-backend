const express = require('express');
const router = express.Router();
const khataController = require('./khata.controller');
const khataValidation = require('./khata.validation');
const { validate } = require('../../middleware/validation.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { requirePermission } = require('../../middleware/role.middleware');

router.use(authenticate);

router.get('/farmer/:farmerId', requirePermission('KHATA_VIEW'), khataController.handleGetFarmerLedger);
router.get('/supplier/:supplierId', requirePermission('KHATA_VIEW'), khataController.handleGetSupplierLedger);
router.post('/entry', requirePermission('KHATA_MANAGE'), validate(khataValidation.manualKhataEntrySchema), khataController.handleAddManualKhataEntry);

module.exports = router;
