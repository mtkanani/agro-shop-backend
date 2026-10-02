const { prisma } = require('../../config/database');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');
const { paginateThroughQuery } = require('../../utils/paginationLoop');
const { logAuditAction } = require('../../utils/auditLogger');

/**
 * Generate sequential expense number: EXP-YYYYMM-0001
 */
async function generateExpenseNumber(shopId) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const monthPrefix = `EXP-${year}${month}`;

  const latestExpense = await prisma.expense.findFirst({
    where: {
      shopId,
      expenseNumber: { startsWith: monthPrefix },
    },
    orderBy: { expenseNumber: 'desc' },
    select: { expenseNumber: true },
  });

  let nextSeq = '0001';
  if (latestExpense && latestExpense.expenseNumber) {
    const lastSeqStr = latestExpense.expenseNumber.slice(monthPrefix.length + 1); // skip "-"
    const lastSeq = parseInt(lastSeqStr, 10);
    if (!isNaN(lastSeq)) {
      nextSeq = String(lastSeq + 1).padStart(4, '0');
    }
  }

  return `${monthPrefix}-${nextSeq}`;
}

/**
 * Resolves date ranges from either ISO date strings or preset timeframes
 */
function resolveDateRange(fromDate, toDate, timeframe) {
  const now = new Date();

  if (timeframe) {
    switch (timeframe.toUpperCase()) {
      case 'TODAY': {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        const end = new Date(now);
        end.setHours(23, 59, 59, 999);
        return { gte: start, lte: end };
      }
      case 'YESTERDAY': {
        const start = new Date(now);
        start.setDate(start.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        const end = new Date(now);
        end.setDate(end.getDate() - 1);
        end.setHours(23, 59, 59, 999);
        return { gte: start, lte: end };
      }
      case 'THIS_WEEK': {
        const start = new Date(now);
        const day = start.getDay();
        const diff = start.getDate() - day + (day === 0 ? -6 : 1);
        start.setDate(diff);
        start.setHours(0, 0, 0, 0);
        const end = new Date(now);
        end.setHours(23, 59, 59, 999);
        return { gte: start, lte: end };
      }
      case 'THIS_MONTH': {
        const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        return { gte: start, lte: end };
      }
      case 'LAST_MONTH': {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        return { gte: start, lte: end };
      }
      default:
        break;
    }
  }

  if (fromDate || toDate) {
    const range = {};
    if (fromDate) range.gte = new Date(fromDate);
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      range.lte = end;
    }
    return range;
  }

  return undefined;
}

/**
 * 1. Create a new Expense (Store operation or Dealer Inward Procurement)
 */
async function createExpense(userId, shopId, data) {
  if (data.supplierId) {
    const supplier = await prisma.supplier.findFirst({
      where: { id: data.supplierId, shopId },
    });
    if (!supplier) {
      const err = new Error('Supplier / Dealer not found in this shop');
      err.statusCode = 404;
      throw err;
    }
  }

  const expenseNumber = await generateExpenseNumber(shopId);

  const expense = await prisma.expense.create({
    data: {
      ...data,
      shopId,
      userId,
      expenseNumber,
      amount: Number(data.amount),
      expenseDate: data.expenseDate ? new Date(data.expenseDate) : new Date(),
      billDate: data.billDate ? new Date(data.billDate) : null,
    },
    include: {
      supplier: {
        select: { id: true, name: true, phone: true, companyName: true },
      },
      user: {
        select: { id: true, fullName: true, role: true },
      },
    },
  });

  logAuditAction({
    userId,
    shopId,
    action: 'EXPENSE_CREATE',
    module: 'EXPENSES',
    recordId: expense.id,
    newValue: { expenseNumber, title: expense.title, amount: expense.amount, category: expense.category },
  });

  return expense;
}

/**
 * 2. Get All Expenses with Filtering and Pagination
 */
