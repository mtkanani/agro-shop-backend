const express = require('express');
const router = express.Router();
const inventoryController = require('./inventory.controller');
const inventoryValidation = require('./inventory.validation');
const { validate } = require('../../middleware/validation.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { requirePermission } = require('../../middleware/role.middleware');

router.use(authenticate);

// 1. Dashboard & General Inventory Read Endpoints
router.get('/metrics', requirePermission('INVENTORY_VIEW'), inventoryController.handleGetInventoryMetrics);
router.get('/', requirePermission('INVENTORY_VIEW'), validate(inventoryValidation.inventoryQuerySchema, 'query'), inventoryController.handleGetInventorySummary);
router.get('/low-stock', requirePermission('INVENTORY_VIEW'), inventoryController.handleGetLowStock);
router.get('/near-expiry', requirePermission('INVENTORY_VIEW'), inventoryController.handleGetNearExpiry);
router.get('/expired', requirePermission('INVENTORY_VIEW'), inventoryController.handleGetExpiredStock);
router.get('/transactions', requirePermission('INVENTORY_VIEW'), validate(inventoryValidation.historyQuerySchema, 'query'), inventoryController.handleGetStockTransactions);
router.get('/expiring', requirePermission('INVENTORY_VIEW'), inventoryController.handleGetExpiringBatches);
router.get('/batches', requirePermission('INVENTORY_VIEW'), inventoryController.handleGetBatches);

// 2. Stock Intake & Stock Adjustment Operational Endpoints
router.post('/stock-in', requirePermission('INVENTORY_MANAGE'), validate(inventoryValidation.stockInSchema), inventoryController.handleStockIn);
router.post('/stock-adjustment', requirePermission('INVENTORY_MANAGE'), validate(inventoryValidation.stockAdjustmentSchema), inventoryController.handleStockAdjustment);
router.post('/adjustments', requirePermission('INVENTORY_MANAGE'), validate(inventoryValidation.stockAdjustmentSchema), inventoryController.handleStockAdjustment);
router.post('/batches', requirePermission('INVENTORY_MANAGE'), validate(inventoryValidation.createBatchSchema), inventoryController.handleAddBatch);

router.patch('/batches/:id/adjust', requirePermission('INVENTORY_MANAGE'), validate(inventoryValidation.adjustStockSchema), inventoryController.handleAdjustBatchStock);

// 3. Product Inventory Specific Endpoints (Param routes defined after named routes)
router.get('/product/:productId', requirePermission('INVENTORY_VIEW'), inventoryController.handleGetProductInventoryProfile);
router.get('/product/:productId/batches', requirePermission('INVENTORY_VIEW'), inventoryController.handleGetProductBatches);
router.get('/product/:productId/history', requirePermission('INVENTORY_VIEW'), inventoryController.handleGetStockTransactions);
router.get('/:productVariantId', requirePermission('INVENTORY_VIEW'), inventoryController.handleGetInventoryByVariantId);

module.exports = router;
