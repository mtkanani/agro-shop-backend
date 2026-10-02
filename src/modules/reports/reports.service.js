const { prisma } = require('../../config/database');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

function getDateRange(query = {}) {
  const { filter, fromDate, toDate, startDate, endDate } = query;
  const now = new Date();

  const start = (queryDate) => {
    const d = new Date(queryDate);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const end = (queryDate) => {
    const d = new Date(queryDate);
    d.setHours(23, 59, 59, 999);
    return d;
  };

  if (filter === 'today') {
    return { gte: start(now), lte: end(now) };
  }

  if (filter === 'yesterday') {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return { gte: start(y), lte: end(y) };
  }

  if (filter === 'this_week' || filter === 'week') {
    const s = new Date(now);
    const day = s.getDay() || 7;
    s.setDate(s.getDate() - day + 1);
    return { gte: start(s), lte: end(now) };
  }

  if (filter === 'last_week') {
    const s = new Date(now);
    const day = s.getDay() || 7;
    s.setDate(s.getDate() - day - 6);
    const e = new Date(s);
    e.setDate(e.getDate() + 6);
    return { gte: start(s), lte: end(e) };
  }

  if (filter === 'this_month' || filter === 'month') {
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    return { gte: start(s), lte: end(now) };
  }

  if (filter === 'last_month') {
    const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const e = new Date(now.getFullYear(), now.getMonth(), 0);
    return { gte: start(s), lte: end(e) };
  }

  if (filter === 'this_year' || filter === 'year') {
    const s = new Date(now.getFullYear(), 0, 1);
    return { gte: start(s), lte: end(now) };
  }

  const customFrom = fromDate || startDate;
  const customTo = toDate || endDate;

  if (customFrom || customTo) {
    const range = {};
    if (customFrom) range.gte = start(customFrom);
    if (customTo) range.lte = end(customTo);
    return range;
  }

  return null;
}

// 1. Sales Report
async function getSalesReport(query = {}) {
  const where = { paymentStatus: { not: 'CANCELLED' } };
  if (query.shopId) where.shopId = query.shopId;
  const dateRange = getDateRange(query);
  if (dateRange) where.createdAt = dateRange;

  const { page, limit, skip } = getPagination(query);

  const [total, activeInvoices, cancelledCount] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      skip,
      take: limit,
      include: {
        farmer: { select: { id: true, name: true, phone: true, village: true } },
        items: { include: { product: { select: { id: true, name: true, shortName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.invoice.count({
      where: {
        ...(query.shopId ? { shopId: query.shopId } : {}),
        paymentStatus: 'CANCELLED',
        ...(dateRange ? { createdAt: dateRange } : {}),
      },
    }),
  ]);

  // Total shop-wide sales aggregation for period in O(1) memory
  const salesReturnsWhere = { status: 'COMPLETED' };
  if (query.shopId) salesReturnsWhere.shopId = query.shopId;
  if (dateRange) salesReturnsWhere.createdAt = dateRange;

  const [salesAgg, salesReturnAgg] = await Promise.all([
    prisma.invoice.aggregate({
      where,
      _sum: { subTotal: true, discount: true, totalAmount: true, paidAmount: true },
      _count: { id: true },
    }),
    prisma.salesReturn.aggregate({
      where: salesReturnsWhere,
      _sum: { returnAmount: true },
    }),
  ]);

  const totalBills = salesAgg._count.id || 0;
  const subTotalSum = salesAgg._sum.subTotal || 0;
  const discountSum = salesAgg._sum.discount || 0;
  const grossNetSales = salesAgg._sum.totalAmount || 0;
  const paidAmount = salesAgg._sum.paidAmount || 0;
  const grossSales = subTotalSum + discountSum;
  const creditSales = Math.max(0, grossNetSales - paidAmount);
  const salesReturnsAmount = salesReturnAgg._sum.returnAmount || 0;
  const netSales = Math.max(0, grossNetSales - salesReturnsAmount);

  return {
    period: query.filter || 'all',
    summary: {
      totalBills,
      grossSales,
      discount: discountSum,
      tax: 0, // No tax
      netSales,
      salesReturnsAmount,
      paidAmount,
      creditSales,
      cancelledSales: cancelledCount,
    },
    invoices: activeInvoices,
    pagination: getPaginationMeta(total, page, limit),
  };
}

// 2. Purchase Report
async function getPurchasesReport(query = {}) {
  const where = {};
  if (query.shopId) where.shopId = query.shopId;
  const dateRange = getDateRange(query);
  if (dateRange) where.createdAt = dateRange;

  const { page, limit, skip } = getPagination(query);

  const [total, batches] = await Promise.all([
    prisma.inventoryBatch.count({ where }),
    prisma.inventoryBatch.findMany({
      where,
      skip,
      take: limit,
      include: {
        product: { select: { id: true, name: true, shortName: true, code: true } },
        supplier: { select: { id: true, name: true, companyName: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const allBatches = await prisma.inventoryBatch.findMany({
    where,
    select: { quantity: true, purchasePrice: true, supplierId: true },
  });

  const purchaseReturnsWhere = { status: 'COMPLETED' };
  if (query.shopId) purchaseReturnsWhere.shopId = query.shopId;
  if (dateRange) purchaseReturnsWhere.createdAt = dateRange;

  const purchaseReturnAgg = await prisma.purchaseReturn.aggregate({
    where: purchaseReturnsWhere,
    _sum: { returnAmount: true },
  });
  const purchaseReturnsAmount = purchaseReturnAgg._sum.returnAmount || 0;

  let grossPurchases = 0;
  let totalQuantityPurchased = 0;
  const supplierIds = new Set();

  allBatches.forEach((b) => {
    grossPurchases += b.quantity * b.purchasePrice;
    totalQuantityPurchased += b.quantity;
    if (b.supplierId) supplierIds.add(b.supplierId);
  });

  const netPurchases = Math.max(0, grossPurchases - purchaseReturnsAmount);

  return {
    period: query.filter || 'all',
    summary: {
      totalPurchases: grossPurchases,
      purchaseReturnsAmount,
      netPurchases,
      totalRestocks: allBatches.length,
      supplierCount: supplierIds.size,
      totalQuantityPurchased,
    },
    batches,
    pagination: getPaginationMeta(total, page, limit),
  };
}

// 3. Profit Report
async function getProfitReport(query = {}) {
  const where = { paymentStatus: { not: 'CANCELLED' } };
  if (query.shopId) where.shopId = query.shopId;
  const dateRange = getDateRange(query);
  if (dateRange) where.createdAt = dateRange;

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      items: {
        include: {
          product: { select: { id: true, name: true, shortName: true, categoryId: true } },
          batch: { select: { purchasePrice: true } },
        },
      },
    },
  });

  let netSales = 0;
  let costOfGoodsSold = 0;
  const productProfitMap = {};

  for (const inv of invoices) {
    netSales += inv.totalAmount;
    for (const item of inv.items) {
      const unitCost = item.batch ? item.batch.purchasePrice : 0;
      const itemCost = item.quantity * unitCost;
      costOfGoodsSold += itemCost;

      const pId = item.productId;
      if (!productProfitMap[pId]) {
        productProfitMap[pId] = {
          productId: pId,
          name: item.product ? item.product.name : 'Unknown Product',
          shortName: item.product ? (item.product.shortName || item.product.name) : 'Unknown Product',
          quantitySold: 0,
          salesAmount: 0,
          costAmount: 0,
          grossProfit: 0,
        };
      }

      productProfitMap[pId].quantitySold += item.quantity;
      productProfitMap[pId].salesAmount += item.totalPrice;
      productProfitMap[pId].costAmount += itemCost;
      productProfitMap[pId].grossProfit += item.totalPrice - itemCost;
    }
  }

  const grossProfit = Math.max(0, netSales - costOfGoodsSold);
  const marginPercentage = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

  const productProfits = Object.values(productProfitMap).map((p) => ({
    ...p,
    marginPercentage: p.salesAmount > 0 ? Number(((p.grossProfit / p.salesAmount) * 100).toFixed(2)) : 0,
  }));

  productProfits.sort((a, b) => b.grossProfit - a.grossProfit);

  return {
    period: query.filter || 'all',
    summary: {
      netSales,
      costOfGoodsSold,
      grossProfit,
      marginPercentage: Number(marginPercentage.toFixed(2)),
      isEstimated: false,
    },
    products: productProfits,
  };
}

// 4. Product Sales Report
async function getProductSalesReport(query = {}) {
  const where = { paymentStatus: { not: 'CANCELLED' } };
  if (query.shopId) where.shopId = query.shopId;
  const dateRange = getDateRange(query);
  if (dateRange) where.createdAt = dateRange;

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      items: {
        include: {
          product: { select: { id: true, name: true, shortName: true, code: true, category: { select: { name: true } } } },
          batch: { select: { purchasePrice: true } },
        },
      },
    },
  });

  const map = {};
  invoices.forEach((inv) => {
    inv.items.forEach((item) => {
      if (query.productId && item.productId !== query.productId) return;
      if (query.categoryId && item.product && item.product.categoryId !== query.categoryId) return;

      const pId = item.productId;
      if (!map[pId]) {
        map[pId] = {
          productId: pId,
          name: item.product ? item.product.name : 'Unknown Product',
          shortName: item.product ? (item.product.shortName || item.product.name) : 'Unknown Product',
          code: item.product ? item.product.code : 'N/A',
          category: item.product && item.product.category ? item.product.category.name : 'Uncategorized',
          quantitySold: 0,
          revenue: 0,
          discount: 0,
          tax: 0,
          profit: 0,
        };
      }

      const unitCost = item.batch ? item.batch.purchasePrice : 0;
      const itemCost = item.quantity * unitCost;

      map[pId].quantitySold += item.quantity;
      map[pId].revenue += item.totalPrice;
      map[pId].profit += item.totalPrice - itemCost;
    });
  });

  const products = Object.values(map);

  const sortBy = query.sortBy || 'revenue';
  if (sortBy === 'quantity') products.sort((a, b) => b.quantitySold - a.quantitySold);
  else if (sortBy === 'profit') products.sort((a, b) => b.profit - a.profit);
  else products.sort((a, b) => b.revenue - a.revenue);

  return {
    period: query.filter || 'all',
    products,
  };
}

// 5. Product Purchase Report
async function getProductPurchasesReport(query = {}) {
  const where = {};
  if (query.shopId) where.shopId = query.shopId;
  const dateRange = getDateRange(query);
  if (dateRange) where.createdAt = dateRange;

  const batches = await prisma.inventoryBatch.findMany({
    where,
    include: {
      product: { select: { id: true, name: true, shortName: true, code: true, category: { select: { name: true } } } },
    },
  });

  const map = {};
  batches.forEach((b) => {
    const pId = b.productId;
    if (!map[pId]) {
      map[pId] = {
        productId: pId,
        name: b.product ? b.product.name : 'Unknown Product',
        shortName: b.product ? (b.product.shortName || b.product.name) : 'Unknown Product',
        category: b.product && b.product.category ? b.product.category.name : 'Uncategorized',
        quantityPurchased: 0,
        purchaseCost: 0,
      };
    }

    map[pId].quantityPurchased += b.quantity;
    map[pId].purchaseCost += b.quantity * b.purchasePrice;
  });

  const products = Object.values(map).sort((a, b) => b.purchaseCost - a.purchaseCost);

  return {
    period: query.filter || 'all',
    products,
  };
}

// 6. Category Sales Report
async function getCategorySalesReport(query = {}) {
  const where = { paymentStatus: { not: 'CANCELLED' } };
  if (query.shopId) where.shopId = query.shopId;
  const dateRange = getDateRange(query);
  if (dateRange) where.createdAt = dateRange;

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      items: {
        include: {
          product: { include: { category: true } },
          batch: { select: { purchasePrice: true } },
        },
      },
    },
  });

  const map = {};
  invoices.forEach((inv) => {
    inv.items.forEach((item) => {
      const catName = item.product && item.product.category ? item.product.category.name : 'Uncategorized';
      if (!map[catName]) {
        map[catName] = {
          categoryName: catName,
          productsCount: new Set(),
          quantitySold: 0,
          revenue: 0,
          profit: 0,
        };
      }

      const unitCost = item.batch ? item.batch.purchasePrice : 0;
      const itemCost = item.quantity * unitCost;

      map[catName].productsCount.add(item.productId);
      map[catName].quantitySold += item.quantity;
      map[catName].revenue += item.totalPrice;
      map[catName].profit += item.totalPrice - itemCost;
    });
  });

  const categories = Object.values(map).map((c) => ({
    categoryName: c.categoryName,
    productsCount: c.productsCount.size,
    quantitySold: c.quantitySold,
    revenue: c.revenue,
    profit: c.profit,
  })).sort((a, b) => b.revenue - a.revenue);

  return {
    period: query.filter || 'all',
    categories,
  };
}

// 7. Farmer Sales Report
async function getFarmerSalesReport(query = {}) {
  const where = { paymentStatus: { not: 'CANCELLED' }, farmerId: { not: null } };
  if (query.shopId) where.shopId = query.shopId;
  const dateRange = getDateRange(query);
  if (dateRange) where.createdAt = dateRange;

  const grouped = await prisma.invoice.groupBy({
    by: ['farmerId'],
    where,
    _sum: { totalAmount: true, paidAmount: true },
    _count: { id: true },
    orderBy: {
      _sum: {
        totalAmount: 'desc',
      },
    },
  });

  const farmerIds = grouped.map((g) => g.farmerId).filter(Boolean);
  const farmersList = farmerIds.length > 0
    ? await prisma.farmer.findMany({
        where: { id: { in: farmerIds } },
        select: { id: true, name: true, phone: true, village: true },
      })
    : [];
  const farmerMap = new Map(farmersList.map((f) => [f.id, f]));

  const farmers = grouped.map((g) => {
    const f = farmerMap.get(g.farmerId);
    const totalPurchases = g._sum.totalAmount || 0;
    const paidAmount = g._sum.paidAmount || 0;
    return {
      farmerId: g.farmerId,
      name: f ? f.name : 'Unknown Farmer',
      phone: f ? f.phone : 'N/A',
      village: f ? f.village : 'N/A',
      billsCount: g._count.id || 0,
      totalPurchases,
      paidAmount,
      dueAmount: Math.max(0, totalPurchases - paidAmount),
    };
  });

  return {
    period: query.filter || 'all',
    topFarmers: farmers.slice(0, 10),
    farmers,
  };
}

// 8. Supplier Purchase Report
async function getSupplierPurchasesReport(query = {}) {
  const where = { supplierId: { not: null } };
  if (query.shopId) where.shopId = query.shopId;
  const dateRange = getDateRange(query);
  if (dateRange) where.createdAt = dateRange;

  const batches = await prisma.inventoryBatch.findMany({
    where,
    include: {
      supplier: { select: { id: true, name: true, companyName: true, phone: true } },
    },
  });

  const map = {};
  batches.forEach((b) => {
    const sId = b.supplierId;
    if (!map[sId]) {
      map[sId] = {
        supplierId: sId,
        name: b.supplier ? b.supplier.name : 'Unknown Supplier',
        companyName: b.supplier ? b.supplier.companyName : 'N/A',
        phone: b.supplier ? b.supplier.phone : 'N/A',
        restocksCount: 0,
        productsSupplied: new Set(),
        totalPurchaseAmount: 0,
      };
    }

    map[sId].restocksCount += 1;
    map[sId].productsSupplied.add(b.productId);
    map[sId].totalPurchaseAmount += b.quantity * b.purchasePrice;
  });

  const suppliers = Object.values(map).map((s) => ({
    supplierId: s.supplierId,
    name: s.name,
    companyName: s.companyName,
    phone: s.phone,
    restocksCount: s.restocksCount,
    productsSuppliedCount: s.productsSupplied.size,
    totalPurchaseAmount: s.totalPurchaseAmount,
  })).sort((a, b) => b.totalPurchaseAmount - a.totalPurchaseAmount);

  return {
    period: query.filter || 'all',
    topSuppliers: suppliers.slice(0, 10),
    suppliers,
  };
}

// 9. Payment Collection Report
async function getPaymentCollectionReport(query = {}) {
  const where = {};
  if (query.shopId) where.shopId = query.shopId;
  const dateRange = getDateRange(query);
  if (dateRange) where.createdAt = dateRange;

  const payments = await prisma.payment.findMany({
    where,
    include: {
      farmer: { select: { id: true, name: true, phone: true } },
      invoice: { select: { id: true, invoiceNumber: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const byMethod = { CASH: 0, UPI: 0, CARD: 0, BANK_TRANSFER: 0, CHEQUE: 0, CREDIT: 0 };
  let totalCollected = 0;

  payments.forEach((p) => {
    const method = p.method.toUpperCase();
    if (byMethod[method] !== undefined) byMethod[method] += p.amount;
    else byMethod.CASH += p.amount;

    totalCollected += p.amount;
  });

  return {
    period: query.filter || 'all',
    summary: {
      totalCollected,
      byMethod,
    },
    payments,
  };
}

// 10. Credit Report
async function getCreditReport(query = {}) {
  const farmerCreditService = require('../farmer-credit/farmer-credit.service');
  return farmerCreditService.getCreditOverview(query.shopId);
}

// 11. Inventory Movement Report
async function getInventoryMovementReport(query = {}) {
  const where = {};
  if (query.shopId) where.shopId = query.shopId;
  const dateRange = getDateRange(query);
  if (dateRange) where.createdAt = dateRange;

  const transactions = await prisma.stockTransaction.findMany({
    where,
    include: {
      product: { select: { id: true, name: true, shortName: true, code: true, uom: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const map = {};
  transactions.forEach((tx) => {
    const pId = tx.productId;
    if (!map[pId]) {
      map[pId] = {
        productId: pId,
        name: tx.product ? tx.product.name : 'Unknown Product',
        shortName: tx.product ? (tx.product.shortName || tx.product.name) : 'Unknown Product',
        unit: tx.product ? tx.product.uom : 'UNIT',
        openingStock: 0,
        stockIn: 0,
        stockOut: 0,
        adjustments: 0,
        closingStock: 0,
      };
    }

    const q = Math.abs(tx.quantity);
    if (tx.type === 'RESTOCK' || tx.type === 'STOCK_IN' || tx.type === 'OPENING_STOCK') {
      map[pId].stockIn += q;
      map[pId].closingStock += q;
    } else if (tx.type === 'SALE' || tx.type === 'STOCK_OUT') {
      map[pId].stockOut += q;
      map[pId].closingStock -= q;
    } else if (tx.type === 'ADJUSTMENT' || tx.type === 'DAMAGE') {
      const adj = tx.quantity;
      map[pId].adjustments += adj;
      map[pId].closingStock += adj;
    }
  });

  return {
    period: query.filter || 'all',
    movements: Object.values(map),
  };
}

// 12. Daily & Monthly Summary
async function getDailySummary(shopId, targetDate) {
  const date = targetDate ? new Date(targetDate) : new Date();
  const startOfDay = new Date(date.setHours(0, 0, 0, 0));
  const endOfDay = new Date(date.setHours(23, 59, 59, 999));

  const salesReport = await getSalesReport({ shopId, fromDate: startOfDay, toDate: endOfDay });
  const purchasesReport = await getPurchasesReport({ shopId, fromDate: startOfDay, toDate: endOfDay });
  const profitReport = await getProfitReport({ shopId, fromDate: startOfDay, toDate: endOfDay });
  const paymentsReport = await getPaymentCollectionReport({ shopId, fromDate: startOfDay, toDate: endOfDay });

  return {
    date: startOfDay.toISOString().split('T')[0],
    billsCount: salesReport.summary.totalBills,
    sales: salesReport.summary.netSales,
    purchases: purchasesReport.summary.totalPurchases,
    profit: profitReport.summary.grossProfit,
    paymentsCollected: paymentsReport.summary.totalCollected,
    creditGiven: salesReport.summary.creditSales,
  };
}

async function getMonthlySummary(shopId, year, month) {
  const now = new Date();
  const y = year ? parseInt(year, 10) : now.getFullYear();
  const m = month ? parseInt(month, 10) - 1 : now.getMonth();

  const startOfMonth = new Date(y, m, 1, 0, 0, 0, 0);
  const endOfMonth = new Date(y, m + 1, 0, 23, 59, 59, 999);

  const salesReport = await getSalesReport({ shopId, fromDate: startOfMonth, toDate: endOfMonth });
  const purchasesReport = await getPurchasesReport({ shopId, fromDate: startOfMonth, toDate: endOfMonth });
  const profitReport = await getProfitReport({ shopId, fromDate: startOfMonth, toDate: endOfMonth });

  return {
    month: `${y}-${String(m + 1).padStart(2, '0')}`,
    sales: salesReport.summary.netSales,
    purchases: purchasesReport.summary.totalPurchases,
    grossProfit: profitReport.summary.grossProfit,
    billsCount: salesReport.summary.totalBills,
    creditSales: salesReport.summary.creditSales,
  };
}

// 13. Trend Chart APIs
async function getSalesTrend(shopId, query = {}) {
  const where = { paymentStatus: { not: 'CANCELLED' } };
  if (shopId) where.shopId = shopId;
  const dateRange = getDateRange(query);
  if (dateRange) where.createdAt = dateRange;

  const invoices = await prisma.invoice.findMany({
    where,
    select: { totalAmount: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const map = {};
  invoices.forEach((inv) => {
    const day = inv.createdAt.toISOString().split('T')[0];
    if (!map[day]) map[day] = { date: day, salesAmount: 0, billsCount: 0 };
    map[day].salesAmount += inv.totalAmount;
    map[day].billsCount += 1;
  });

  return Object.values(map);
}

async function getPurchasesTrend(shopId, query = {}) {
  const where = {};
  if (shopId) where.shopId = shopId;
  const dateRange = getDateRange(query);
  if (dateRange) where.createdAt = dateRange;

  const batches = await prisma.inventoryBatch.findMany({
    where,
    select: { quantity: true, purchasePrice: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const map = {};
  batches.forEach((b) => {
    const day = b.createdAt.toISOString().split('T')[0];
    if (!map[day]) map[day] = { date: day, purchaseAmount: 0, restocksCount: 0 };
    map[day].purchaseAmount += b.quantity * b.purchasePrice;
    map[day].restocksCount += 1;
  });

  return Object.values(map);
}

async function getProfitTrend(shopId, query = {}) {
  const where = { paymentStatus: { not: 'CANCELLED' } };
  if (shopId) where.shopId = shopId;
  const dateRange = getDateRange(query);
  if (dateRange) where.createdAt = dateRange;

  const invoices = await prisma.invoice.findMany({
    where,
    include: { items: { include: { batch: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const map = {};
  invoices.forEach((inv) => {
    const day = inv.createdAt.toISOString().split('T')[0];
    if (!map[day]) map[day] = { date: day, revenue: 0, cost: 0, profit: 0 };

    map[day].revenue += inv.totalAmount;
    let invCost = 0;
    inv.items.forEach((item) => {
      invCost += item.quantity * (item.batch ? item.batch.purchasePrice : 0);
    });
    map[day].cost += invCost;
    map[day].profit += inv.totalAmount - invCost;
  });

  return Object.values(map);
}

module.exports = {
  getDateRange,
  getSalesReport,
  getPurchasesReport,
  getProfitReport,
  getProductSalesReport,
  getProductPurchasesReport,
  getCategorySalesReport,
  getFarmerSalesReport,
  getSupplierPurchasesReport,
  getPaymentCollectionReport,
  getCreditReport,
  getInventoryMovementReport,
  getDailySummary,
  getMonthlySummary,
  getSalesTrend,
  getPurchasesTrend,
  getProfitTrend,
};