async function getAllExpenses(shopId, query = {}) {
  const { page, limit, skip } = getPagination(query);
  const where = { shopId };

  if (query.category) {
    where.category = query.category;
  }

  if (query.supplierId) {
    where.supplierId = query.supplierId;
  }

  if (query.paymentMethod) {
    where.paymentMethod = query.paymentMethod;
  }

  const dateRange = resolveDateRange(query.fromDate, query.toDate, query.timeframe);
  if (dateRange) {
    where.expenseDate = dateRange;
  }

  if (query.search && query.search.trim()) {
    const term = query.search.trim();
    where.OR = [
      { title: { contains: term, mode: 'insensitive' } },
      { expenseNumber: { contains: term, mode: 'insensitive' } },
      { billNumber: { contains: term, mode: 'insensitive' } },
      { notes: { contains: term, mode: 'insensitive' } },
      { supplier: { name: { contains: term, mode: 'insensitive' } } },
    ];
  }

  const sortBy = query.sortBy || 'expenseDate';
  const sortOrder = (query.sortOrder || 'desc').toLowerCase();

  const [expenses, totalRecords] = await prisma.$transaction([
    prisma.expense.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        supplier: {
          select: { id: true, name: true, phone: true, companyName: true },
        },
        user: {
          select: { id: true, fullName: true, role: true },
        },
      },
    }),
    prisma.expense.count({ where }),
  ]);

  return {
    expenses,
    pagination: getPaginationMeta(totalRecords, page, limit),
  };
}

/**
 * 3. Expense Analysis & Breakdown Metrics
 */
async function getExpenseAnalytics(shopId, query = {}) {
  const where = { shopId };

  if (query.supplierId) {
    where.supplierId = query.supplierId;
  }

  const dateRange = resolveDateRange(query.fromDate, query.toDate, query.timeframe);
  if (dateRange) {
    where.expenseDate = dateRange;
  }

  const [aggregateTotal, categoryGroup, paymentGroup] = await Promise.all([
    prisma.expense.aggregate({
      where,
      _count: { id: true },
      _sum: { amount: true },
      _avg: { amount: true },
    }),
    prisma.expense.groupBy({
      by: ['category'],
      where,
      _count: { id: true },
      _sum: { amount: true },
    }),
    prisma.expense.groupBy({
      by: ['paymentMethod'],
      where,
      _count: { id: true },
      _sum: { amount: true },
    }),
  ]);

  const totalExpenseAmount = aggregateTotal._sum.amount || 0;
  const totalExpensesCount = aggregateTotal._count.id || 0;

  // Dealer Inward Breakdown (Procurement + Freight + Hamali)
  const dealerInwardCategories = ['DEALER_PROCUREMENT', 'FREIGHT_TRANSPORT', 'LABOR_HAMALI'];
  const dealerInwardGroup = categoryGroup.filter((g) => dealerInwardCategories.includes(g.category));
  const dealerInwardTotal = dealerInwardGroup.reduce((sum, g) => sum + (g._sum.amount || 0), 0);

  // Top Suppliers by Expenses
  const topSupplierExpenses = await prisma.expense.groupBy({
    by: ['supplierId'],
    where: {
      ...where,
      supplierId: { not: null },
    },
    _sum: { amount: true },
    _count: { id: true },
    orderBy: { _sum: { amount: 'desc' } },
    take: 5,
  });

  const supplierIds = topSupplierExpenses.map((s) => s.supplierId).filter(Boolean);
  const suppliers = await prisma.supplier.findMany({
    where: { id: { in: supplierIds } },
    select: { id: true, name: true, phone: true, companyName: true },
  });
  const supplierMap = new Map(suppliers.map((s) => [s.id, s]));

  const topSuppliersFormatted = topSupplierExpenses.map((s) => {
    const supp = supplierMap.get(s.supplierId);
    return {
      supplierId: s.supplierId,
      supplierName: supp ? supp.name : 'Unknown Dealer',
      supplierPhone: supp ? supp.phone : '',
      company: supp ? supp.company : '',
      totalAmount: s._sum.amount || 0,
      expenseCount: s._count.id || 0,
    };
  });

  return {
    summary: {
      totalExpenseAmount,
      totalExpensesCount,
      averageExpenseAmount: totalExpensesCount > 0 ? Math.round(((aggregateTotal._avg.amount || 0) * 100)) / 100 : 0,
      dealerInwardTotal,
      generalStoreExpensesTotal: Math.max(0, totalExpenseAmount - dealerInwardTotal),
    },
    byCategory: categoryGroup.map((g) => ({
      category: g.category,
      amount: g._sum.amount || 0,
      count: g._count.id || 0,
      percentageOfTotal: totalExpenseAmount > 0 ? Math.round((((g._sum.amount || 0) / totalExpenseAmount) * 100) * 10) / 10 : 0,
    })),
    byPaymentMethod: paymentGroup.map((g) => ({
      method: g.paymentMethod,
      amount: g._sum.amount || 0,
      count: g._count.id || 0,
    })),
    topSuppliers: topSuppliersFormatted,
  };
}

