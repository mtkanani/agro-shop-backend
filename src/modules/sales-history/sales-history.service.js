const { prisma } = require('../../config/database');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');
const { paginateThroughQuery } = require('../../utils/paginationLoop');

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
        const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Monday
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
 * Builds Prisma WHERE clause for Invoices based on multi-dimensional filters
 */
function buildInvoiceWhere(shopId, query = {}) {
  const where = { shopId };

  if (query.farmerId) {
    where.farmerId = query.farmerId;
  }

  const cashierId = query.userId || query.cashierId;
  if (cashierId) {
    where.userId = cashierId;
  }

  if (query.paymentStatus) {
    where.paymentStatus = query.paymentStatus;
  }

  if (query.paymentMethod) {
    where.paymentMethod = query.paymentMethod;
  }

  const dateRange = resolveDateRange(query.fromDate, query.toDate, query.timeframe);
  if (dateRange) {
    where.createdAt = dateRange;
  }

  if (query.minAmount !== undefined || query.maxAmount !== undefined) {
    where.totalAmount = {};
    if (query.minAmount !== undefined && query.minAmount !== null && query.minAmount !== '') {
      where.totalAmount.gte = Number(query.minAmount);
    }
    if (query.maxAmount !== undefined && query.maxAmount !== null && query.maxAmount !== '') {
      where.totalAmount.lte = Number(query.maxAmount);
    }
  }

  // Nested relation filters on line items
  const itemConditions = {};
  if (query.productId) {
    itemConditions.productId = query.productId;
  }
  if (query.categoryId) {
    itemConditions.product = { categoryId: query.categoryId };
  }
  if (query.batchNumber) {
    itemConditions.batch = {
      batchNumber: { contains: query.batchNumber.trim(), mode: 'insensitive' },
    };
  }

  if (Object.keys(itemConditions).length > 0) {
    where.items = { some: itemConditions };
  }

  // Search across invoice number, farmer name, farmer phone, and notes
  if (query.search && query.search.trim()) {
    const term = query.search.trim();
    where.OR = [
      { invoiceNumber: { contains: term, mode: 'insensitive' } },
      { farmer: { name: { contains: term, mode: 'insensitive' } } },
      { farmer: { phone: { contains: term, mode: 'insensitive' } } },
      { notes: { contains: term, mode: 'insensitive' } },
    ];
  }

  return where;
}

/**
 * 1. Filtered Invoices History with Indexed Pagination and Relations
 */
