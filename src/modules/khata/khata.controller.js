const khataService = require('./khata.service');
const { successResponse, paginatedResponse } = require('../../utils/response');

async function handleGetFarmerLedger(req, res, next) {
  try {
    const { farmer, transactions, pagination } = await khataService.getFarmerLedger(req.params.farmerId, req.query);
    return paginatedResponse(res, { farmer, transactions }, pagination, 'Farmer Khata ledger fetched');
  } catch (error) {
    next(error);
  }
}

async function handleGetSupplierLedger(req, res, next) {
  try {
    const { supplier, transactions, pagination } = await khataService.getSupplierLedger(req.params.supplierId, req.query);
    return paginatedResponse(res, { supplier, transactions }, pagination, 'Supplier Khata ledger fetched');
  } catch (error) {
    next(error);
  }
}

async function handleAddManualKhataEntry(req, res, next) {
  try {
    const entry = await khataService.addManualKhataEntry(req.body);
    return successResponse(res, entry, 'Khata transaction entry created', 201);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  handleGetFarmerLedger,
  handleGetSupplierLedger,
  handleAddManualKhataEntry,
};
