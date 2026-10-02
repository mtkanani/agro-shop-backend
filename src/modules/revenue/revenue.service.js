const { prisma } = require('../../config/database');

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
      case 'THIS_QUARTER': {
        const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
        const start = new Date(now.getFullYear(), quarterMonth, 1, 0, 0, 0, 0);
        const end = new Date(now.getFullYear(), quarterMonth + 3, 0, 23, 59, 59, 999);
        return { gte: start, lte: end };
      }
      case 'THIS_YEAR': {
        const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
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
 * 1. Comprehensive Revenue, COGS, Profit & Loss Summary
 */
async function getRevenueSummary(shopId, query = {}) {
  const dateRange = resolveDateRange(query.fromDate, query.toDate, query.timeframe);

  const invoiceWhere = { shopId };
  if (dateRange) invoiceWhere.createdAt = dateRange;
  if (query.categoryId) {
    invoiceWhere.items = { some: { product: { categoryId: query.categoryId } } };
  }

  // 1. Invoices sales aggregates
  const invoiceAgg = await prisma.invoice.aggregate({
    where: invoiceWhere,
    _count: { id: true },
    _sum: {
      totalAmount: true,
      subTotal: true,
      discount: true,
      taxAmount: true,
      paidAmount: true,
    },
  });

  const grossRevenue = Math.round((invoiceAgg._sum.totalAmount || 0) * 100) / 100;
  const invoicedSubTotal = Math.round((invoiceAgg._sum.subTotal || 0) * 100) / 100;
  const totalDiscount = Math.round((invoiceAgg._sum.discount || 0) * 100) / 100;
  const totalTaxCollected = Math.round((invoiceAgg._sum.taxAmount || 0) * 100) / 100;
  const totalPaidAmount = Math.round((invoiceAgg._sum.paidAmount || 0) * 100) / 100;
  const totalInvoicesCount = invoiceAgg._count.id || 0;

  // 2. Fetch line items to calculate accurate Cost of Goods Sold (COGS)
  const itemWhere = { invoice: { shopId } };
  if (dateRange) itemWhere.createdAt = dateRange;
  if (query.categoryId) itemWhere.product = { categoryId: query.categoryId };

  const items = await prisma.invoiceItem.findMany({
    where: itemWhere,
    select: {
      quantity: true,
      totalPrice: true,
      batch: {
        select: { purchasePrice: true },
      },
      product: {
        select: {
          variants: {
            where: { isActive: true },
            select: { purchasePrice: true },
            take: 1,
          },
        },
      },
    },
  });

  let totalCOGS = 0;
  for (const it of items) {
    const costPerUnit = (it.batch && it.batch.purchasePrice)
      ? it.batch.purchasePrice
      : (it.product && it.product.variants && it.product.variants[0] ? it.product.variants[0].purchasePrice : 0);
    totalCOGS += (it.quantity * costPerUnit);
  }
  totalCOGS = Math.round(totalCOGS * 100) / 100;

  const grossProfit = Math.round((grossRevenue - totalCOGS) * 100) / 100;
  const grossMarginPercentage = grossRevenue > 0
    ? Math.round(((grossProfit / grossRevenue) * 100) * 10) / 10
    : 0;

  // 3. Sales Returns Deductions
  const returnWhere = { shopId, status: { not: 'REVERSED' } };
  if (dateRange) returnWhere.createdAt = dateRange;

  const returnAgg = await prisma.salesReturn.aggregate({
    where: returnWhere,
    _count: { id: true },
    _sum: { returnAmount: true },
  });

  const totalReturnedAmount = Math.round((returnAgg._sum.returnAmount || 0) * 100) / 100;
  const netRevenue = Math.max(0, Math.round((grossRevenue - totalReturnedAmount) * 100) / 100);

  // 4. Store Operating Expenses & Dealer Inward Logistics
  const expenseWhere = { shopId };
  if (dateRange) expenseWhere.expenseDate = dateRange;

  const expenseAgg = await prisma.expense.aggregate({
    where: expenseWhere,
    _count: { id: true },
    _sum: { amount: true },
  });

  const totalExpensesAmount = Math.round((expenseAgg._sum.amount || 0) * 100) / 100;

  const dealerExpensesAgg = await prisma.expense.aggregate({
    where: {
      ...expenseWhere,
      category: { in: ['DEALER_PROCUREMENT', 'FREIGHT_TRANSPORT', 'LABOR_HAMALI'] },
    },
    _sum: { amount: true },
  });

  const dealerInwardExpenses = Math.round((dealerExpensesAgg._sum.amount || 0) * 100) / 100;
  const generalStoreExpenses = Math.max(0, Math.round((totalExpensesAmount - dealerInwardExpenses) * 100) / 100);

  // 5. True Net Store Profit (Bottom Line = Gross Profit - Operating Expenses)
  const netStoreProfit = Math.round((grossProfit - totalExpensesAmount) * 100) / 100;
  const netMarginPercentage = grossRevenue > 0
    ? Math.round(((netStoreProfit / grossRevenue) * 100) * 10) / 10
    : 0;

  return {
    revenue: {
      grossRevenue,
      invoicedSubTotal,
      netRevenue,
      totalPaidAmount,
      balanceDue: Math.max(0, Math.round((grossRevenue - totalPaidAmount) * 100) / 100),
      totalDiscount,
      totalTaxCollected,
      totalInvoicesCount,
      totalUnitsSold: items.reduce((sum, it) => sum + it.quantity, 0),
    },
    costs: {
      costOfGoodsSold: totalCOGS,
      totalOperatingExpenses: totalExpensesAmount,
      dealerInwardExpenses,
      generalStoreExpenses,
      totalReturnedDeductions: totalReturnedAmount,
      returnsCount: returnAgg._count.id || 0,
    },
    profitability: {
      grossProfit,
      grossMarginPercentage,
      netStoreProfit,
      netMarginPercentage,
      status: netStoreProfit >= 0 ? 'PROFITABLE' : 'OPERATING_LOSS',
    },
  };
}

/**
 * 2. Revenue and Margins Broken Down by Category (Fertilizers, Pesticides, Seeds, Equipment)
 */
async function getRevenueByCategory(shopId, query = {}) {
  const dateRange = resolveDateRange(query.fromDate, query.toDate, query.timeframe);

  const itemWhere = { invoice: { shopId } };
  if (dateRange) itemWhere.createdAt = dateRange;

  const items = await prisma.invoiceItem.findMany({
    where: itemWhere,
    select: {
      quantity: true,
      totalPrice: true,
      batch: { select: { purchasePrice: true } },
      product: {
        select: {
          categoryId: true,
          category: { select: { id: true, name: true } },
          variants: {
            where: { isActive: true },
            select: { purchasePrice: true },
            take: 1,
          },
        },
      },
    },
  });

  const categoryMap = new Map();
  let overallRevenue = 0;

  for (const it of items) {
    const catId = it.product && it.product.categoryId ? it.product.categoryId : 'uncategorized';
    const catName = it.product && it.product.category ? it.product.category.name : 'General Input';
    const costPerUnit = (it.batch && it.batch.purchasePrice)
      ? it.batch.purchasePrice
      : (it.product && it.product.variants && it.product.variants[0] ? it.product.variants[0].purchasePrice : 0);
    const itemCost = it.quantity * costPerUnit;

    if (!categoryMap.has(catId)) {
      categoryMap.set(catId, {
        categoryId: catId,
        categoryName: catName,
        totalUnitsSold: 0,
        grossRevenue: 0,
        cogs: 0,
        grossProfit: 0,
      });
    }

    const catData = categoryMap.get(catId);
    catData.totalUnitsSold += it.quantity;
    catData.grossRevenue += it.totalPrice;
    catData.cogs += itemCost;
    overallRevenue += it.totalPrice;
  }

  const result = Array.from(categoryMap.values()).map((cat) => {
    const profit = Math.round((cat.grossRevenue - cat.cogs) * 100) / 100;
    const marginPct = cat.grossRevenue > 0
      ? Math.round(((profit / cat.grossRevenue) * 100) * 10) / 10
      : 0;
    const revenueShare = overallRevenue > 0
      ? Math.round(((cat.grossRevenue / overallRevenue) * 100) * 10) / 10
      : 0;

    return {
      categoryId: cat.categoryId,
      categoryName: cat.categoryName,
      totalUnitsSold: cat.totalUnitsSold,
      grossRevenue: Math.round(cat.grossRevenue * 100) / 100,
      costOfGoodsSold: Math.round(cat.cogs * 100) / 100,
      grossProfit: profit,
      marginPercentage: marginPct,
      revenueSharePercentage: revenueShare,
    };
  });

  result.sort((a, b) => b.grossProfit - a.grossProfit);

  return result;
}

/**
 * 3. Top Profit-Making Products (Ranked by Revenue, Profit in ₹, and Margin %)
 */
async function getTopProfitProducts(shopId, query = {}) {
  const dateRange = resolveDateRange(query.fromDate, query.toDate, query.timeframe);

  const itemWhere = { invoice: { shopId } };
  if (dateRange) itemWhere.createdAt = dateRange;
  if (query.categoryId) itemWhere.product = { categoryId: query.categoryId };

  const items = await prisma.invoiceItem.findMany({
    where: itemWhere,
    select: {
      productId: true,
      quantity: true,
      totalPrice: true,
      batch: { select: { purchasePrice: true } },
      product: {
        select: {
          id: true,
          name: true,
          code: true,
          uom: true,
          category: { select: { name: true } },
          variants: {
            where: { isActive: true },
            select: { purchasePrice: true },
            take: 1,
          },
        },
      },
    },
  });

  const productMap = new Map();

  for (const it of items) {
    if (!productMap.has(it.productId)) {
      productMap.set(it.productId, {
        productId: it.productId,
        name: it.product ? it.product.name : 'Unknown Product',
        code: it.product ? it.product.code : '',
        category: it.product && it.product.category ? it.product.category.name : '',
        uom: it.product ? it.product.uom : 'unit',
        unitsSold: 0,
        grossRevenue: 0,
        cogs: 0,
      });
    }

    const prod = productMap.get(it.productId);
    const costPerUnit = (it.batch && it.batch.purchasePrice)
      ? it.batch.purchasePrice
      : (it.product && it.product.variants && it.product.variants[0] ? it.product.variants[0].purchasePrice : 0);

    prod.unitsSold += it.quantity;
    prod.grossRevenue += it.totalPrice;
    prod.cogs += (it.quantity * costPerUnit);
  }

  const result = Array.from(productMap.values()).map((p) => {
    const profit = Math.round((p.grossRevenue - p.cogs) * 100) / 100;
    const marginPct = p.grossRevenue > 0
      ? Math.round(((profit / p.grossRevenue) * 100) * 10) / 10
      : 0;

    return {
      productId: p.productId,
      name: p.name,
      code: p.code,
      category: p.category,
      uom: p.uom,
      unitsSold: p.unitsSold,
      grossRevenue: Math.round(p.grossRevenue * 100) / 100,
      costOfGoodsSold: Math.round(p.cogs * 100) / 100,
      grossProfit: profit,
      marginPercentage: marginPct,
    };
  });

  result.sort((a, b) => b.grossProfit - a.grossProfit);

  return result.slice(0, 10);
}

/**
 * 4. Revenue & Profit Time-Series Trend (Daily / Weekly / Monthly) for Visual Charts
 */
async function getRevenueTrend(shopId, query = {}) {
  const dateRange = resolveDateRange(query.fromDate, query.toDate, query.timeframe);

  const invoiceWhere = { shopId };
  if (dateRange) invoiceWhere.createdAt = dateRange;

  const expenseWhere = { shopId };
  if (dateRange) expenseWhere.expenseDate = dateRange;

  const [invoices, expenses] = await Promise.all([
    prisma.invoice.findMany({
      where: invoiceWhere,
      select: {
        createdAt: true,
        totalAmount: true,
        items: {
          select: {
            quantity: true,
            totalPrice: true,
            batch: { select: { purchasePrice: true } },
            product: {
              select: {
                variants: { where: { isActive: true }, select: { purchasePrice: true }, take: 1 },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.expense.findMany({
      where: expenseWhere,
      select: {
        expenseDate: true,
        amount: true,
      },
      orderBy: { expenseDate: 'asc' },
    }),
  ]);

  const timelineMap = new Map();

  for (const inv of invoices) {
    const dateKey = inv.createdAt.toISOString().split('T')[0];
    if (!timelineMap.has(dateKey)) {
      timelineMap.set(dateKey, { date: dateKey, revenue: 0, cogs: 0, expenses: 0 });
    }

    const entry = timelineMap.get(dateKey);
    entry.revenue += inv.totalAmount;

    for (const it of inv.items) {
      const costPerUnit = (it.batch && it.batch.purchasePrice)
        ? it.batch.purchasePrice
        : (it.product && it.product.variants && it.product.variants[0] ? it.product.variants[0].purchasePrice : 0);
      entry.cogs += (it.quantity * costPerUnit);
    }
  }

  for (const exp of expenses) {
    const dateKey = exp.expenseDate.toISOString().split('T')[0];
    if (!timelineMap.has(dateKey)) {
      timelineMap.set(dateKey, { date: dateKey, revenue: 0, cogs: 0, expenses: 0 });
    }

    const entry = timelineMap.get(dateKey);
    entry.expenses += exp.amount;
  }

  const sortedDates = Array.from(timelineMap.keys()).sort();
  const trend = sortedDates.map((date) => {
    const d = timelineMap.get(date);
    const grossProfit = Math.round((d.revenue - d.cogs) * 100) / 100;
    const netProfit = Math.round((grossProfit - d.expenses) * 100) / 100;

    return {
      date: d.date,
      revenue: Math.round(d.revenue * 100) / 100,
      cogs: Math.round(d.cogs * 100) / 100,
      grossProfit,
      expenses: Math.round(d.expenses * 100) / 100,
      netProfit,
    };
  });

  return trend;
}

module.exports = {
  resolveDateRange,
  getRevenueSummary,
  getRevenueByCategory,
  getTopProfitProducts,
  getRevenueTrend,
};