async function getSalesHistory(shopId, query = {}) {
  const { page, limit, skip } = getPagination(query);
  const where = buildInvoiceWhere(shopId, query);

  const sortBy = query.sortBy || 'createdAt';
  const sortOrder = (query.sortOrder || 'desc').toLowerCase();

  const [invoices, totalRecords] = await prisma.$transaction([
    prisma.invoice.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        farmer: {
          select: {
            id: true,
            name: true,
            phone: true,
            village: true,
            khataBalance: true,
          },
        },
        user: {
          select: {
            id: true,
            fullName: true,
            role: true,
          },
        },
        items: {
          select: {
            id: true,
            productId: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
            product: {
              select: {
                id: true,
                name: true,
                uom: true,
                category: { select: { id: true, name: true } },
              },
            },
            batch: {
              select: {
                id: true,
                batchNumber: true,
                expiryDate: true,
              },
            },
          },
        },
        salesReturns: {
          select: {
            id: true,
            returnNumber: true,
            returnAmount: true,
            status: true,
          },
        },
        payments: {
          select: {
            id: true,
            paymentNumber: true,
            amount: true,
            method: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.invoice.count({ where }),
  ]);

  const formattedInvoices = invoices.map((inv) => {
    const totalReturnedAmount = (inv.salesReturns || []).reduce(
      (sum, r) => (r.status !== 'REVERSED' ? sum + (r.returnAmount || 0) : sum),
      0
    );
    const totalQuantitySold = (inv.items || []).reduce((sum, it) => sum + (it.quantity || 0), 0);
    const balanceDue = Math.max(0, inv.totalAmount - inv.paidAmount);

    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      createdAt: inv.createdAt,
      farmer: inv.farmer
        ? {
            id: inv.farmer.id,
            name: inv.farmer.name,
            phone: inv.farmer.phone,
            village: inv.farmer.village,
            currentKhataBalance: inv.farmer.khataBalance,
          }
        : {
            name: 'Walk-in Customer',
            phone: '',
            village: '',
            currentKhataBalance: 0,
          },
      cashier: inv.user ? { id: inv.user.id, name: inv.user.fullName, role: inv.user.role } : null,
      subTotal: inv.subTotal,
      taxAmount: inv.taxAmount,
      discount: inv.discount,
      totalAmount: inv.totalAmount,
      paidAmount: inv.paidAmount,
      balanceDue,
      paymentStatus: inv.paymentStatus,
      paymentMethod: inv.paymentMethod,
      totalItemsCount: totalQuantitySold,
      uniqueProductsCount: inv.items.length,
      productSummary: inv.items.slice(0, 3).map((it) => ({
        name: it.product ? it.product.name : 'Unknown Product',
        quantity: it.quantity,
        batchNumber: it.batch ? it.batch.batchNumber : null,
      })),
      hasReturns: totalReturnedAmount > 0,
      totalReturnedAmount,
      netSalesAmount: Math.max(0, inv.totalAmount - totalReturnedAmount),
      notes: inv.notes,
    };
  });

  const pagination = getPaginationMeta(totalRecords, page, limit);

  return { invoices: formattedInvoices, pagination };
}

/**
 * 2. Instant Aggregated Metrics for the Current Filtered Query
 */
async function getSalesMetrics(shopId, query = {}) {
  const where = buildInvoiceWhere(shopId, query);

  const [aggregates, paymentMethodGroup, paymentStatusGroup] = await Promise.all([
    prisma.invoice.aggregate({
      where,
      _count: { id: true },
      _sum: {
        subTotal: true,
        totalAmount: true,
        paidAmount: true,
        taxAmount: true,
        discount: true,
      },
      _avg: {
        totalAmount: true,
      },
    }),
    prisma.invoice.groupBy({
      by: ['paymentMethod'],
      where,
      _count: { id: true },
      _sum: { totalAmount: true },
    }),
    prisma.invoice.groupBy({
      by: ['paymentStatus'],
      where,
      _count: { id: true },
      _sum: { totalAmount: true },
    }),
  ]);

  const totalInvoices = aggregates._count.id || 0;
  const totalGrossRevenue = aggregates._sum.totalAmount || 0;
  const totalPaidAmount = aggregates._sum.paidAmount || 0;
  const totalTaxAmount = aggregates._sum.taxAmount || 0;
  const totalDiscountAmount = aggregates._sum.discount || 0;
  const totalDueAmount = Math.max(0, totalGrossRevenue - totalPaidAmount);
  const averageOrderValue = totalInvoices > 0 ? Math.round(((aggregates._avg.totalAmount || 0) * 100)) / 100 : 0;

  // Compute returns in the same period
  const returnWhere = { shopId, status: { not: 'REVERSED' } };
  const dateRange = resolveDateRange(query.fromDate, query.toDate, query.timeframe);
  if (dateRange) {
    returnWhere.createdAt = dateRange;
  }
  const returnsAgg = await prisma.salesReturn.aggregate({
    where: returnWhere,
    _count: { id: true },
    _sum: { returnAmount: true },
  });

  const totalReturnedAmount = returnsAgg._sum.returnAmount || 0;
  const netRevenue = Math.max(0, totalGrossRevenue - totalReturnedAmount);

  return {
    summary: {
      totalInvoices,
      totalGrossRevenue,
      totalPaidAmount,
      totalDueAmount,
      totalTaxAmount,
      totalDiscountAmount,
      averageOrderValue,
      totalReturnsCount: returnsAgg._count.id || 0,
      totalReturnedAmount,
      netRevenue,
    },
    paymentMethodsBreakdown: paymentMethodGroup.map((g) => ({
      method: g.paymentMethod,
      count: g._count.id,
      amount: g._sum.totalAmount || 0,
    })),
    paymentStatusBreakdown: paymentStatusGroup.map((g) => ({
      status: g.paymentStatus,
      count: g._count.id,
      amount: g._sum.totalAmount || 0,
    })),
  };
}

/**
 * 3. Item-Level Sales & Batch Traceability Ledger
 */
async function getItemizedSalesHistory(shopId, query = {}) {
  const { page, limit, skip } = getPagination(query);

  const itemWhere = {
    invoice: { shopId },
  };

  if (query.farmerId) {
    itemWhere.invoice.farmerId = query.farmerId;
  }
  if (query.productId) {
    itemWhere.productId = query.productId;
  }
  if (query.categoryId) {
    itemWhere.product = { categoryId: query.categoryId };
  }
  if (query.batchNumber) {
    itemWhere.batch = {
      batchNumber: { contains: query.batchNumber.trim(), mode: 'insensitive' },
    };
  }

  const dateRange = resolveDateRange(query.fromDate, query.toDate, query.timeframe);
  if (dateRange) {
    itemWhere.createdAt = dateRange;
  }

  if (query.search && query.search.trim()) {
    const term = query.search.trim();
    itemWhere.OR = [
      { product: { name: { contains: term, mode: 'insensitive' } } },
      { invoice: { invoiceNumber: { contains: term, mode: 'insensitive' } } },
      { invoice: { farmer: { name: { contains: term, mode: 'insensitive' } } } },
      { batch: { batchNumber: { contains: term, mode: 'insensitive' } } },
    ];
  }

  const sortBy = query.sortBy || 'createdAt';
  const sortOrder = (query.sortOrder || 'desc').toLowerCase();

  const [items, totalRecords] = await prisma.$transaction([
    prisma.invoiceItem.findMany({
      where: itemWhere,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            code: true,
            uom: true,
            category: { select: { id: true, name: true } },
          },
        },
        batch: {
          select: {
            id: true,
            batchNumber: true,
            expiryDate: true,
            mrp: true,
            sellingPrice: true,
          },
        },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            createdAt: true,
            paymentStatus: true,
            farmer: {
              select: {
                id: true,
                name: true,
                phone: true,
                village: true,
              },
            },
          },
        },
      },
    }),
    prisma.invoiceItem.count({ where: itemWhere }),
  ]);

  const formattedItems = items.map((it) => ({
    id: it.id,
    invoiceId: it.invoice.id,
    invoiceNumber: it.invoice.invoiceNumber,
    date: it.invoice.createdAt,
    farmerName: it.invoice.farmer ? it.invoice.farmer.name : 'Walk-in Customer',
    farmerPhone: it.invoice.farmer ? it.invoice.farmer.phone : '',
    farmerVillage: it.invoice.farmer ? it.invoice.farmer.village : '',
    productId: it.productId,
    productName: it.product ? it.product.name : 'Unknown Product',
    productCode: it.product ? it.product.code : '',
    category: it.product && it.product.category ? it.product.category.name : '',
    uom: it.product ? it.product.uom : 'UNIT',
    batchNumber: it.batch ? it.batch.batchNumber : null,
    expiryDate: it.batch ? it.batch.expiryDate : null,
    mrp: it.batch ? it.batch.mrp : null,
    quantity: it.quantity,
    unitPrice: it.unitPrice,
    taxRate: it.taxRate,
    taxAmount: it.taxAmount,
    totalPrice: it.totalPrice,
    paymentStatus: it.invoice.paymentStatus,
  }));

  const pagination = getPaginationMeta(totalRecords, page, limit);

  return { items: formattedItems, pagination };
}

