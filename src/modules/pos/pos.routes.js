const express = require('express');
const router = express.Router();
const posController = require('./pos.controller');
const posValidation = require('./pos.validation');
const { validate } = require('../../middleware/validation.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { requirePermission } = require('../../middleware/role.middleware');

router.use(authenticate);

// 1. Single-Scan Fast Lookup (Barcode / Shortcode / QR Payload)
router.get(
  '/scan',
  requirePermission('BILLING_VIEW'),
  validate(posValidation.scanQuerySchema, 'query'),
  posController.handleScanLookup
);

// 2. Counter Catalogue Generation with Keyset / Cursor Pagination
router.get(
  '/catalogue',
  requirePermission('BILLING_VIEW'),
  validate(posValidation.catalogueQuerySchema, 'query'),
  posController.handleGetCatalogue
);

module.exports = router;
