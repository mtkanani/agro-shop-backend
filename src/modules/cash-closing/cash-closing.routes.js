const express = require('express');
const router = express.Router();
const cashClosingController = require('./cash-closing.controller');
const cashClosingValidation = require('./cash-closing.validation');
const { validate } = require('../../middleware/validation.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { requirePermission } = require('../../middleware/role.middleware');

router.use(authenticate);

router.post('/open', requirePermission('CASH_MANAGE'), validate(cashClosingValidation.openCashClosingSchema), cashClosingController.handleOpenCashRegister);
router.post('/:id/close', requirePermission('CASH_MANAGE'), validate(cashClosingValidation.performCashClosingSchema), cashClosingController.handleCloseCashRegister);
router.get('/', requirePermission('CASH_VIEW'), cashClosingController.handleGetCashClosings);
router.get('/:id', requirePermission('CASH_VIEW'), cashClosingController.handleGetCashClosingById);

module.exports = router;