/**
 * 4. Comprehensive Farmer Purchase History & Profile
 */
async function getFarmerSalesTimeline(shopId, farmerId, query = {}) {
  const farmer = await prisma.farmer.findFirst({
    where: { id: farmerId, shopId },
  });

  if (!farmer) {
    const err = new Error('Farmer not found in this shop');
    err.statusCode = 404;
    throw err;
  }

  const { page, limit, skip } = getPagination(query);

  const where = { shopId, farmerId };
  const dateRange = resolveDateRange(query.fromDate, query.toDate, query.timeframe);
  if (dateRange) {
    where.createdAt = dateRange;
  }
  if (query.paymentStatus) {
    where.paymentStatus = query.paymentStatus;
  }

  const [invoices, totalRecords, lifetimeAgg, topItems] = await Promise.all([
    prisma.invoice.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            product: { select: { name: true, uom: true } },
            batch: { select: { batchNumber: true } },
          },
        },
        payments: {
          select: { paymentNumber: true, amount: true, method: true, createdAt: true },
        },
      },
    }),
    prisma.invoice.count({ where }),
    prisma.invoice.aggregate({
      where: { shopId, farmerId },
      _count: { id: true },
      _sum: { totalAmount: true, paidAmount: true },
      _avg: { totalAmount: true },
    }),
    prisma.invoiceItem.groupBy({
      by: ['productId'],
      where: { invoice: { shopId, farmerId } },
      _sum: { quantity: true, totalPrice: true },
      _count: { id: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    }),
  ]);

  // Hydrate top product details
  const productIds = topItems.map((item) => item.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, category: { select: { name: true } } },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  const topPurchasedProducts = topItems.map((item) => {
    const prod = productMap.get(item.productId);
    return {
      productId: item.productId,
      productName: prod ? prod.name : 'Unknown',
      category: prod && prod.category ? prod.category.name : '',
      totalQuantityPurchased: item._sum.quantity || 0,
      totalSpend: item._sum.totalPrice || 0,
      purchaseCount: item._count.id || 0,
    };
  });

  const lifetimeTotal = lifetimeAgg._sum.totalAmount || 0;
  const lifetimePaid = lifetimeAgg._sum.paidAmount || 0;

  return {
    farmer: {
      id: farmer.id,
      name: farmer.name,
      phone: farmer.phone,
      village: farmer.village,
      address: farmer.address,
      creditLimit: farmer.creditLimit,
      khataBalance: farmer.khataBalance,
    },
    lifetimeMetrics: {
      totalPurchasesCount: lifetimeAgg._count.id || 0,
      lifetimeSpend: lifetimeTotal,
      lifetimePaid,
      lifetimeOutstandingDue: Math.max(0, lifetimeTotal - lifetimePaid),
      averageBillValue: lifetimeAgg._count.id ? Math.round(((lifetimeAgg._avg.totalAmount || 0) * 100)) / 100 : 0,
    },
    topPurchasedProducts,
    purchases: {
      invoices,
      pagination: getPaginationMeta(totalRecords, page, limit),
    },
  };
}

