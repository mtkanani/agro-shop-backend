const returnService = require('./returns.service');
const { successResponse } = require('../../utils/response');

async function handleCreateSalesReturn(req, res, next) {
  try {
    const shopId = req.user.shopId;
    const userId = req.user.id;
    const result = await returnService.createSalesReturn(shopId, userId, req.body);
    return successResponse(res, result, 'Sales return created successfully', 201);
  } catch (error) {
    next(error);
  }
}

async function handleGetSalesReturns(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const result = await returnService.getSalesReturns(shopId, req.query);
    return successResponse(res, result, 'Sales returns list retrieved');
  } catch (error) {
    next(error);
  }
}

async function handleGetSalesReturnById(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const result = await returnService.getSalesReturnById(shopId, req.params.id);
    return successResponse(res, result, 'Sales return details retrieved');
  } catch (error) {
    next(error);
  }
}

async function handleReverseSalesReturn(req, res, next) {
  try {
    const shopId = req.user.shopId;
    const userId = req.user.id;
    const result = await returnService.reverseSalesReturn(shopId, userId, req.params.id, req.body.reason);
    return successResponse(res, result, 'Sales return reversed successfully');
  } catch (error) {
    next(error);
  }
}

async function handleCreatePurchaseReturn(req, res, next) {
  try {
    const shopId = req.user.shopId;
    const userId = req.user.id;
    const result = await returnService.createPurchaseReturn(shopId, userId, req.body);
    return successResponse(res, result, 'Purchase return created successfully', 201);
  } catch (error) {
    next(error);
  }
}

async function handleGetPurchaseReturns(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const result = await returnService.getPurchaseReturns(shopId, req.query);
    return successResponse(res, result, 'Purchase returns list retrieved');
  } catch (error) {
    next(error);
  }
}

async function handleGetPurchaseReturnById(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const result = await returnService.getPurchaseReturnById(shopId, req.params.id);
    return successResponse(res, result, 'Purchase return details retrieved');
  } catch (error) {
    next(error);
  }
}

async function handleReversePurchaseReturn(req, res, next) {
  try {
    const shopId = req.user.shopId;
    const userId = req.user.id;
    const result = await returnService.reversePurchaseReturn(shopId, userId, req.params.id, req.body.reason);
    return successResponse(res, result, 'Purchase return reversed successfully');
  } catch (error) {
    next(error);
  }
}

async function handleGetReturnsSummary(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const result = await returnService.getReturnsSummary(shopId, req.query);
    return successResponse(res, result, 'Returns summary metrics retrieved');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  handleCreateSalesReturn,
  handleGetSalesReturns,
  handleGetSalesReturnById,
  handleReverseSalesReturn,
  handleCreatePurchaseReturn,
  handleGetPurchaseReturns,
  handleGetPurchaseReturnById,
  handleReversePurchaseReturn,
  handleGetReturnsSummary,
};
