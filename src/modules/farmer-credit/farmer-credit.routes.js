const express = require('express');
const router = express.Router();
const farmerCreditController = require('./farmer-credit.controller');
const farmerCreditValidation = require('./farmer-credit.validation');
const { validate } = require('../../middleware/validation.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { requirePermission } = require('../../middleware/role.middleware');

router.use(authenticate);

// 1. Dashboard Overview & Static Endpoints (Defined before dynamic parameters)
router.get('/summary', requirePermission('KHATA_VIEW'), farmerCreditController.handleGetCreditOverview);
router.get('/overdue', requirePermission('KHATA_VIEW'), farmerCreditController.handleGetOverdueInvoices);

// 2. Payments & Receipt Routes
router.post('/payments', requirePermission('PAYMENT_CREATE'), validate(farmerCreditValidation.recordFarmerPaymentSchema), farmerCreditController.handleRecordFarmerPayment);
router.get('/payments/:paymentId/receipt', requirePermission('PAYMENT_VIEW'), farmerCreditController.handleGetPaymentReceipt);
router.post('/payments/:paymentId/reverse', requirePermission('KHATA_MANAGE'), validate(farmerCreditValidation.reversePaymentSchema), farmerCreditController.handleReversePayment);

// 3. Invoice Settlement Route
router.patch('/invoices/:invoiceId/settle', requirePermission('PAYMENT_CREATE'), validate(farmerCreditValidation.settleInvoiceSchema), farmerCreditController.handleSettleInvoiceDue);

// 4. Adjustments Route
router.post('/adjustments', requirePermission('KHATA_MANAGE'), validate(farmerCreditValidation.adjustmentSchema), farmerCreditController.handleCreateCreditAdjustment);

// 5. Farmer-specific Sub-routes
router.get('/farmers/:farmerId/bills-summary', requirePermission('KHATA_VIEW'), farmerCreditController.handleGetFarmerBillsSummary);
router.post('/farmers/:farmerId/send-bills', requirePermission('KHATA_VIEW'), validate(farmerCreditValidation.sendFarmerBillsSchema), farmerCreditController.handleSendFarmerBills);
router.get('/farmers/:farmerId/summary', requirePermission('KHATA_VIEW'), farmerCreditController.handleGetFarmerCreditSummary);
router.get('/farmers/:farmerId/ledger', requirePermission('KHATA_VIEW'), farmerCreditController.handleGetFarmerLedger);
router.patch('/farmers/:farmerId/credit-limit', requirePermission('KHATA_MANAGE'), validate(farmerCreditValidation.updateCreditLimitSchema), farmerCreditController.handleSetCreditLimit);
router.post('/farmers/:farmerId/opening-balance', requirePermission('KHATA_MANAGE'), validate(farmerCreditValidation.openingBalanceSchema), farmerCreditController.handleCreateOpeningBalance);

// 6. Main Farmer Credit Directory Route
router.get('/', requirePermission('KHATA_VIEW'), validate(farmerCreditValidation.farmerCreditQuerySchema, 'query'), farmerCreditController.handleGetFarmerCreditList);

module.exports = router;
