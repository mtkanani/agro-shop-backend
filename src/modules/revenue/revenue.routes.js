const express = require('express');
const router = express.Router();
const revenueController = require('./revenue.controller');
const revenueValidation = require('./revenue.validation');
const { validate } = require('../../middleware/validation.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { requirePermission } = require('../../middleware/role.middleware');

router.use(authenticate);

// 1. P&L Revenue & Profit Summary
router.get(
  '/summary',
  requirePermission('REVENUE_VIEW'),
  validate(revenueValidation.revenueQuerySchema, 'query'),
  revenueController.handleGetRevenueSummary
);

// 2. Revenue & Margins by Category
router.get(
  '/by-category',
  requirePermission('REVENUE_VIEW'),
  validate(revenueValidation.revenueQuerySchema, 'query'),
  revenueController.handleGetRevenueByCategory
);

// 3. Top Profit-Making Products
router.get(
  '/top-products',
  requirePermission('REVENUE_VIEW'),
  validate(revenueValidation.revenueQuerySchema, 'query'),
  revenueController.handleGetTopProfitProducts
);

// 4. Time-Series Revenue & Profit Trend
router.get(
  '/trend',
  requirePermission('REVENUE_VIEW'),
  validate(revenueValidation.revenueQuerySchema, 'query'),
  revenueController.handleGetRevenueTrend
);

module.exports = router;
