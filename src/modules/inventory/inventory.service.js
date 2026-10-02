const { prisma } = require('../../config/database');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');
const { emitShopEvent } = require('../../config/socket');
const { logAuditAction } = require('../../utils/auditLogger');

async function getInventoryMetrics(shopId) {
  if (!shopId) {
    const err = new Error('Shop ID is required for inventory metrics');
    err.statusCode = 400;
    throw err;
  }

  const currentDate = new Date();
  const nearExpiryDate = new Date();
  nearExpiryDate.setDate(currentDate.getDate() + 30);

  const [totalProducts, totalStockAgg, nearExpiryCount, expiredCount, productsWithBatches] = await Promise.all([
    prisma.product.count({ where: { shopId, isActive: true } }),
    prisma.inventoryBatch.aggregate({
      where: { shopId },
      _sum: { quantity: true },
    }),
    prisma.inventoryBatch.count({
      where: { shopId, quantity: { gt: 0 }, expiryDate: { gte: currentDate, lte: nearExpiryDate } },
    }),
    prisma.inventoryBatch.count({
      where: { shopId, quantity: { gt: 0 }, expiryDate: { lt: currentDate } },
    }),
    prisma.product.findMany({
      where: { shopId, isActive: true },
      select: {
        id: true,
        minStock: true,
        batches: { where: { quantity: { gt: 0 } }, select: { quantity: true } },
      },
    }),
  ]);

  let lowStockCount = 0;
  let outOfStockCount = 0;
  productsWithBatches.forEach((p) => {
    const stock = p.batches.reduce((sum, b) => sum + b.quantity, 0);
    if (stock === 0) {
      outOfStockCount++;
    } else if (stock <= p.minStock) {
      lowStockCount++;
    }
  });

  return {
    totalProducts,
    totalStock: totalStockAgg._sum.quantity || 0,
    lowStockCount,
    outOfStockCount,
    nearExpiryCount,
    expiredCount,
  };
}