/**
 * 5. Deep 360° Historical Sale Audit View
 */
async function getSaleDetailById(shopId, invoiceId) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, shopId },
    include: {
      farmer: true,
      user: {
        select: { id: true, fullName: true, email: true, role: true },
      },
      items: {
        include: {
          product: {
            include: {
              category: true,
              productType: true,
            },
          },
          batch: true,
          salesReturnItems: {
            include: {
              salesReturn: {
                select: { id: true, returnNumber: true, status: true, createdAt: true },
              },
            },
          },
        },
      },
      payments: true,
      paymentAllocations: {
        include: {
          payment: {
            select: { id: true, paymentNumber: true, amount: true, method: true, createdAt: true },
          },
        },
      },
      salesReturns: {
        include: {
          items: true,
        },
      },
    },
  });

  if (!invoice) {
    const err = new Error('Invoice not found in sales history');
    err.statusCode = 404;
    throw err;
  }

  const totalReturned = (invoice.salesReturns || []).reduce(
    (acc, ret) => (ret.status !== 'REVERSED' ? acc + (ret.returnAmount || 0) : acc),
    0
  );

  return {
    ...invoice,
    summary: {
      balanceDue: Math.max(0, invoice.totalAmount - invoice.paidAmount),
      totalReturnedAmount: totalReturned,
      netPayable: Math.max(0, invoice.totalAmount - totalReturned),
    },
  };
}

/**
 * Helper: Convert Array of Objects to CSV
 */
