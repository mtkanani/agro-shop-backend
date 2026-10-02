const productService = require('./products.service');
const { successResponse, paginatedResponse } = require('../../utils/response');

async function handleCreateProduct(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.body.shopId || req.user.shopId) : req.user.shopId;
    const product = await productService.createProduct({ ...req.body, shopId });
    return successResponse(res, product, 'Product added to catalog', 201);
  } catch (error) {
    next(error);
  }
}

async function handleGetAllProducts(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const { products, pagination } = await productService.getAllProducts({ ...req.query, shopId });
    return paginatedResponse(res, products, pagination, 'Products list fetched');
  } catch (error) {
    next(error);
  }
}

async function handleGetProductById(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? null : req.user.shopId;
    const product = await productService.getProductById(req.params.id, shopId);
    return successResponse(res, product, 'Product details retrieved');
  } catch (error) {
    next(error);
  }
}

async function handleUpdateProduct(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? null : req.user.shopId;
    const product = await productService.updateProduct(req.params.id, shopId, req.body);
    return successResponse(res, product, 'Product details updated');
  } catch (error) {
    next(error);
  }
}

async function handleDeleteProduct(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? null : req.user.shopId;
    await productService.deleteProduct(req.params.id, shopId);
    return successResponse(res, null, 'Product deactivated');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  handleCreateProduct,
  handleGetAllProducts,
  handleGetProductById,
  handleUpdateProduct,
  handleDeleteProduct,
};
