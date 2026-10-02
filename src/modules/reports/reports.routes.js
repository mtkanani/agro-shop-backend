const express = require('express');
const router = express.Router();
const reportController = require('./reports.controller');
const reportValidation = require('./reports.validation');
const { validate } = require('../../middleware/validation.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { requirePermission } = require('../../middleware/role.middleware');

router.use(authenticate);

// 1. Static & Trend Endpoints (Defined before generic sub-routes)
router.get('/daily', requirePermission('REPORT_VIEW'), validate(reportValidation.reportQuerySchema, 'query'), reportController.handleGetDailySummary);
router.get('/monthly', requirePermission('REPORT_VIEW'), validate(reportValidation.reportQuerySchema, 'query'), reportController.handleGetMonthlySummary);
router.get('/sales/trend', requirePermission('REPORT_VIEW'), validate(reportValidation.reportQuerySchema, 'query'), reportController.handleGetSalesTrend);
router.get('/purchases/trend', requirePermission('REPORT_VIEW'), validate(reportValidation.reportQuerySchema, 'query'), reportController.handleGetPurchasesTrend);
router.get('/profit/trend', requirePermission('REPORT_VIEW'), validate(reportValidation.reportQuerySchema, 'query'), reportController.handleGetProfitTrend);

// 2. Specific Sub-Entity Reports
router.get('/products/sales', requirePermission('REPORT_VIEW'), validate(reportValidation.reportQuerySchema, 'query'), reportController.handleGetProductSalesReport);
router.get('/products/purchases', requirePermission('REPORT_VIEW'), validate(reportValidation.reportQuerySchema, 'query'), reportController.handleGetProductPurchasesReport);
router.get('/categories/sales', requirePermission('REPORT_VIEW'), validate(reportValidation.reportQuerySchema, 'query'), reportController.handleGetCategorySalesReport);
router.get('/farmers/sales', requirePermission('REPORT_VIEW'), validate(reportValidation.reportQuerySchema, 'query'), reportController.handleGetFarmerSalesReport);
router.get('/suppliers/purchases', requirePermission('REPORT_VIEW'), validate(reportValidation.reportQuerySchema, 'query'), reportController.handleGetSupplierPurchasesReport);

// 3. Core Report Endpoints
router.get('/sales', requirePermission('REPORT_VIEW'), validate(reportValidation.reportQuerySchema, 'query'), reportController.handleGetSalesReport);
router.get('/purchases', requirePermission('REPORT_VIEW'), validate(reportValidation.reportQuerySchema, 'query'), reportController.handleGetPurchasesReport);
router.get('/profit', requirePermission('REPORT_VIEW'), validate(reportValidation.reportQuerySchema, 'query'), reportController.handleGetProfitReport);
router.get('/payments', requirePermission('REPORT_VIEW'), validate(reportValidation.reportQuerySchema, 'query'), reportController.handleGetPaymentCollectionReport);
router.get('/credit', requirePermission('REPORT_VIEW'), validate(reportValidation.reportQuerySchema, 'query'), reportController.handleGetCreditReport);
router.get('/inventory', requirePermission('REPORT_VIEW'), validate(reportValidation.reportQuerySchema, 'query'), reportController.handleGetInventoryMovementReport);

module.exports = router;
