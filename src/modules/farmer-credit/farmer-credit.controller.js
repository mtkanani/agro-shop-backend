const farmerCreditService = require('./farmer-credit.service');
const { successResponse, paginatedResponse } = require('../../utils/response');

async function handleGetCreditOverview(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const overview = await farmerCreditService.getCreditOverview(shopId);
    return successResponse(res, overview, 'Farmer credit dashboard metrics retrieved');
  } catch (error) {
    next(error);
  }
}

async function handleGetFarmerCreditList(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const { farmers, pagination } = await farmerCreditService.getFarmerCreditList(shopId, req.query);
    return paginatedResponse(res, farmers, pagination, 'Farmer credit list retrieved');
  } catch (error) {
    next(error);
  }
}

async function handleGetOverdueInvoices(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const { invoices, pagination } = await farmerCreditService.getOverdueInvoices(shopId, req.query);
    return paginatedResponse(res, invoices, pagination, 'Overdue dues list retrieved');
  } catch (error) {
    next(error);
  }
}

async function handleGetFarmerCreditSummary(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? null : req.user.shopId;
    const summary = await farmerCreditService.getFarmerCreditSummary(req.params.farmerId, shopId);
    return successResponse(res, summary, 'Farmer credit profile summary retrieved');
  } catch (error) {
    next(error);
  }
}

async function handleGetFarmerLedger(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? null : req.user.shopId;
    const ledger = await farmerCreditService.getFarmerLedger(req.params.farmerId, shopId, req.query);
    return successResponse(res, ledger, 'Farmer ledger history retrieved');
  } catch (error) {
    next(error);
  }
}

async function handleRecordFarmerPayment(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.body.shopId || req.user.shopId) : req.user.shopId;
    const result = await farmerCreditService.recordFarmerPayment(req.user.id, shopId, req.body);
    return successResponse(res, result, 'Farmer payment recorded successfully', 201);
  } catch (error) {
    next(error);
  }
}

async function handleSettleInvoiceDue(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? null : req.user.shopId;
    const result = await farmerCreditService.settleInvoiceDue(req.params.invoiceId, shopId, req.user.id, req.body);
    return successResponse(res, result, 'Invoice pending balance settled in full and status marked as PAID');
  } catch (error) {
    next(error);
  }
}

async function handleGetPaymentReceipt(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? null : req.user.shopId;
    const receipt = await farmerCreditService.getPaymentReceipt(req.params.paymentId, shopId);
    return successResponse(res, receipt, 'Printable POS payment receipt generated');
  } catch (error) {
    next(error);
  }
}

async function handleReversePayment(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? null : req.user.shopId;
    const result = await farmerCreditService.reversePayment(req.params.paymentId, shopId, req.user.id, req.body.reason);
    return successResponse(res, result, 'Payment reversed successfully and khata balance restored');
  } catch (error) {
    next(error);
  }
}

async function handleCreateCreditAdjustment(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.body.shopId || req.user.shopId) : req.user.shopId;
    const result = await farmerCreditService.createCreditAdjustment(req.user.id, shopId, req.body);
    return successResponse(res, result, 'Manual credit adjustment created successfully', 201);
  } catch (error) {
    next(error);
  }
}

async function handleSetCreditLimit(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? null : req.user.shopId;
    const updatedFarmer = await farmerCreditService.setCreditLimit(req.params.farmerId, shopId, req.body.creditLimit);
    return successResponse(res, updatedFarmer, 'Farmer credit limit updated successfully');
  } catch (error) {
    next(error);
  }
}

async function handleCreateOpeningBalance(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? null : req.user.shopId;
    const result = await farmerCreditService.createOpeningBalance(req.user.id, shopId, req.params.farmerId, req.body);
    return successResponse(res, result, 'Farmer opening balance initialized', 201);
  } catch (error) {
    next(error);
  }
}

async function handleGetFarmerBillsSummary(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const summary = await farmerCreditService.getFarmerBillsSummary(req.params.farmerId, shopId);
    return successResponse(res, summary, 'Farmer bills summary by type retrieved');
  } catch (error) {
    next(error);
  }
}

async function handleSendFarmerBills(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.body.shopId || req.user.shopId) : req.user.shopId;
    const result = await farmerCreditService.sendFarmerBills(shopId, req.user.id, req.params.farmerId, req.body);
    return successResponse(res, result, `Farmer bills (${req.body.billType}) dispatched successfully`);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  handleGetCreditOverview,
  handleGetFarmerCreditList,
  handleGetOverdueInvoices,
  handleGetFarmerCreditSummary,
  handleGetFarmerLedger,
  handleRecordFarmerPayment,
  handleSettleInvoiceDue,
  handleGetPaymentReceipt,
  handleReversePayment,
  handleCreateCreditAdjustment,
  handleSetCreditLimit,
  handleCreateOpeningBalance,
  handleGetFarmerBillsSummary,
  handleSendFarmerBills,
};

