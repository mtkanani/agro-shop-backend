const express = require('express');
const router = express.Router();
const supplierController = require('./suppliers.controller');
const supplierValidation = require('./suppliers.validation');
const { validate } = require('../../middleware/validation.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { requirePermission } = require('../../middleware/role.middleware');

router.use(authenticate);

router.post('/', requirePermission('SUPPLIER_CREATE'), validate(supplierValidation.createSupplierSchema), supplierController.handleCreateSupplier);
router.get('/', requirePermission('SUPPLIER_VIEW'), supplierController.handleGetAllSuppliers);
router.get('/:id', requirePermission('SUPPLIER_VIEW'), supplierController.handleGetSupplierById);
router.put('/:id', requirePermission('SUPPLIER_UPDATE'), validate(supplierValidation.updateSupplierSchema), supplierController.handleUpdateSupplier);
router.delete('/:id', requirePermission('SUPPLIER_DELETE'), supplierController.handleDeleteSupplier);

router.get('/:id/transactions', requirePermission('SUPPLIER_VIEW'), supplierController.handleGetSupplierTransactions);
router.get('/:id/restocks', requirePermission('SUPPLIER_VIEW'), supplierController.handleGetSupplierTransactions);
router.get('/:id/products', requirePermission('SUPPLIER_VIEW'), supplierController.handleGetSupplierProducts);
router.get('/:id/outstanding', requirePermission('SUPPLIER_VIEW'), supplierController.handleGetSupplierOutstanding);
router.post('/:id/payments', requirePermission('PAYMENT_CREATE'), validate(supplierValidation.recordSupplierPaymentSchema), supplierController.handleRecordSupplierPayment);

module.exports = router;
