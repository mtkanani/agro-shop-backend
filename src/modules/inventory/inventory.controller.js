const inventoryService = require('./inventory.service');
const { successResponse, paginatedResponse } = require('../../utils/response');

async function handleGetInventoryMetrics(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const metrics = await inventoryService.getInventoryMetrics(shopId);
    return successResponse(res, metrics, 'Inventory metrics summary fetched');
  } catch (error) {
    next(error);
  }
}

async function handleGetInventorySummary(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const { inventory, pagination } = await inventoryService.getInventorySummary({ ...req.query, shopId });
    return paginatedResponse(res, inventory, pagination, 'Inventory stock summary fetched');
  } catch (error) {
    next(error);
  }
}

async function handleGetProductInventoryProfile(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? null : req.user.shopId;
    const profile = await inventoryService.getProductInventoryProfile(req.params.productId, shopId);
    return successResponse(res, profile, 'Product inventory profile fetched');
  } catch (error) {
    next(error);
  }
}

async function handleGetProductBatches(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? null : req.user.shopId;
    const batches = await inventoryService.getProductBatches(req.params.productId, shopId);
    return successResponse(res, batches, 'Product inventory batches fetched');
  } catch (error) {
    next(error);
  }
}

async function handleGetLowStock(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const { inventory, pagination } = await inventoryService.getLowStockProducts({ ...req.query, shopId });
    return paginatedResponse(res, inventory, pagination, 'Low stock products fetched');
  } catch (error) {
    next(error);
  }
}

async function handleGetNearExpiry(req, res, next) {
  try {
    const days = parseInt(req.query.days || '30', 10);
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const result = await inventoryService.getNearExpiryBatches(days, shopId, req.query);
    if (result && result.pagination) {
      return paginatedResponse(res, result.batches, result.pagination, `Batches expiring within ${days} days fetched`);
    }
    return successResponse(res, result, `Batches expiring within ${days} days fetched`);
  } catch (error) {
    next(error);
  }
}

async function handleGetExpiredStock(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const result = await inventoryService.getExpiredBatches(shopId, req.query);
    if (result && result.pagination) {
      return paginatedResponse(res, result.batches, result.pagination, 'Expired inventory batches fetched');
    }
    return successResponse(res, result, 'Expired inventory batches fetched');
  } catch (error) {
    next(error);
  }
}

async function handleStockIn(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.body.shopId || req.user.shopId) : req.user.shopId;
    const result = await inventoryService.stockIn({
      ...req.body,
      shopId,
      createdById: req.user.id,
    });
    return successResponse(res, result, 'Stock IN completed successfully', 201);
  } catch (error) {
    next(error);
  }
}

async function handleStockAdjustment(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.body.shopId || req.user.shopId) : req.user.shopId;
    const result = await inventoryService.stockAdjustment({
      ...req.body,
      shopId,
      createdById: req.user.id,
    });
    return successResponse(res, result, 'Stock adjustment completed successfully');
  } catch (error) {
    next(error);
  }
}

async function handleGetStockTransactions(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const { transactions, pagination } = await inventoryService.getStockTransactions({ ...req.query, shopId });
    return paginatedResponse(res, transactions, pagination, 'Stock movement transactions history fetched');
  } catch (error) {
    next(error);
  }
}

async function handleGetInventoryByVariantId(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? null : req.user.shopId;
    const result = await inventoryService.getInventoryByVariantId(req.params.productVariantId, shopId);
    return successResponse(res, result, 'Variant inventory details retrieved');
  } catch (error) {
    next(error);
  }
}

// Retain legacy handlers for backwards compatibility
async function handleAddBatch(req, res, next) {
  return handleStockIn(req, res, next);
}

async function handleGetBatches(req, res, next) {
  return handleGetInventorySummary(req, res, next);
}

async function handleGetExpiringBatches(req, res, next) {
  return handleGetNearExpiry(req, res, next);
}

async function handleAdjustBatchStock(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? null : req.user.shopId;
    const result = await inventoryService.stockAdjustment({
      shopId,
      batchId: req.params.id,
      adjustmentQuantity: req.body.quantity,
      type: req.body.type || 'DECREASE',
      reason: req.body.reason,
      createdById: req.user.id,
    });
    return successResponse(res, result.batch, 'Batch stock level adjusted');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  handleGetInventoryMetrics,
  handleGetInventorySummary,
  handleGetProductInventoryProfile,
  handleGetProductBatches,
  handleGetLowStock,
  handleGetNearExpiry,
  handleGetExpiredStock,
  handleStockIn,
  handleStockAdjustment,
  handleGetStockTransactions,
  handleGetInventoryByVariantId,
  handleAddBatch,
  handleGetBatches,
  handleGetExpiringBatches,
  handleAdjustBatchStock,
};
