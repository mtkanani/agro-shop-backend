const reportService = require('./reports.service');
const { successResponse } = require('../../utils/response');

async function handleGetSalesReport(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const report = await reportService.getSalesReport({ ...req.query, shopId });
    return successResponse(res, report, 'Sales report generated');
  } catch (error) {
    next(error);
  }
}

async function handleGetPurchasesReport(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const report = await reportService.getPurchasesReport({ ...req.query, shopId });
    return successResponse(res, report, 'Purchases report generated');
  } catch (error) {
    next(error);
  }
}

async function handleGetProfitReport(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const report = await reportService.getProfitReport({ ...req.query, shopId });
    return successResponse(res, report, 'Profit & margin report generated');
  } catch (error) {
    next(error);
  }
}

async function handleGetProductSalesReport(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const report = await reportService.getProductSalesReport({ ...req.query, shopId });
    return successResponse(res, report, 'Product sales report generated');
  } catch (error) {
    next(error);
  }
}

async function handleGetProductPurchasesReport(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const report = await reportService.getProductPurchasesReport({ ...req.query, shopId });
    return successResponse(res, report, 'Product purchases report generated');
  } catch (error) {
    next(error);
  }
}

async function handleGetCategorySalesReport(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const report = await reportService.getCategorySalesReport({ ...req.query, shopId });
    return successResponse(res, report, 'Category sales report generated');
  } catch (error) {
    next(error);
  }
}

async function handleGetFarmerSalesReport(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const report = await reportService.getFarmerSalesReport({ ...req.query, shopId });
    return successResponse(res, report, 'Farmer sales report generated');
  } catch (error) {
    next(error);
  }
}

async function handleGetSupplierPurchasesReport(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const report = await reportService.getSupplierPurchasesReport({ ...req.query, shopId });
    return successResponse(res, report, 'Supplier purchases report generated');
  } catch (error) {
    next(error);
  }
}

async function handleGetPaymentCollectionReport(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const report = await reportService.getPaymentCollectionReport({ ...req.query, shopId });
    return successResponse(res, report, 'Payment collection report generated');
  } catch (error) {
    next(error);
  }
}

async function handleGetCreditReport(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const report = await reportService.getCreditReport({ ...req.query, shopId });
    return successResponse(res, report, 'Credit & due report generated');
  } catch (error) {
    next(error);
  }
}

async function handleGetInventoryMovementReport(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const report = await reportService.getInventoryMovementReport({ ...req.query, shopId });
    return successResponse(res, report, 'Inventory movement report generated');
  } catch (error) {
    next(error);
  }
}

async function handleGetDailySummary(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const summary = await reportService.getDailySummary(shopId, req.query.date);
    return successResponse(res, summary, 'Daily summary report generated');
  } catch (error) {
    next(error);
  }
}

async function handleGetMonthlySummary(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const summary = await reportService.getMonthlySummary(shopId, req.query.year, req.query.month);
    return successResponse(res, summary, 'Monthly summary report generated');
  } catch (error) {
    next(error);
  }
}

async function handleGetSalesTrend(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const trend = await reportService.getSalesTrend(shopId, req.query);
    return successResponse(res, trend, 'Sales trend chart data generated');
  } catch (error) {
    next(error);
  }
}

async function handleGetPurchasesTrend(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const trend = await reportService.getPurchasesTrend(shopId, req.query);
    return successResponse(res, trend, 'Purchases trend chart data generated');
  } catch (error) {
    next(error);
  }
}

async function handleGetProfitTrend(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const trend = await reportService.getProfitTrend(shopId, req.query);
    return successResponse(res, trend, 'Profit trend chart data generated');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  handleGetSalesReport,
  handleGetPurchasesReport,
  handleGetProfitReport,
  handleGetProductSalesReport,
  handleGetProductPurchasesReport,
  handleGetCategorySalesReport,
  handleGetFarmerSalesReport,
  handleGetSupplierPurchasesReport,
  handleGetPaymentCollectionReport,
  handleGetCreditReport,
  handleGetInventoryMovementReport,
  handleGetDailySummary,
  handleGetMonthlySummary,
  handleGetSalesTrend,
  handleGetPurchasesTrend,
  handleGetProfitTrend,
};
