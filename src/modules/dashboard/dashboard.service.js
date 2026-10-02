const { prisma } = require('../../config/database');
const reportService = require('../reports/reports.service');

async function getDashboardSummary(shopId, query = {}) {
  if (!shopId) {
    const err = new Error('Shop ID is required for dashboard summary');
    err.statusCode = 400;
    throw err;
  }

  const dateRange = reportService.getDateRange(query.filter ? query : { filter: 'today' });
  const invoiceWhere = { shopId, paymentStatus: { not: 'CANCELLED' } };
  if (dateRange) invoiceWhere.createdAt = dateRange;

  const batchWhere = { shopId };
  if (dateRange) batchWhere.createdAt = dateRange;

  const paymentWhere = { shopId };
  if (dateRange) paymentWhere.createdAt = dateRange;

  const [
    salesAgg,
    invoiceItems,
    purchasesBatches,
    farmerAgg,
    overdueAgg,
    farmersCount,
    productsCount,
    variantsCount,
    stockProducts,
  ] = await Promise.all([
    // Sales aggregation: totalAmount sum and bill count in O(1) DB query
    prisma.invoice.aggregate({
      where: invoiceWhere,
      _sum: { totalAmount: true },
      _count: { id: true },
    }),
    // Minimal query for COGS
    prisma.invoiceItem.findMany({
      where: { invoice: invoiceWhere },
      select: {
        quantity: true,
        batch: { select: { purchasePrice: true } },
      },
    }),
    // Restock batches in date range
    prisma.inventoryBatch.findMany({
      where: batchWhere,
      select: { quantity: true, purchasePrice: true },
    }),
    // Outstanding farmer due
    prisma.farmer.aggregate({
      where: { shopId, khataBalance: { gt: 0 }, isActive: true },
      _sum: { khataBalance: true },
      _count: { id: true },
    }),
    // Overdue invoices aggregate in O(1) memory
    prisma.invoice.aggregate({
      where: {
        shopId,
        paymentStatus: { in: ['UNPAID', 'PARTIAL'] },
        createdAt: { lte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      _sum: { totalAmount: true, paidAmount: true },
    }),
    // Total active farmers count
    prisma.farmer.count({
      where: { shopId, isActive: true },
    }),
    // Total active products count
    prisma.product.count({
      where: { shopId, isActive: true },
    }),
    // Total product variants count
    prisma.productVariant.count({
      where: { product: { shopId, isActive: true } },
    }),
    // Products stock check - select only minStock and batch quantity
    prisma.product.findMany({
      where: { shopId, isActive: true },
      select: {
        minStock: true,
        batches: { where: { quantity: { gt: 0 } }, select: { quantity: true } },
      },
    }),
  ]);

  // 1. Sales Calculation
  const salesAmount = salesAgg._sum.totalAmount || 0;
  const invoiceCount = salesAgg._count.id || 0;

  let costOfGoodsSold = 0;
  invoiceItems.forEach((item) => {
    const unitCost = item.batch ? item.batch.purchasePrice : 0;
    costOfGoodsSold += item.quantity * unitCost;
  });

  // 2. Purchases Calculation
  let purchasesAmount = 0;
  purchasesBatches.forEach((b) => {
    purchasesAmount += b.quantity * b.purchasePrice;
  });

  // 3. Profit Calculation
  const profitAmount = Math.max(0, salesAmount - costOfGoodsSold);

  // 4. Credit Calculation
  const outstanding = Math.max(0, farmerAgg._sum.khataBalance || 0);
  const farmersWithDue = farmerAgg._count.id || 0;
  const overdue = Math.max(0, (overdueAgg._sum.totalAmount || 0) - (overdueAgg._sum.paidAmount || 0));

  // 5. Inventory Stock Status Calculation
  let lowStock = 0;
  let outOfStock = 0;

  stockProducts.forEach((p) => {
    const totalQty = p.batches.reduce((sum, b) => sum + b.quantity, 0);
    if (totalQty <= 0) {
      outOfStock++;
    } else if (totalQty <= p.minStock) {
      lowStock++;
    }
  });

  return {
    sales: {
      amount: salesAmount,
      invoiceCount,
    },
    purchases: {
      amount: purchasesAmount,
      count: purchasesBatches.length,
    },
    profit: {
      amount: profitAmount,
      isEstimated: false,
    },
    credit: {
      outstanding,
      overdue,
      farmersWithDue,
    },
    farmers: {
      total: farmersCount,
    },
    products: {
      total: productsCount,
      variants: variantsCount,
    },
    inventory: {
      lowStock,
      outOfStock,
    },
  };
}

async function getSalesTrend(shopId, query = {}) {
  return reportService.getSalesTrend(shopId, query);
}

async function getTopProducts(shopId, query = {}) {
  const report = await reportService.getProductSalesReport({ shopId, ...query });
  const limit = query.limit ? parseInt(query.limit, 10) : 5;
  return report.products.slice(0, limit);
}

async function getLowStockProducts(shopId) {
  const products = await prisma.product.findMany({
    where: { shopId, isActive: true },
    include: {
      variants: { select: { id: true, variantName: true, sku: true } },
      batches: { where: { quantity: { gt: 0 } } },
    },
  });

  const alerts = [];
  products.forEach((p) => {
    const totalStock = p.batches.reduce((sum, b) => sum + b.quantity, 0);
    if (totalStock <= p.minStock) {
      alerts.push({
        productId: p.id,
        productName: p.name,
        shortName: p.shortName || p.name,
        code: p.code,
        variant: p.variants.length > 0 ? p.variants[0].variantName : 'Default',
        currentStock: totalStock,
        minimumStock: p.minStock,
        status: totalStock <= 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK',
      });
    }
  });

  alerts.sort((a, b) => a.currentStock - b.currentStock);
  return alerts;
}

async function getCreditSummary(shopId) {
  const farmerCreditService = require('../farmer-credit/farmer-credit.service');
  const overview = await farmerCreditService.getCreditOverview(shopId);

  const topFarmersList = await prisma.farmer.findMany({
    where: { shopId, khataBalance: { gt: 0 }, isActive: true },
    select: { id: true, name: true, phone: true, village: true, khataBalance: true, creditLimit: true },
    orderBy: { khataBalance: 'desc' },
    take: 5,
  });

  return {
    ...overview,
    topFarmers: topFarmersList,
  };
}

async function getRecentSales(shopId, limit = 10) {
  const invoices = await prisma.invoice.findMany({
    where: { shopId, paymentStatus: { not: 'CANCELLED' } },
    take: parseInt(limit, 10),
    orderBy: { createdAt: 'desc' },
    include: {
      farmer: { select: { id: true, name: true, phone: true } },
    },
  });

  return invoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    farmerName: inv.farmer ? inv.farmer.name : 'Walk-in Customer',
    farmerPhone: inv.farmer ? inv.farmer.phone : 'N/A',
    totalAmount: inv.totalAmount,
    paidAmount: inv.paidAmount,
    dueAmount: Math.max(0, inv.totalAmount - inv.paidAmount),
    paymentStatus: inv.paymentStatus,
    paymentMethod: inv.paymentMethod,
    createdAt: inv.createdAt,
  }));
}