async function getInventorySummary(query = {}) {
  const { page, limit, skip } = getPagination(query);
  const where = { isActive: true };

  if (query.shopId) {
    where.shopId = query.shopId;
  }

  if (query.categoryId) {
    where.categoryId = query.categoryId;
  }

  if (query.search) {
    const search = query.search.trim();
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { shortName: { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } },
      { brand: { contains: search, mode: 'insensitive' } },
      { barcode: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      include: {
        category: { select: { name: true } },
        variants: { select: { id: true } },
        batches: {
          where: { quantity: { gt: 0 } },
          orderBy: { expiryDate: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  let formatted = products.map((p) => {
    const totalStock = p.batches.reduce((sum, b) => sum + b.quantity, 0);
    let status = 'IN_STOCK';
    if (totalStock === 0) {
      status = 'OUT_OF_STOCK';
    } else if (totalStock <= p.minStock) {
      status = 'LOW_STOCK';
    }

    return {
      productId: p.id,
      name: p.name,
      shortName: p.shortName || p.name,
      code: p.code,
      brand: p.brand,
      barcode: p.barcode,
      category: p.category?.name || 'Uncategorized',
      unit: p.uom || 'UNIT',
      minStock: p.minStock,
      totalStock,
      status,
      isLowStock: totalStock <= p.minStock,
      variantsCount: p.variants.length,
      batchesCount: p.batches.length,
    };
  });

  // Filter by status if supplied
  if (query.status) {
    formatted = formatted.filter((item) => item.status === query.status);
  }

  return {
    inventory: formatted,
    pagination: getPaginationMeta(total, page, limit),
  };
}

async function getProductInventoryProfile(productId, shopId) {
  const where = { id: productId };
  if (shopId) {
    where.shopId = shopId;
  }

  const product = await prisma.product.findFirst({
    where,
    include: {
      category: true,
      variants: true,
      batches: {
        include: { supplier: true },
        orderBy: { expiryDate: 'asc' },
      },
    },
  });

  if (!product) {
    const error = new Error('Product not found in this shop');
    error.statusCode = 404;
    throw error;
  }

  const currentDate = new Date();
  const nearExpiryDate = new Date();
  nearExpiryDate.setDate(currentDate.getDate() + 30);

  const totalStock = product.batches.reduce((sum, b) => sum + b.quantity, 0);
  let status = 'IN_STOCK';
  if (totalStock === 0) {
    status = 'OUT_OF_STOCK';
  } else if (totalStock <= product.minStock) {
    status = 'LOW_STOCK';
  }

  let nearExpiryBatchesCount = 0;
  let expiredBatchesCount = 0;

  const formattedBatches = product.batches.map((b) => {
    let batchStatus = 'ACTIVE';
    if (b.quantity === 0) {
      batchStatus = 'DEPLETED';
    } else if (b.expiryDate) {
      const exp = new Date(b.expiryDate);
      if (exp < currentDate) {
        batchStatus = 'EXPIRED';
        expiredBatchesCount++;
      } else if (exp <= nearExpiryDate) {
        batchStatus = 'NEAR_EXPIRY';
        nearExpiryBatchesCount++;
      }
    }

    return {
      id: b.id,
      batchNumber: b.batchNumber,
      quantity: b.quantity,
      purchasePrice: b.purchasePrice,
      mrp: b.mrp,
      sellingPrice: b.sellingPrice,
      mfgDate: b.mfgDate,
      expiryDate: b.expiryDate,
      supplier: b.supplier ? { id: b.supplier.id, name: b.supplier.name, phone: b.supplier.phone } : null,
      status: batchStatus,
    };
  });

  return {
    product: {
      id: product.id,
      name: product.name,
      shortName: product.shortName || product.name,
      code: product.code,
      brand: product.brand,
      barcode: product.barcode,
      category: product.category?.name || 'Uncategorized',
      unit: product.uom || 'UNIT',
    },
    stock: {
      current: totalStock,
      minimum: product.minStock,
      status,
    },
    batchesCount: product.batches.length,
    nearExpiryBatchesCount,
    expiredBatchesCount,
    batches: formattedBatches,
  };
}

async function getProductBatches(productId, shopId) {
  const profile = await getProductInventoryProfile(productId, shopId);
  return profile.batches;
}

async function getLowStockProducts(query = {}) {
  const { inventory, pagination } = await getInventorySummary({ ...query, status: 'LOW_STOCK' });
  return { inventory, pagination };
}

async function getNearExpiryBatches(days = 30, shopId = null, query = {}) {
  const currentDate = new Date();
  const targetDate = new Date();
  targetDate.setDate(currentDate.getDate() + days);

  const where = {
    quantity: { gt: 0 },
    expiryDate: { gte: currentDate, lte: targetDate },
  };

  if (shopId) {
    where.shopId = shopId;
  }

  const isPaginated = query.page !== undefined || query.limit !== undefined;

  let batches;
  let total;
  let pagination;

  if (isPaginated) {
    const { page, limit, skip } = getPagination(query);
    [total, batches] = await Promise.all([
      prisma.inventoryBatch.count({ where }),
      prisma.inventoryBatch.findMany({
        where,
        skip,
        take: limit,
        include: {
          product: { select: { id: true, name: true, shortName: true, code: true, uom: true } },
          variant: { select: { id: true, variantName: true, sku: true } },
          supplier: { select: { id: true, name: true, phone: true } },
        },
        orderBy: { expiryDate: 'asc' },
      }),
    ]);
    pagination = getPaginationMeta(total, page, limit);
  } else {
    batches = await prisma.inventoryBatch.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, shortName: true, code: true, uom: true } },
        variant: { select: { id: true, variantName: true, sku: true } },
        supplier: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { expiryDate: 'asc' },
    });
  }

  const mappedBatches = batches.map((b) => {
    const daysRemaining = Math.ceil((new Date(b.expiryDate) - currentDate) / (1000 * 60 * 60 * 24));
    return {
      ...b,
      daysRemaining,
      status: 'NEAR_EXPIRY',
    };
  });

  if (isPaginated) {
    return {
      batches: mappedBatches,
      pagination,
    };
  }

  return mappedBatches;
}

async function getExpiredBatches(shopId = null, query = {}) {
  const currentDate = new Date();

  const where = {
    quantity: { gt: 0 },
    expiryDate: { lt: currentDate },
  };

  if (shopId) {
    where.shopId = shopId;
  }

  const isPaginated = query.page !== undefined || query.limit !== undefined;

  let batches;
  let total;
  let pagination;

  if (isPaginated) {
    const { page, limit, skip } = getPagination(query);
    [total, batches] = await Promise.all([
      prisma.inventoryBatch.count({ where }),
      prisma.inventoryBatch.findMany({
        where,
        skip,
        take: limit,
        include: {
          product: { select: { id: true, name: true, shortName: true, code: true, uom: true } },
          variant: { select: { id: true, variantName: true, sku: true } },
          supplier: { select: { id: true, name: true, phone: true } },
        },
        orderBy: { expiryDate: 'asc' },
      }),
    ]);
    pagination = getPaginationMeta(total, page, limit);
  } else {
    batches = await prisma.inventoryBatch.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, shortName: true, code: true, uom: true } },
        variant: { select: { id: true, variantName: true, sku: true } },
        supplier: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { expiryDate: 'asc' },
    });
  }

  const mappedBatches = batches.map((b) => ({
    ...b,
    status: 'EXPIRED',
  }));

  if (isPaginated) {
    return {
      batches: mappedBatches,
      pagination,
    };
  }

  return mappedBatches;
}

