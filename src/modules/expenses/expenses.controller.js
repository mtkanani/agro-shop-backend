const expensesService = require('./expenses.service');
const { successResponse, paginatedResponse, errorResponse } = require('../../utils/response');

function resolveShopId(req) {
  if (req.user && req.user.role === 'SUPER_ADMIN') {
    return req.query.shopId || req.body.shopId || req.user.shopId;
  }
  return req.user ? req.user.shopId : null;
}

/**
 * 1. Log New Expense
 */
async function handleCreateExpense(req, res, next) {
  try {
    const shopId = resolveShopId(req);
    if (!shopId) {
      return errorResponse(res, 'Shop ID is required', 400);
    }

    const expense = await expensesService.createExpense(req.user.id, shopId, req.body);
    return successResponse(res, expense, 'Expense recorded successfully', 201);
  } catch (error) {
    next(error);
  }
}

/**
 * 2. Get All Expenses (Paginated & Filtered)
 */
async function handleGetAllExpenses(req, res, next) {
  try {
    const shopId = resolveShopId(req);
    if (!shopId) {
      return errorResponse(res, 'Shop ID is required', 400);
    }

    const { expenses, pagination } = await expensesService.getAllExpenses(shopId, req.query);
    return paginatedResponse(res, expenses, pagination, 'Expenses retrieved successfully');
  } catch (error) {
    next(error);
  }
}

/**
 * 3. Expense Analysis & Category Distribution
 */
async function handleGetExpenseAnalytics(req, res, next) {
  try {
    const shopId = resolveShopId(req);
    if (!shopId) {
      return errorResponse(res, 'Shop ID is required', 400);
    }

    const analytics = await expensesService.getExpenseAnalytics(shopId, req.query);
    return successResponse(res, analytics, 'Expense analysis calculated successfully');
  } catch (error) {
    next(error);
  }
}

/**
 * 4. Get Single Expense Details
 */
async function handleGetExpenseById(req, res, next) {
  try {
    const shopId = resolveShopId(req);
    if (!shopId) {
      return errorResponse(res, 'Shop ID is required', 400);
    }

    const expense = await expensesService.getExpenseById(shopId, req.params.id);
    return successResponse(res, expense, 'Expense details retrieved');
  } catch (error) {
    next(error);
  }
}

/**
 * 5. Update Expense
 */
async function handleUpdateExpense(req, res, next) {
  try {
    const shopId = resolveShopId(req);
    if (!shopId) {
      return errorResponse(res, 'Shop ID is required', 400);
    }

    const updated = await expensesService.updateExpense(req.user.id, shopId, req.params.id, req.body);
    return successResponse(res, updated, 'Expense updated successfully');
  } catch (error) {
    next(error);
  }
}

/**
 * 6. Delete Expense
 */
async function handleDeleteExpense(req, res, next) {
  try {
    const shopId = resolveShopId(req);
    if (!shopId) {
      return errorResponse(res, 'Shop ID is required', 400);
    }

    const result = await expensesService.deleteExpense(req.user.id, shopId, req.params.id);
    return successResponse(res, result, 'Expense deleted successfully');
  } catch (error) {
    next(error);
  }
}

/**
 * 7. Export Expenses
 */
async function handleExportExpenses(req, res, next) {
  try {
    const shopId = resolveShopId(req);
    if (!shopId) {
      return errorResponse(res, 'Shop ID is required', 400);
    }

    const result = await expensesService.exportExpenses(shopId, req.query);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="expenses_${Date.now()}.csv"`);
    return res.status(200).send(result.data);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  handleCreateExpense,
  handleGetAllExpenses,
  handleGetExpenseAnalytics,
  handleGetExpenseById,
  handleUpdateExpense,
  handleDeleteExpense,
  handleExportExpenses,
};
