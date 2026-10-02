const categoryService = require('./categories.service');
const { successResponse, paginatedResponse } = require('../../utils/response');

async function handleCreateCategory(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.body.shopId || req.user.shopId) : req.user.shopId;
    if (!shopId) {
      return res.status(400).json({ success: false, message: 'Shop ID is required' });
    }
    const category = await categoryService.createCategory({ ...req.body, shopId });
    return successResponse(res, category, 'Category created successfully', 201);
  } catch (error) {
    next(error);
  }
}

async function handleGetAllCategories(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const result = await categoryService.getAllCategories({ ...req.query, shopId });
    if (result && result.pagination) {
      return paginatedResponse(res, result.categories, result.pagination, 'Categories list fetched');
    }
    return successResponse(res, result, 'Categories list fetched');
  } catch (error) {
    next(error);
  }
}

async function handleGetCategoryById(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? null : req.user.shopId;
    const category = await categoryService.getCategoryById(req.params.id, shopId);
    return successResponse(res, category, 'Category details retrieved');
  } catch (error) {
    next(error);
  }
}

async function handleUpdateCategory(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? null : req.user.shopId;
    const category = await categoryService.updateCategory(req.params.id, shopId, req.body);
    return successResponse(res, category, 'Category updated successfully');
  } catch (error) {
    next(error);
  }
}

async function handleDeleteCategory(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? null : req.user.shopId;
    await categoryService.deleteCategory(req.params.id, shopId);
    return successResponse(res, null, 'Category deleted successfully');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  handleCreateCategory,
  handleGetAllCategories,
  handleGetCategoryById,
  handleUpdateCategory,
  handleDeleteCategory,
};
