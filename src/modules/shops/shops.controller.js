const shopService = require('./shops.service');
const { successResponse, paginatedResponse } = require('../../utils/response');

async function handleCreateShop(req, res, next) {
  try {
    const shop = await shopService.createShop(req.body);
    return successResponse(res, shop, 'Shop created successfully', 201);
  } catch (error) {
    next(error);
  }
}

async function handleGetAllShops(req, res, next) {
  try {
    const { shops, pagination } = await shopService.getAllShops(req.query);
    return paginatedResponse(res, shops, pagination, 'Shops retrieved successfully');
  } catch (error) {
    next(error);
  }
}

async function handleGetShopById(req, res, next) {
  try {
    const shop = await shopService.getShopById(req.params.id);
    return successResponse(res, shop, 'Shop details retrieved');
  } catch (error) {
    next(error);
  }
}

async function handleUpdateShop(req, res, next) {
  try {
    const shop = await shopService.updateShop(req.params.id, req.body);
    return successResponse(res, shop, 'Shop updated successfully');
  } catch (error) {
    next(error);
  }
}

async function handleDeleteShop(req, res, next) {
  try {
    await shopService.deleteShop(req.params.id);
    return successResponse(res, null, 'Shop deactivated successfully');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  handleCreateShop,
  handleGetAllShops,
  handleGetShopById,
  handleUpdateShop,
  handleDeleteShop,
};
