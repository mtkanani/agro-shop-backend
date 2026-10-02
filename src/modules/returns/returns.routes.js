const express = require('express');
const router = express.Router();
const returnController = require('./returns.controller');
const returnValidation = require('./returns.validation');
const { validate } = require('../../middleware/validation.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { requirePermission, requireRole } = require('../../middleware/role.middleware');

router.use(authenticate);

// Summary API
router.get('/summary', requirePermission('REPORT_VIEW'), validate(returnValidation.returnQuerySchema, 'query'), returnController.handleGetReturnsSummary);

// Sales Return Endpoints
router.post('/sales', requirePermission('BILLING_CREATE'), validate(returnValidation.createSalesReturnSchema), returnController.handleCreateSalesReturn);
router.get('/sales', requirePermission('BILLING_VIEW', 'REPORT_VIEW'), validate(returnValidation.returnQuerySchema, 'query'), returnController.handleGetSalesReturns);
router.get('/sales/:id', requirePermission('BILLING_VIEW'), returnController.handleGetSalesReturnById);
router.post('/sales/:id/reverse', requireRole('OWNER', 'SUPER_ADMIN'), validate(returnValidation.reverseReturnSchema), returnController.handleReverseSalesReturn);

// Purchase Return Endpoints
router.post('/purchases', requirePermission('PRODUCT_CREATE'), validate(returnValidation.createPurchaseReturnSchema), returnController.handleCreatePurchaseReturn);
router.get('/purchases', requirePermission('PRODUCT_VIEW', 'REPORT_VIEW'), validate(returnValidation.returnQuerySchema, 'query'), returnController.handleGetPurchaseReturns);
router.get('/purchases/:id', requirePermission('PRODUCT_VIEW'), returnController.handleGetPurchaseReturnById);
router.post('/purchases/:id/reverse', requireRole('OWNER', 'SUPER_ADMIN'), validate(returnValidation.reverseReturnSchema), returnController.handleReversePurchaseReturn);

module.exports = router;
