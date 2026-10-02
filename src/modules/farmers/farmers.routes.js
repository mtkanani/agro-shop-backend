const express = require('express');
const router = express.Router();
const farmerController = require('./farmers.controller');
const farmerValidation = require('./farmers.validation');
const { validate } = require('../../middleware/validation.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { requirePermission } = require('../../middleware/role.middleware');

router.use(authenticate);

// Standard Farmer CRUD
router.post('/', requirePermission('FARMER_CREATE'), validate(farmerValidation.createFarmerSchema), farmerController.handleCreateFarmer);
router.get('/', requirePermission('FARMER_VIEW'), farmerController.handleGetAllFarmers);
router.get('/:id', requirePermission('FARMER_VIEW'), farmerController.handleGetFarmerById);
router.put('/:id', requirePermission('FARMER_UPDATE'), validate(farmerValidation.updateFarmerSchema), farmerController.handleUpdateFarmer);
router.delete('/:id', requirePermission('FARMER_DELETE'), farmerController.handleDeleteFarmer);

// Additional Farmer Detail & Financial Endpoints
router.get('/:id/khata', requirePermission('KHATA_VIEW'), farmerController.handleGetFarmerKhata);
router.get('/:id/bills', requirePermission('BILL_VIEW'), farmerController.handleGetFarmerBills);
router.get('/:id/payments', requirePermission('PAYMENT_VIEW'), farmerController.handleGetFarmerPayments);
router.post('/:id/payments', requirePermission('PAYMENT_CREATE'), validate(farmerValidation.recordFarmerPaymentSchema), farmerController.handleRecordFarmerPayment);
router.get('/:id/outstanding', requirePermission('FARMER_VIEW'), farmerController.handleGetFarmerOutstanding);

module.exports = router;