async function getRecentPayments(shopId, limit = 10) {
  const payments = await prisma.payment.findMany({
    where: { shopId },
    take: parseInt(limit, 10),
    orderBy: { createdAt: 'desc' },
    include: {
      farmer: { select: { id: true, name: true, phone: true } },
    },
  });

  return payments.map((p) => ({
    id: p.id,
    paymentNumber: p.paymentNumber,
    farmerName: p.farmer ? p.farmer.name : 'Walk-in Customer',
    amount: p.amount,
    method: p.method,
    txnRef: p.txnRef,
    createdAt: p.createdAt,
  }));
}

async function getRecentRestocks(shopId, limit = 10) {
  const batches = await prisma.inventoryBatch.findMany({
    where: { shopId },
    take: parseInt(limit, 10),
    orderBy: { createdAt: 'desc' },
    include: {
      supplier: { select: { id: true, name: true, companyName: true } },
      product: { select: { id: true, name: true, shortName: true } },
    },
  });

  return batches.map((b) => ({
    id: b.id,
    batchNumber: b.batchNumber,
    supplierName: b.supplier ? (b.supplier.companyName || b.supplier.name) : 'Direct Intake',
    productName: b.product ? (b.product.shortName || b.product.name) : 'Unknown Product',
    quantity: b.quantity,
    purchasePrice: b.purchasePrice,
    totalCost: b.quantity * b.purchasePrice,
    createdAt: b.createdAt,
  }));
}

module.exports = {
  getDashboardSummary,
  getSalesTrend,
  getTopProducts,
  getLowStockProducts,
  getCreditSummary,
  getRecentSales,
  getRecentPayments,
  getRecentRestocks,
};