/**
 * 4. Get Single Expense Details
 */
async function getExpenseById(shopId, id) {
  const expense = await prisma.expense.findFirst({
    where: { id, shopId },
    include: {
      supplier: true,
      user: {
        select: { id: true, fullName: true, role: true },
      },
    },
  });

  if (!expense) {
    const err = new Error('Expense record not found in this shop');
    err.statusCode = 404;
    throw err;
  }

  return expense;
}

/**
 * 5. Update Expense
 */
async function updateExpense(userId, shopId, id, data) {
  const existing = await getExpenseById(shopId, id);

  if (data.supplierId && data.supplierId !== existing.supplierId) {
    const supplier = await prisma.supplier.findFirst({
      where: { id: data.supplierId, shopId },
    });
    if (!supplier) {
      const err = new Error('Supplier not found in this shop');
      err.statusCode = 404;
      throw err;
    }
  }

  const updated = await prisma.expense.update({
    where: { id: existing.id },
    data: {
      ...data,
      amount: data.amount !== undefined ? Number(data.amount) : undefined,
      expenseDate: data.expenseDate ? new Date(data.expenseDate) : undefined,
      billDate: data.billDate ? new Date(data.billDate) : undefined,
    },
    include: {
      supplier: {
        select: { id: true, name: true, phone: true, companyName: true },
      },
    },
  });

  logAuditAction({
    userId,
    shopId,
    action: 'EXPENSE_UPDATE',
    module: 'EXPENSES',
    recordId: updated.id,
    oldValue: { title: existing.title, amount: existing.amount, category: existing.category },
    newValue: { title: updated.title, amount: updated.amount, category: updated.category },
  });

  return updated;
}

/**
 * 6. Delete Expense
 */
async function deleteExpense(userId, shopId, id) {
  const existing = await getExpenseById(shopId, id);

  await prisma.expense.delete({
    where: { id: existing.id },
  });

  logAuditAction({
    userId,
    shopId,
    action: 'EXPENSE_DELETE',
    module: 'EXPENSES',
    recordId: existing.id,
    oldValue: { expenseNumber: existing.expenseNumber, title: existing.title, amount: existing.amount },
  });

  return { message: 'Expense deleted successfully' };
}

/**
 * 7. Export Expenses via Memory-Safe Pagination Loop
 */
async function exportExpenses(shopId, query = {}) {
  const where = { shopId };
  if (query.category) where.category = query.category;
  if (query.supplierId) where.supplierId = query.supplierId;
  const dateRange = resolveDateRange(query.fromDate, query.toDate, query.timeframe);
  if (dateRange) where.expenseDate = dateRange;

  const rows = [];
  await paginateThroughQuery(prisma.expense, {
    where,
    include: { supplier: { select: { name: true } }, user: { select: { fullName: true } } },
    orderBy: { expenseDate: 'desc' },
    chunkSize: 500,
    onBatch: (batch) => {
      for (const e of batch) {
        rows.push({
          'Expense No': e.expenseNumber,
          'Date': e.expenseDate.toISOString().split('T')[0],
          'Category': e.category,
          'Title': e.title,
          'Amount': e.amount,
          'Payment Method': e.paymentMethod,
          'Dealer / Supplier': e.supplier ? e.supplier.name : 'N/A',
          'Bill Number': e.billNumber || '',
          'Logged By': e.user ? e.user.fullName : '',
          'Notes': e.notes || '',
        });
      }
    },
  });

  if (rows.length === 0) return { data: 'No expense records found', contentType: 'text/csv' };

  const headers = Object.keys(rows[0]);
  const csvLines = [headers.join(',')];
  for (const row of rows) {
    const line = headers.map((h) => {
      let val = row[h] === null || row[h] === undefined ? '' : String(row[h]);
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        val = `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    });
    csvLines.push(line.join(','));
  }

  return { data: csvLines.join('\n'), contentType: 'text/csv' };
}

module.exports = {
  createExpense,
  getAllExpenses,
  getExpenseAnalytics,
  getExpenseById,
  updateExpense,
  deleteExpense,
  exportExpenses,
};
