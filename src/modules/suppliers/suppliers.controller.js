const supplierService = require('./suppliers.service');
const { successResponse, paginatedResponse } = require('../../utils/response');

async function handleCreateSupplier(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.body.shopId || req.user.shopId) : req.user.shopId;
    const supplier = await supplierService.createSupplier({ ...req.body, shopId, userId: req.user.id });
    return successResponse(res, supplier, 'Supplier profile created successfully', 201);
  } catch (error) {
    next(error);
  }
}

async function handleGetAllSuppliers(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const { suppliers, pagination } = await supplierService.getAllSuppliers({ ...req.query, shopId });
    return paginatedResponse(res, suppliers, pagination, 'Suppliers list fetched');
  } catch (error) {
    next(error);
  }
}

async function handleGetSupplierById(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? null : req.user.shopId;
    const supplier = await supplierService.getSupplierById(req.params.id, shopId);
    return successResponse(res, supplier, 'Supplier details retrieved');
  } catch (error) {
    next(error);
  }
}

async function handleUpdateSupplier(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? null : req.user.shopId;
    const supplier = await supplierService.updateSupplier(req.params.id, shopId, { ...req.body, userId: req.user.id });
    return successResponse(res, supplier, 'Supplier profile updated successfully');
  } catch (error) {
    next(error);
  }
}

async function handleDeleteSupplier(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? null : req.user.shopId;
    await supplierService.deleteSupplier(req.params.id, shopId);
    return successResponse(res, null, 'Supplier profile deactivated');
  } catch (error) {
    next(error);
  }
}

async function handleGetSupplierTransactions(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? null : req.user.shopId;
    const result = await supplierService.getSupplierTransactions(req.params.id, shopId, req.query);
    return paginatedResponse(res, result.batches, result.pagination, 'Supplier purchase transaction history fetched');
  } catch (error) {
    next(error);
  }
}

async function handleGetSupplierProducts(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? null : req.user.shopId;
    const result = await supplierService.getSupplierProducts(req.params.id, shopId);
    return successResponse(res, result, 'Supplier supplied products catalog fetched');
  } catch (error) {
    next(error);
  }
}

async function handleGetSupplierOutstanding(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? null : req.user.shopId;
    const outstanding = await supplierService.getSupplierOutstanding(req.params.id, shopId);
    return successResponse(res, outstanding, 'Supplier outstanding dues fetched');
  } catch (error) {
    next(error);
  }
}

async function handleRecordSupplierPayment(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? null : req.user.shopId;
    const payment = await supplierService.recordSupplierPayment(req.params.id, shopId, { ...req.body, userId: req.user.id });
    return successResponse(res, payment, 'Supplier payout payment recorded and khata debited successfully', 201);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  handleCreateSupplier,
  handleGetAllSuppliers,
  handleGetSupplierById,
  handleUpdateSupplier,
  handleDeleteSupplier,
  handleGetSupplierTransactions,
  handleGetSupplierProducts,
  handleGetSupplierOutstanding,
  handleRecordSupplierPayment,
};
