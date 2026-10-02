const revenueService = require('./revenue.service');
const { successResponse, errorResponse } = require('../../utils/response');

function resolveShopId(req) {
  if (req.user && req.user.role === 'SUPER_ADMIN') {
    return req.query.shopId || req.body.shopId || req.user.shopId;
  }
  return req.user ? req.user.shopId : null;
}

/**
 * 1. P&L Revenue & Profit Summary
 */
async function handleGetRevenueSummary(req, res, next) {
  try {
    const shopId = resolveShopId(req);
    if (!shopId) {
      return errorResponse(res, 'Shop ID is required', 400);
    }

    const summary = await revenueService.getRevenueSummary(shopId, req.query);
    return successResponse(res, summary, 'Revenue & Profit summary calculated successfully');
  } catch (error) {
    next(error);
  }
}

/**
 * 2. Revenue & Margins by Product Category
 */
async function handleGetRevenueByCategory(req, res, next) {
  try {
    const shopId = resolveShopId(req);
    if (!shopId) {
      return errorResponse(res, 'Shop ID is required', 400);
    }

    const breakdown = await revenueService.getRevenueByCategory(shopId, req.query);
    return successResponse(res, breakdown, 'Revenue by category retrieved successfully');
  } catch (error) {
    next(error);
  }
}

/**
 * 3. Top Profit-Generating Products
 */
async function handleGetTopProfitProducts(req, res, next) {
  try {
    const shopId = resolveShopId(req);
    if (!shopId) {
      return errorResponse(res, 'Shop ID is required', 400);
    }

    const topProducts = await revenueService.getTopProfitProducts(shopId, req.query);
    return successResponse(res, topProducts, 'Top profit products retrieved successfully');
  } catch (error) {
    next(error);
  }
}

/**
 * 4. Revenue & Profit Timeline Trend
 */
async function handleGetRevenueTrend(req, res, next) {
  try {
    const shopId = resolveShopId(req);
    if (!shopId) {
      return errorResponse(res, 'Shop ID is required', 400);
    }

    const trend = await revenueService.getRevenueTrend(shopId, req.query);
    return successResponse(res, trend, 'Revenue and profit trend retrieved successfully');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  handleGetRevenueSummary,
  handleGetRevenueByCategory,
  handleGetTopProfitProducts,
  handleGetRevenueTrend,
};
