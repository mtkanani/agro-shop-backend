const paymentService = require('./payments.service');
const { successResponse, paginatedResponse } = require('../../utils/response');

async function handleRecordPayment(req, res, next) {
  try {
    const shopId = req.body.shopId || req.user.shopId;
    const payment = await paymentService.recordPayment({
      ...req.body,
      shopId,
    });
    return successResponse(res, payment, 'Payment recorded successfully', 201);
  } catch (error) {
    next(error);
  }
}

async function handleGetAllPayments(req, res, next) {
  try {
    const { payments, pagination } = await paymentService.getAllPayments(req.query);
    return paginatedResponse(res, payments, pagination, 'Payments list fetched');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  handleRecordPayment,
  handleGetAllPayments,
};
