const { prisma } = require('../../config/database');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');
const { emitShopEvent } = require('../../config/socket');
const { logAuditAction } = require('../../utils/auditLogger');

async function createRestock(data) {
  const { shopId, supplierId, restockDate, notes, items, userId } = data;

  if (!shopId) {
    const error = new Error('Shop ID is required');
    error.statusCode = 400;
    throw error;
  }

  // 1. Verify Supplier belongs to current shop and is active
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, shopId, isActive: true },
  });

  if (!supplier) {
    const error = new Error('Supplier not found or inactive in this shop');
    error.statusCode = 403;
    throw error;
  }

  // 2. Verify all Products belong to current shop and are active
  const productIds = items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      shopId,
      isActive: true,
    },
  });

  if (products.length !== new Set(productIds).size) {
    const error = new Error('One or more products were not found or belong to another shop');
    error.statusCode = 403;
    throw error;
  }

  const productMap = new Map(products.map((p) => [p.id, p]));

  // 3. Auto-generate Restock Number
  const restockCount = await prisma.inventoryBatch.count({ where: { shopId } });
  const restockNumber = `REST-${String(restockCount + 1).padStart(4, '0')}`;

  // 4. Calculate total restock amount on backend
  const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.purchasePrice, 0);

  // 5. Atomic Stock Intake Transaction
  const result = await prisma.$transaction(async (tx) => {
    const createdBatches = [];
    const createdTransactions = [];
    const productNames = [];

    for (const item of items) {
      const targetProduct = productMap.get(item.productId);
      productNames.push(targetProduct.shortName || targetProduct.name);

      // Find variant or use default
      let targetVariantId = item.variantId;
      if (!targetVariantId) {
        const firstVariant = await tx.productVariant.findFirst({
          where: { productId: item.productId },
        });
        if (firstVariant) {
          targetVariantId = firstVariant.id;
        }
      }

      const generatedBatchNum = item.batchNumber
        ? item.batchNumber.trim()
        : `${restockNumber}-${targetProduct.code}-${Date.now().toString().slice(-4)}`;

      // Check existing batch or create new
      let batch = await tx.inventoryBatch.findFirst({
        where: {
          shopId,
          productId: item.productId,
          batchNumber: generatedBatchNum,
        },
      });

      if (batch) {
        batch = await tx.inventoryBatch.update({
          where: { id: batch.id },
          data: {
            quantity: { increment: item.quantity },
            purchasePrice: item.purchasePrice || batch.purchasePrice,
            sellingPrice: item.sellingPrice || batch.sellingPrice,
            mrp: item.mrp || batch.mrp,
            supplierId: supplier.id,
          },
        });
      } else {
        batch = await tx.inventoryBatch.create({
          data: {
            shopId,
            productId: item.productId,
            variantId: targetVariantId,
            supplierId: supplier.id,
            batchNumber: generatedBatchNum,
            quantity: item.quantity,
            purchasePrice: item.purchasePrice,
            sellingPrice: item.sellingPrice || 0,
            mrp: item.mrp || 0,
            mfgDate: item.mfgDate ? new Date(item.mfgDate) : null,
            expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
          },
        });
      }

      createdBatches.push(batch);

      // Log StockTransaction
      const stockTx = await tx.stockTransaction.create({
        data: {
          shopId,
          productId: item.productId,
          batchId: batch.id,
          type: 'RESTOCK',
          quantity: item.quantity,
          reason: `Restock ${restockNumber} from ${supplier.name}`,
          userId: userId || null,
        },
      });
      createdTransactions.push(stockTx);
    }

    // Update Supplier suppliedProducts string summary if needed
    const existingSupplied = supplier.suppliedProducts ? supplier.suppliedProducts.split(',').map((s) => s.trim()) : [];
    const updatedSupplied = Array.from(new Set([...existingSupplied, ...productNames])).join(', ');

    await tx.supplier.update({
      where: { id: supplier.id },
      data: { suppliedProducts: updatedSupplied },
    });

    return {
      restockNumber,
      supplier: {
        id: supplier.id,
        name: supplier.name,
        phone: supplier.phone,
      },
      restockDate: restockDate || new Date(),
      totalAmount,
      itemsCount: items.length,
      totalQuantity: items.reduce((s, i) => s + i.quantity, 0),
      batches: createdBatches,
    };
  });

  emitShopEvent(shopId, 'restock.created', result);
  logAuditAction({
    userId: userId || null,
    shopId,
    action: 'RESTOCK_CREATE',
    module: 'RESTOCK',
    recordId: result.restockNumber,
    newValue: { totalAmount: result.totalAmount, itemsCount: result.itemsCount },
  });

  const notificationService = require('../notifications/notification.service');
  notificationService.createNotificationFromEvent(shopId, {
    type: 'RESTOCK_COMPLETED',
    title: 'Restock Intake Completed',
    message: `${result.supplier.name} supplied ${result.totalQuantity} units (${result.itemsCount} items).`,
    entityType: 'SUPPLIER',
    entityId: result.supplier.id,
  });

  notificationService.evaluateStockAlerts(shopId);

  return result;
}

async function getAllRestocks(query = {}) {
  const { page, limit, skip } = getPagination(query);
  const where = {};

  if (query.shopId) {
    where.shopId = query.shopId;
  }

  if (query.supplierId) {
    where.supplierId = query.supplierId;
  }

  const [total, batches] = await Promise.all([
    prisma.inventoryBatch.count({ where }),
    prisma.inventoryBatch.findMany({
      where,
      skip,
      take: limit,
      include: {
        supplier: { select: { id: true, name: true, phone: true } },
        product: { select: { id: true, name: true, shortName: true, code: true } },
        variant: { select: { id: true, variantName: true, sku: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    restocks: batches,
    pagination: getPaginationMeta(total, page, limit),
  };
}

async function getRestockById(id, shopId = null) {
  const where = { id };
  if (shopId) {
    where.shopId = shopId;
  }

  const batch = await prisma.inventoryBatch.findFirst({
    where,
    include: {
      supplier: true,
      product: { select: { id: true, name: true, shortName: true, code: true } },
      variant: { select: { id: true, variantName: true, sku: true } },
      stockTransactions: true,
    },
  });

  if (!batch) {
    const error = new Error('Restock batch record not found in this shop');
    error.statusCode = 404;
    throw error;
  }

  return batch;
}

module.exports = {
  createRestock,
  getAllRestocks,
  getRestockById,
};
