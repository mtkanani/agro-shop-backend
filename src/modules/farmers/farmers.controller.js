const farmerService = require('./farmers.service');
const { successResponse, paginatedResponse } = require('../../utils/response');

async function handleCreateFarmer(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.body.shopId || req.user.shopId) : req.user.shopId;
    if (!shopId) {
      return res.status(400).json({ success: false, message: 'Shop ID is required' });
    }
    const farmer = await farmerService.createFarmer({ ...req.body, shopId });
    return successResponse(res, farmer, 'Farmer profile created successfully', 201);
  } catch (error) {
    next(error);
  }
}

async function handleGetAllFarmers(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const { farmers, pagination } = await farmerService.getAllFarmers({ ...req.query, shopId });
    return paginatedResponse(res, farmers, pagination, 'Farmers list fetched');
  } catch (error) {
    next(error);
  }
}

async function handleGetFarmerById(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? null : req.user.shopId;
    const farmer = await farmerService.getFarmerById(req.params.id, shopId);
    return successResponse(res, farmer, 'Farmer details retrieved');
  } catch (error) {
    next(error);
  }
}

async function handleUpdateFarmer(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? null : req.user.shopId;
    const farmer = await farmerService.updateFarmer(req.params.id, shopId, req.body);
    return successResponse(res, farmer, 'Farmer profile updated');
  } catch (error) {
    next(error);
  }
}

async function handleDeleteFarmer(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? null : req.user.shopId;
    await farmerService.deleteFarmer(req.params.id, shopId);
    return successResponse(res, null, 'Farmer profile deactivated');
  } catch (error) {
    next(error);
  }
}

async function handleGetFarmerKhata(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? null : req.user.shopId;
    const result = await farmerService.getFarmerKhata(req.params.id, shopId, req.query);
    return paginatedResponse(res, result.transactions, result.pagination, 'Farmer khata ledger fetched');
  } catch (error) {
    next(error);
  }
}

async function handleGetFarmerBills(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? null : req.user.shopId;
    const result = await farmerService.getFarmerBills(req.params.id, shopId, req.query);
    return paginatedResponse(res, result.bills, result.pagination, 'Farmer billing history fetched');
  } catch (error) {
    next(error);
  }
}

async function handleGetFarmerPayments(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? null : req.user.shopId;
    const result = await farmerService.getFarmerPayments(req.params.id, shopId, req.query);
    return paginatedResponse(res, result.payments, result.pagination, 'Farmer payment history fetched');
  } catch (error) {
    next(error);
  }
}

async function handleGetFarmerOutstanding(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? null : req.user.shopId;
    const outstanding = await farmerService.getFarmerOutstanding(req.params.id, shopId);
    return successResponse(res, outstanding, 'Farmer outstanding balance calculated');
  } catch (error) {
    next(error);
  }
}

async function handleRecordFarmerPayment(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? null : req.user.shopId;
    const payment = await farmerService.recordFarmerPayment(req.params.id, shopId, req.body);
    return successResponse(res, payment, 'Farmer payment recorded and khata credited successfully', 201);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  handleCreateFarmer,
  handleGetAllFarmers,
  handleGetFarmerById,
  handleUpdateFarmer,
  handleDeleteFarmer,
  handleGetFarmerKhata,
  handleGetFarmerBills,
  handleGetFarmerPayments,
  handleGetFarmerOutstanding,
  handleRecordFarmerPayment,
};
