const express = require('express');
const router = express.Router();
const expensesController = require('./expenses.controller');
const expensesValidation = require('./expenses.validation');
const { validate } = require('../../middleware/validation.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { requirePermission } = require('../../middleware/role.middleware');

router.use(authenticate);

// 1. Static sub-routes (Registered before dynamic /:id)
router.post(
  '/',
  requirePermission('EXPENSE_MANAGE'),
  validate(expensesValidation.createExpenseSchema),
  expensesController.handleCreateExpense
);

router.get(
  '/analytics',
  requirePermission('EXPENSE_VIEW'),
  validate(expensesValidation.expenseQuerySchema, 'query'),
  expensesController.handleGetExpenseAnalytics
);

router.get(
  '/export',
  requirePermission('EXPENSE_VIEW'),
  validate(expensesValidation.expenseQuerySchema, 'query'),
  expensesController.handleExportExpenses
);

router.get(
  '/',
  requirePermission('EXPENSE_VIEW'),
  validate(expensesValidation.expenseQuerySchema, 'query'),
  expensesController.handleGetAllExpenses
);

// 2. Parameterized routes
router.get('/:id', requirePermission('EXPENSE_VIEW'), expensesController.handleGetExpenseById);

router.put(
  '/:id',
  requirePermission('EXPENSE_MANAGE'),
  validate(expensesValidation.updateExpenseSchema),
  expensesController.handleUpdateExpense
);

router.delete('/:id', requirePermission('EXPENSE_MANAGE'), expensesController.handleDeleteExpense);

module.exports = router;
