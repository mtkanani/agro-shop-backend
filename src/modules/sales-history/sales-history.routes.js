const express = require('express');
const router = express.Router();
const salesHistoryController = require('./sales-history.controller');
const salesHistoryValidation = require('./sales-history.validation');
const { validate } = require('../../middleware/validation.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { requirePermission } = require('../../middleware/role.middleware');

router.use(authenticate);

// 1. Aggregated Analytics & Metrics (Defined before parameterized routes)
router.get(
  '/metrics',
  requirePermission('SALES_HISTORY_VIEW'),
  validate(salesHistoryValidation.salesMetricsQuerySchema, 'query'),
  salesHistoryController.handleGetSalesMetrics
);

// 2. Item-Level Sales & Batch Traceability
router.get(
  '/items',
  requirePermission('SALES_HISTORY_VIEW'),
  validate(salesHistoryValidation.itemSalesQuerySchema, 'query'),
  salesHistoryController.handleGetItemizedSales
);

// 3. Memory-Safe Streaming CSV Export
router.get(
  '/export',
  requirePermission('SALES_HISTORY_EXPORT'),
  validate(salesHistoryValidation.exportSalesQuerySchema, 'query'),
  salesHistoryController.handleExportSalesHistory
);

// 4. Farmer Purchase Timeline & Profile
router.get(
  '/farmers/:farmerId',
  requirePermission('SALES_HISTORY_VIEW'),
  validate(salesHistoryValidation.farmerSalesQuerySchema, 'query'),
  salesHistoryController.handleGetFarmerSalesTimeline
);

// 5. Deep Historical Sale Audit Detail
router.get(
  '/:id',
  requirePermission('SALES_HISTORY_VIEW'),
  salesHistoryController.handleGetSaleDetailById
);

// 6. Filtered Sales Invoices History with Indexed Pagination
router.get(
  '/',
  requirePermission('SALES_HISTORY_VIEW'),
  validate(salesHistoryValidation.salesHistoryQuerySchema, 'query'),
  salesHistoryController.handleGetSalesHistory
);

module.exports = router;
