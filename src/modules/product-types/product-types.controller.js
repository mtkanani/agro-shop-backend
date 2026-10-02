const productTypeService = require('./product-types.service');
const { successResponse, paginatedResponse } = require('../../utils/response');

async function handleCreateProductType(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.body.shopId || req.user.shopId) : req.user.shopId;
    if (!shopId) {
      return res.status(400).json({ success: false, message: 'Shop ID is required' });
    }
    const productType = await productTypeService.createProductType({ ...req.body, shopId });
    return successResponse(res, productType, 'Product Type created successfully', 201);
  } catch (error) {
    next(error);
  }
}

async function handleGetAllProductTypes(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const result = await productTypeService.getAllProductTypes({ ...req.query, shopId });
    if (result && result.pagination) {
      return paginatedResponse(res, result.productTypes, result.pagination, 'Product Types list fetched');
    }
    return successResponse(res, result, 'Product Types list fetched');
  } catch (error) {
    next(error);
  }
}

async function handleGetProductTypeById(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? null : req.user.shopId;
    const productType = await productTypeService.getProductTypeById(req.params.id, shopId);
    return successResponse(res, productType, 'Product Type details retrieved');
  } catch (error) {
    next(error);
  }
}

async function handleUpdateProductType(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? null : req.user.shopId;
    const productType = await productTypeService.updateProductType(req.params.id, shopId, req.body);
    return successResponse(res, productType, 'Product Type updated successfully');
  } catch (error) {
    next(error);
  }
}

async function handleDeleteProductType(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? null : req.user.shopId;
    await productTypeService.deleteProductType(req.params.id, shopId);
    return successResponse(res, null, 'Product Type deactivated successfully');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  handleCreateProductType,
  handleGetAllProductTypes,
  handleGetProductTypeById,
  handleUpdateProductType,
  handleDeleteProductType,
};
