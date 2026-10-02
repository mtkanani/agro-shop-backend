const restockService = require('./restocks.service');
const { successResponse, paginatedResponse } = require('../../utils/response');

async function handleCreateRestock(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.body.shopId || req.user.shopId) : req.user.shopId;
    if (!shopId) {
      return res.status(400).json({ success: false, message: 'Shop ID is required' });
    }

    const restock = await restockService.createRestock({
      ...req.body,
      shopId,
      userId: req.user.id,
    });

    return successResponse(res, restock, 'Stock restocked successfully', 201);
  } catch (error) {
    next(error);
  }
}

async function handleGetAllRestocks(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const { restocks, pagination } = await restockService.getAllRestocks({ ...req.query, shopId });
    return paginatedResponse(res, restocks, pagination, 'Restock history retrieved');
  } catch (error) {
    next(error);
  }
}

async function handleGetRestockById(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? null : req.user.shopId;
    const restock = await restockService.getRestockById(req.params.id, shopId);
    return successResponse(res, restock, 'Restock details retrieved');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  handleCreateRestock,
  handleGetAllRestocks,
  handleGetRestockById,
};
