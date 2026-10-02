const express = require('express');
const router = express.Router();
const paymentController = require('./payments.controller');
const paymentValidation = require('./payments.validation');
const { validate } = require('../../middleware/validation.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { requirePermission } = require('../../middleware/role.middleware');

router.use(authenticate);

router.post('/', requirePermission('PAYMENT_CREATE'), validate(paymentValidation.recordPaymentSchema), paymentController.handleRecordPayment);
router.get('/', requirePermission('PAYMENT_VIEW'), paymentController.handleGetAllPayments);

module.exports = router;