async function stockIn(data) {
  const { shopId, productId, variantId, supplierId, batchNumber, quantity, purchasePrice, sellingPrice, mrp, expiryDate, createdById } = data;

  const product = await prisma.product.findFirst({
    where: { id: productId, shopId, isActive: true },
  });

  if (!product) {
    const error = new Error('Product not found or inactive in this shop');
    error.statusCode = 404;
    throw error;
  }

  let targetVariantId = variantId;
  if (!targetVariantId) {
    const firstVariant = await prisma.productVariant.findFirst({
      where: { productId },
    });
    if (firstVariant) {
      targetVariantId = firstVariant.id;
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    let batch = await tx.inventoryBatch.findFirst({
      where: {
        shopId,
        productId,
        batchNumber: batchNumber.trim(),
      },
    });

    if (batch) {
      batch = await tx.inventoryBatch.update({
        where: { id: batch.id },
        data: {
          quantity: { increment: quantity },
          purchasePrice: purchasePrice || batch.purchasePrice,
          sellingPrice: sellingPrice || batch.sellingPrice,
          mrp: mrp || batch.mrp,
          supplierId: supplierId || batch.supplierId,
        },
      });
    } else {
      batch = await tx.inventoryBatch.create({
        data: {
          shopId,
          productId,
          variantId: targetVariantId,
          supplierId,
          batchNumber: batchNumber.trim(),
          quantity,
          purchasePrice: purchasePrice || 0,
          sellingPrice: sellingPrice || 0,
          mrp: mrp || 0,
          expiryDate: new Date(expiryDate),
        },
      });
    }

    const transaction = await tx.stockTransaction.create({
      data: {
        shopId,
        productId,
        batchId: batch.id,
        type: 'STOCK_IN',
        quantity,
        reason: 'Stock IN Purchase Intake',
        userId: createdById || null,
      },
    });

    return { batch, transaction };
  });

  emitShopEvent(shopId, 'inventory.stockIn', result);
  logAuditAction({
    userId: createdById || null,
    shopId,
    action: 'STOCK_IN',
    module: 'INVENTORY',
    recordId: result.batch.id,
    newValue: { batchNumber: result.batch.batchNumber, quantityAdded: quantity },
  });

  return result;
}

async function stockAdjustment(data) {
  const { shopId, batchId, adjustmentQuantity, type, reason, notes, createdById } = data;

  const batch = await prisma.inventoryBatch.findFirst({
    where: { id: batchId, shopId },
    include: { product: true },
  });

  if (!batch) {
    const error = new Error('Inventory batch not found in this shop');
    error.statusCode = 404;
    throw error;
  }

  // Calculate actual change: if type === 'DECREASE', change is negative
  let change = adjustmentQuantity;
  if (type === 'DECREASE' && change > 0) {
    change = -change;
  }

  const newQuantity = batch.quantity + change;

  // Negative Stock Guard
  if (newQuantity < 0) {
    const error = new Error(`Insufficient stock for adjustment. Current stock is ${batch.quantity}, attempt to remove ${Math.abs(change)}.`);
    error.statusCode = 400;
    throw error;
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedBatch = await tx.inventoryBatch.update({
      where: { id: batch.id },
      data: { quantity: newQuantity },
    });

    const transactionType = change < 0 ? (reason.toLowerCase().includes('damage') ? 'DAMAGE' : 'ADJUSTMENT') : 'ADJUSTMENT';

    const transaction = await tx.stockTransaction.create({
      data: {
        shopId,
        productId: batch.productId,
        batchId: batch.id,
        type: transactionType,
        quantity: change,
        reason: reason.trim(),
        userId: createdById || null,
      },
    });

    return { batch: updatedBatch, transaction, previousQuantity: batch.quantity, newQuantity };
  });

  emitShopEvent(shopId, 'inventory.stockAdjusted', result);
  logAuditAction({
    userId: createdById || null,
    shopId,
    action: 'STOCK_ADJUSTED',
    module: 'INVENTORY',
    recordId: batch.id,
    oldValue: { quantity: batch.quantity },
    newValue: { quantity: result.newQuantity, reason, change },
  });

  return result;
}

