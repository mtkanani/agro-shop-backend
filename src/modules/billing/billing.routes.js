const express = require('express');
const router = express.Router();
const billingController = require('./billing.controller');
const billingValidation = require('./billing.validation');
const { validate } = require('../../middleware/validation.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { requirePermission } = require('../../middleware/role.middleware');

router.use(authenticate);

// 1. Specific Endpoints (Defined before dynamic /:id routes)
router.get('/summary', requirePermission('BILLING_VIEW'), billingController.handleGetBillingSummary);
router.get('/', requirePermission('BILLING_VIEW'), validate(billingValidation.billingQuerySchema, 'query'), billingController.handleGetAllInvoices);
router.post('/', requirePermission('BILLING_CREATE'), validate(billingValidation.createInvoiceSchema), billingController.handleCreateInvoice);

// 2. Receipt & Cancellation Specific Sub-routes
router.get('/:id/receipt', requirePermission('BILLING_VIEW'), billingController.handleGetInvoiceReceipt);
router.post('/:id/cancel', requirePermission('BILLING_CANCEL'), validate(billingValidation.cancelInvoiceSchema), billingController.handleCancelInvoice);

// 3. Invoice Details Endpoint (Param route defined after sub-routes)
router.get('/:id', requirePermission('BILLING_VIEW'), billingController.handleGetInvoiceById);

module.exports = router;
