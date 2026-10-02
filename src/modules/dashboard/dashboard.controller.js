const dashboardService = require('./dashboard.service');
const { successResponse } = require('../../utils/response');

async function handleGetDashboardSummary(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const summary = await dashboardService.getDashboardSummary(shopId, req.query);
    return successResponse(res, summary, 'Dashboard overview metrics retrieved');
  } catch (error) {
    next(error);
  }
}

async function handleGetSalesTrend(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const trend = await dashboardService.getSalesTrend(shopId, req.query);
    return successResponse(res, trend, 'Dashboard sales trend chart data retrieved');
  } catch (error) {
    next(error);
  }
}

async function handleGetTopProducts(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const topProducts = await dashboardService.getTopProducts(shopId, req.query);
    return successResponse(res, topProducts, 'Top selling products retrieved');
  } catch (error) {
    next(error);
  }
}

async function handleGetLowStockProducts(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const lowStockAlerts = await dashboardService.getLowStockProducts(shopId);
    return successResponse(res, lowStockAlerts, 'Inventory low stock alert products retrieved');
  } catch (error) {
    next(error);
  }
}

async function handleGetCreditSummary(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const creditWidget = await dashboardService.getCreditSummary(shopId);
    return successResponse(res, creditWidget, 'Farmer credit summary widget retrieved');
  } catch (error) {
    next(error);
  }
}

async function handleGetRecentSales(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const limit = req.query.limit || 10;
    const recentSales = await dashboardService.getRecentSales(shopId, limit);
    return successResponse(res, recentSales, 'Recent sales invoices retrieved');
  } catch (error) {
    next(error);
  }
}

async function handleGetRecentPayments(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const limit = req.query.limit || 10;
    const recentPayments = await dashboardService.getRecentPayments(shopId, limit);
    return successResponse(res, recentPayments, 'Recent payments retrieved');
  } catch (error) {
    next(error);
  }
}

async function handleGetRecentRestocks(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const limit = req.query.limit || 10;
    const recentRestocks = await dashboardService.getRecentRestocks(shopId, limit);
    return successResponse(res, recentRestocks, 'Recent restocks retrieved');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  handleGetDashboardSummary,
  handleGetSalesTrend,
  handleGetTopProducts,
  handleGetLowStockProducts,
  handleGetCreditSummary,
  handleGetRecentSales,
  handleGetRecentPayments,
  handleGetRecentRestocks,
};
