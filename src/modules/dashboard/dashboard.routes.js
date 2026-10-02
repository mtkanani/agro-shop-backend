const express = require('express');
const router = express.Router();
const dashboardController = require('./dashboard.controller');
const dashboardValidation = require('./dashboard.validation');
const { validate } = require('../../middleware/validation.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { requirePermission } = require('../../middleware/role.middleware');

router.use(authenticate);

// Dashboard Widgets & Endpoints
router.get('/summary', requirePermission('REPORT_VIEW', 'INVENTORY_VIEW'), validate(dashboardValidation.dashboardQuerySchema, 'query'), dashboardController.handleGetDashboardSummary);
router.get('/sales-trend', requirePermission('REPORT_VIEW'), validate(dashboardValidation.dashboardQuerySchema, 'query'), dashboardController.handleGetSalesTrend);
router.get('/top-products', requirePermission('REPORT_VIEW'), validate(dashboardValidation.dashboardQuerySchema, 'query'), dashboardController.handleGetTopProducts);
router.get('/low-stock', requirePermission('INVENTORY_VIEW'), dashboardController.handleGetLowStockProducts);
router.get('/credit', requirePermission('KHATA_VIEW'), dashboardController.handleGetCreditSummary);

// Recent Activity Endpoints
router.get('/recent-sales', requirePermission('BILLING_VIEW'), dashboardController.handleGetRecentSales);
router.get('/recent-payments', requirePermission('PAYMENT_VIEW'), dashboardController.handleGetRecentPayments);
router.get('/recent-restocks', requirePermission('PRODUCT_VIEW'), dashboardController.handleGetRecentRestocks);

module.exports = router;
