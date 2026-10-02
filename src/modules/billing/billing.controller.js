const billingService = require('./billing.service');
const { successResponse, paginatedResponse } = require('../../utils/response');

async function handleCreateInvoice(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.body.shopId || req.user.shopId) : req.user.shopId;
    if (!shopId) {
      return res.status(400).json({ success: false, message: 'Shop ID is required' });
    }

    const result = await billingService.createInvoice(req.user.id, {
      ...req.body,
      shopId,
    });

    return successResponse(res, result, 'POS Sales Invoice created successfully', 201);
  } catch (error) {
    next(error);
  }
}

async function handleGetAllInvoices(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const { invoices, pagination } = await billingService.getAllInvoices({ ...req.query, shopId });
    return paginatedResponse(res, invoices, pagination, 'Invoices history fetched');
  } catch (error) {
    next(error);
  }
}

async function handleGetInvoiceById(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? null : req.user.shopId;
    const invoice = await billingService.getInvoiceById(req.params.id, shopId);
    return successResponse(res, invoice, 'Invoice details retrieved');
  } catch (error) {
    next(error);
  }
}

async function handleGetInvoiceReceipt(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? null : req.user.shopId;
    const receipt = await billingService.getInvoiceReceipt(req.params.id, shopId);
    return successResponse(res, receipt, 'Printable POS receipt generated');
  } catch (error) {
    next(error);
  }
}

async function handleCancelInvoice(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? null : req.user.shopId;
    const cancelledInvoice = await billingService.cancelInvoice(
      req.params.id,
      shopId,
      req.user.id,
      req.body.reason
    );
    return successResponse(res, cancelledInvoice, 'Invoice cancelled and stock reversed successfully');
  } catch (error) {
    next(error);
  }
}

async function handleGetBillingSummary(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const summary = await billingService.getBillingSummary(shopId, req.query);
    return successResponse(res, summary, 'Billing sales summary fetched');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  handleCreateInvoice,
  handleGetAllInvoices,
  handleGetInvoiceById,
  handleGetInvoiceReceipt,
  handleCancelInvoice,
  handleGetBillingSummary,
};
