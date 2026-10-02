const cashClosingService = require('./cash-closing.service');
const { successResponse, paginatedResponse } = require('../../utils/response');

async function handleOpenCashRegister(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.body.shopId || req.user.shopId) : req.user.shopId;
    const session = await cashClosingService.openCashRegister(req.user.id, {
      ...req.body,
      shopId,
    });
    return successResponse(res, session, 'Cash counter session opened', 201);
  } catch (error) {
    next(error);
  }
}

async function handleCloseCashRegister(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? null : req.user.shopId;
    const session = await cashClosingService.closeCashRegister(req.params.id, shopId, req.body);
    return successResponse(res, session, 'Cash counter register closed successfully');
  } catch (error) {
    next(error);
  }
}

async function handleGetCashClosings(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const { records, pagination } = await cashClosingService.getCashClosings({ ...req.query, shopId });
    return paginatedResponse(res, records, pagination, 'Cash closing sessions history fetched');
  } catch (error) {
    next(error);
  }
}

async function handleGetCashClosingById(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? null : req.user.shopId;
    const session = await cashClosingService.getCashClosingById(req.params.id, shopId);
    return successResponse(res, session, 'Cash session details retrieved');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  handleOpenCashRegister,
  handleCloseCashRegister,
  handleGetCashClosings,
  handleGetCashClosingById,
};