function convertToCSV(dataArray) {
  if (!dataArray || dataArray.length === 0) return 'No data available';
  const headers = Object.keys(dataArray[0]);
  const csvRows = [headers.join(',')];

  for (const row of dataArray) {
    const values = headers.map((header) => {
      let val = row[header] === null || row[header] === undefined ? '' : String(row[header]);
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        val = `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

/**
 * 6. Memory-Safe Streaming CSV Export via Pagination Loop
 */
async function exportSalesHistory(shopId, query = {}) {
  const exportType = (query.type || 'INVOICES').toUpperCase();
  const rows = [];
  const CHUNK_SIZE = 500;

  if (exportType === 'ITEMIZED') {
    const itemWhere = { invoice: { shopId } };
    if (query.farmerId) itemWhere.invoice.farmerId = query.farmerId;
    if (query.productId) itemWhere.productId = query.productId;
    if (query.categoryId) itemWhere.product = { categoryId: query.categoryId };
    if (query.batchNumber) {
      itemWhere.batch = { batchNumber: { contains: query.batchNumber.trim(), mode: 'insensitive' } };
    }
    const dateRange = resolveDateRange(query.fromDate, query.toDate, query.timeframe);
    if (dateRange) itemWhere.createdAt = dateRange;

    await paginateThroughQuery(prisma.invoiceItem, {
      where: itemWhere,
      include: {
        product: { select: { name: true, code: true, category: { select: { name: true } } } },
        batch: { select: { batchNumber: true, expiryDate: true } },
        invoice: {
          select: {
            invoiceNumber: true,
            createdAt: true,
            paymentStatus: true,
            farmer: { select: { name: true, phone: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      chunkSize: CHUNK_SIZE,
      onBatch: (items) => {
        for (const it of items) {
          rows.push({
            'Invoice Number': it.invoice.invoiceNumber,
            'Date': it.invoice.createdAt.toISOString().split('T')[0],
            'Farmer Name': it.invoice.farmer ? it.invoice.farmer.name : 'Walk-in Customer',
            'Farmer Phone': it.invoice.farmer ? it.invoice.farmer.phone : '',
            'Product Name': it.product ? it.product.name : '',
            'Product Code': it.product ? it.product.code : '',
            'Category': it.product && it.product.category ? it.product.category.name : '',
            'Batch Number': it.batch ? it.batch.batchNumber : '',
            'Expiry Date': it.batch && it.batch.expiryDate ? it.batch.expiryDate.toISOString().split('T')[0] : '',
            'Quantity': it.quantity,
            'Unit Price': it.unitPrice,
            'Tax Amount': it.taxAmount,
            'Total Price': it.totalPrice,
            'Payment Status': it.invoice.paymentStatus,
          });
        }
      },
    });
  } else {
    // Default: INVOICES
    const where = buildInvoiceWhere(shopId, query);
    await paginateThroughQuery(prisma.invoice, {
      where,
      include: {
        farmer: { select: { name: true, phone: true, village: true } },
        user: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      chunkSize: CHUNK_SIZE,
      onBatch: (invoices) => {
        for (const inv of invoices) {
          rows.push({
            'Invoice Number': inv.invoiceNumber,
            'Date': inv.createdAt.toISOString().split('T')[0],
            'Farmer Name': inv.farmer ? inv.farmer.name : 'Walk-in Customer',
            'Farmer Phone': inv.farmer ? inv.farmer.phone : '',
            'Village': inv.farmer ? inv.farmer.village || '' : '',
            'SubTotal': inv.subTotal,
            'Tax Amount': inv.taxAmount,
            'Discount': inv.discount,
            'Total Amount': inv.totalAmount,
            'Paid Amount': inv.paidAmount,
            'Balance Due': Math.max(0, inv.totalAmount - inv.paidAmount),
            'Payment Status': inv.paymentStatus,
            'Payment Method': inv.paymentMethod,
            'Billed By': inv.user ? inv.user.fullName : '',
          });
        }
      },
    });
  }

  if (query.format === 'json') {
    return { data: rows, contentType: 'application/json' };
  }

  const csv = convertToCSV(rows);
  return { data: csv, contentType: 'text/csv' };
}

module.exports = {
  resolveDateRange,
  buildInvoiceWhere,
  getSalesHistory,
  getSalesMetrics,
  getItemizedSalesHistory,
  getFarmerSalesTimeline,
  getSaleDetailById,
  exportSalesHistory,
};