async function getStockTransactions(query = {}) {
  const { page, limit, skip } = getPagination(query);
  const where = {};

  if (query.shopId) {
    where.shopId = query.shopId;
  }

  if (query.type) {
    where.type = query.type;
  }

  if (query.productId) {
    where.productId = query.productId;
  }

  if (query.batchId) {
    where.batchId = query.batchId;
  }

  if (query.fromDate || query.toDate) {
    where.createdAt = {};
    if (query.fromDate) {
      where.createdAt.gte = new Date(query.fromDate);
    }
    if (query.toDate) {
      where.createdAt.lte = new Date(query.toDate);
    }
  }

  const [total, transactions] = await Promise.all([
    prisma.stockTransaction.count({ where }),
    prisma.stockTransaction.findMany({
      where,
      skip,
      take: limit,
      include: {
        product: { select: { id: true, name: true, shortName: true, code: true } },
        batch: { select: { id: true, batchNumber: true, purchasePrice: true } },
        user: { select: { id: true, fullName: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    transactions,
    pagination: getPaginationMeta(total, page, limit),
  };
}

// Retain legacy functions for backwards compatibility
async function getInventoryByVariantId(productVariantId, shopId) {
  const variant = await prisma.productVariant.findUnique({
    where: { id: productVariantId },
    include: {
      product: {
        include: { category: true },
      },
      batches: {
        where: shopId ? { shopId } : undefined,
        include: { supplier: true },
        orderBy: { expiryDate: 'asc' },
      },
    },
  });

  if (!variant) {
    const error = new Error('Product variant not found');
    error.statusCode = 404;
    throw error;
  }

  if (shopId && variant.product.shopId !== shopId) {
    const error = new Error('Product variant does not belong to this shop');
    error.statusCode = 404;
    throw error;
  }

  const totalStock = variant.batches.reduce((sum, b) => sum + b.quantity, 0);

  return {
    variantId: variant.id,
    variantName: variant.variantName,
    sku: variant.sku,
    purchasePrice: variant.purchasePrice,
    mrp: variant.mrp,
    sellingPrice: variant.sellingPrice,
    product: {
      id: variant.product.id,
      name: variant.product.name,
      shortName: variant.product.shortName || variant.product.name,
      code: variant.product.code,
      category: variant.product.category?.name,
    },
    totalStock,
    isLowStock: totalStock <= variant.product.minStock,
    batches: variant.batches,
  };
}

async function getBatches(query = {}) {
  return getInventorySummary(query);
}

async function addBatch(data) {
  const res = await stockIn(data);
  return res.batch;
}

async function getExpiringBatches(days = 30, shopId) {
  return getNearExpiryBatches(days, shopId);
}

async function adjustBatchStock(batchId, shopId, { quantity, reason }, createdById) {
  const res = await stockAdjustment({
    shopId,
    batchId,
    adjustmentQuantity: quantity,
    reason,
    createdById,
  });
  return res.batch;
}

module.exports = {
  getInventoryMetrics,
  getInventorySummary,
  getProductInventoryProfile,
  getProductBatches,
  getLowStockProducts,
  getNearExpiryBatches,
  getExpiredBatches,
  stockIn,
  stockAdjustment,
  getStockTransactions,
  getInventoryByVariantId,
  getBatches,
  addBatch,
  getExpiringBatches,
  adjustBatchStock,
};
