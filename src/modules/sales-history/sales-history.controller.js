const salesHistoryService = require('./sales-history.service');
const { successResponse, paginatedResponse, errorResponse } = require('../../utils/response');

function resolveShopId(req) {
  if (req.user.role === 'SUPER_ADMIN') {
    return req.query.shopId || req.body.shopId || req.user.shopId;
  }
  return req.user.shopId;
}

/**
 * 1. Filtered Invoices Sales History
 */
async function handleGetSalesHistory(req, res, next) {
  try {
    const shopId = resolveShopId(req);
    if (!shopId) {
      return errorResponse(res, 'Shop ID is required', 400);
    }

    const { invoices, pagination } = await salesHistoryService.getSalesHistory(shopId, req.query);
    return paginatedResponse(res, invoices, pagination, 'Sales history retrieved successfully');
  } catch (error) {
    next(error);
  }
}

/**
 * 2. Instant Aggregated Metrics for Filtered Sales
 */
async function handleGetSalesMetrics(req, res, next) {
  try {
    const shopId = resolveShopId(req);
    if (!shopId) {
      return errorResponse(res, 'Shop ID is required', 400);
    }

    const metrics = await salesHistoryService.getSalesMetrics(shopId, req.query);
    return successResponse(res, metrics, 'Sales history metrics retrieved successfully');
  } catch (error) {
    next(error);
  }
}

/**
 * 3. Itemized Product & Batch Traceability Ledger
 */
async function handleGetItemizedSales(req, res, next) {
  try {
    const shopId = resolveShopId(req);
    if (!shopId) {
      return errorResponse(res, 'Shop ID is required', 400);
    }

    const { items, pagination } = await salesHistoryService.getItemizedSalesHistory(shopId, req.query);
    return paginatedResponse(res, items, pagination, 'Itemized sales history retrieved successfully');
  } catch (error) {
    next(error);
  }
}

/**
 * 4. Comprehensive Farmer Purchase History & Profile
 */
async function handleGetFarmerSalesTimeline(req, res, next) {
  try {
    const shopId = resolveShopId(req);
    if (!shopId) {
      return errorResponse(res, 'Shop ID is required', 400);
    }

    const profile = await salesHistoryService.getFarmerSalesTimeline(shopId, req.params.farmerId, req.query);
    return successResponse(res, profile, 'Farmer sales profile and purchase history retrieved');
  } catch (error) {
    next(error);
  }
}

/**
 * 5. Deep 360° Historical Sale Audit View
 */
async function handleGetSaleDetailById(req, res, next) {
  try {
    const shopId = resolveShopId(req);
    if (!shopId) {
      return errorResponse(res, 'Shop ID is required', 400);
    }

    const detail = await salesHistoryService.getSaleDetailById(shopId, req.params.id);
    return successResponse(res, detail, 'Historical sale details retrieved successfully');
  } catch (error) {
    next(error);
  }
}

/**
 * 6. Memory-Safe Streaming CSV Export
 */
async function handleExportSalesHistory(req, res, next) {
  try {
    const shopId = resolveShopId(req);
    if (!shopId) {
      return errorResponse(res, 'Shop ID is required', 400);
    }

    const result = await salesHistoryService.exportSalesHistory(shopId, req.query);

    if (result.contentType === 'text/csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="sales_history_${Date.now()}.csv"`);
      return res.status(200).send(result.data);
    }

    return successResponse(res, result.data, 'Sales history export generated successfully');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  handleGetSalesHistory,
  handleGetSalesMetrics,
  handleGetItemizedSales,
  handleGetFarmerSalesTimeline,
  handleGetSaleDetailById,
  handleExportSalesHistory,
};
