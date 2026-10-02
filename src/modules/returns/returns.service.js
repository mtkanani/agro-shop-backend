const { prisma } = require('../../config/database');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

async function generateSalesReturnNumber(shopId, tx) {
  const db = tx || prisma;
  const count = await db.salesReturn.count({ where: { shopId } });
  const nextNum = String(count + 1).padStart(5, '0');
  return `SR-${nextNum}`;
}

async function generatePurchaseReturnNumber(shopId, tx) {
  const db = tx || prisma;
  const count = await db.purchaseReturn.count({ where: { shopId } });
  const nextNum = String(count + 1).padStart(5, '0');
  return `PR-${nextNum}`;
}

// 1. Create Sales Return
async function createSalesReturn(shopId, userId, data) {
  const { invoiceId, items, reason, refundMethod, notes } = data;

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, shopId },
    include: {
      items: { include: { batch: true } },
      farmer: true,
      salesReturns: {
        where: { status: 'COMPLETED' },
        include: { items: true },
      },
    },
  });

  if (!invoice) {
    const err = new Error('Invoice not found in this shop');
    err.statusCode = 404;
    throw err;
  }

  if (invoice.paymentStatus === 'CANCELLED') {
    const err = new Error('Cannot create sales return against a cancelled invoice');
    err.statusCode = 400;
    throw err;
  }

  // Calculate previously returned quantities per invoiceItemId
  const returnedMap = {};
  invoice.salesReturns.forEach((sr) => {
    sr.items.forEach((sri) => {
      returnedMap[sri.invoiceItemId] = (returnedMap[sri.invoiceItemId] || 0) + sri.quantity;
    });
  });

  // Validate returnable quantities & prepare return items
  let totalReturnAmount = 0;
  const preparedItems = [];

  for (const item of items) {
    const invItem = invoice.items.find((i) => i.id === item.invoiceItemId);
    if (!invItem) {
      const err = new Error(`Invoice item ${item.invoiceItemId} not found in this invoice`);
      err.statusCode = 400;
      throw err;
    }

    const alreadyReturned = returnedMap[item.invoiceItemId] || 0;
    const availableToReturn = invItem.quantity - alreadyReturned;

    if (item.quantity > availableToReturn) {
      const err = new Error(
        `Cannot return more than remaining returnable quantity for item. Available: ${availableToReturn}, Attempted: ${item.quantity}`
      );
      err.statusCode = 400;
      throw err;
    }

    // Historical unit price calculation
    const itemTotal = item.quantity * invItem.unitPrice;
    totalReturnAmount += itemTotal;

    preparedItems.push({
      invoiceItemId: invItem.id,
      productId: invItem.productId,
      batchId: invItem.batchId,
      quantity: item.quantity,
      unitPrice: invItem.unitPrice,
      taxAmount: invItem.taxRate > 0 ? (itemTotal * invItem.taxRate) / 100 : 0,
      totalPrice: itemTotal,
      condition: item.condition || 'GOOD',
    });
  }

  return await prisma.$transaction(async (tx) => {
    const returnNumber = await generateSalesReturnNumber(shopId, tx);

    const salesReturn = await tx.salesReturn.create({
      data: {
        returnNumber,
        shopId,
        invoiceId: invoice.id,
        farmerId: invoice.farmerId,
        userId,
        returnAmount: totalReturnAmount,
        reason,
        refundMethod,
        status: 'COMPLETED',
        notes,
        items: {
          create: preparedItems,
        },
      },
      include: {
        items: { include: { product: { select: { name: true, shortName: true } } } },
        farmer: { select: { name: true, phone: true } },
      },
    });

    // Process Stock IN for GOOD condition items
    for (const prepared of preparedItems) {
      if (prepared.condition === 'GOOD' && prepared.batchId) {
        await tx.inventoryBatch.update({
          where: { id: prepared.batchId },
          data: { quantity: { increment: prepared.quantity } },
        });

        await tx.stockTransaction.create({
          data: {
            shopId,
            productId: prepared.productId,
            batchId: prepared.batchId,
            userId,
            type: 'RETURN',
            quantity: prepared.quantity,
            reason: `Sales Return ${returnNumber} (${prepared.condition})`,
          },
        });
      } else {
        await tx.stockTransaction.create({
          data: {
            shopId,
            productId: prepared.productId,
            batchId: prepared.batchId,
            userId,
            type: 'RETURN_DAMAGED',
            quantity: prepared.quantity,
            reason: `Sales Return ${returnNumber} (${prepared.condition})`,
          },
        });
      }
    }

    // Financial Reversal & Khata Ledger Adjustment
    if (invoice.farmerId) {
      const invoiceDue = Math.max(0, invoice.totalAmount - invoice.paidAmount);
      let dueReduction = 0;

      if (refundMethod === 'ADJUST_DUE' || invoiceDue > 0) {
        dueReduction = Math.min(invoiceDue, totalReturnAmount);
      }

      if (dueReduction > 0) {
        await tx.farmer.update({
          where: { id: invoice.farmerId },
          data: { khataBalance: { decrement: dueReduction } },
        });

        const updatedFarmer = await tx.farmer.findUnique({
          where: { id: invoice.farmerId },
          select: { khataBalance: true },
        });

        await tx.khataTransaction.create({
          data: {
            shopId,
            farmerId: invoice.farmerId,
            type: 'CREDIT',
            amount: dueReduction,
            balanceAfter: updatedFarmer ? updatedFarmer.khataBalance : 0,
            referenceType: 'SALES_RETURN',
            referenceId: salesReturn.id,
            description: `Sales Return ${returnNumber} due adjustment`,
          },
        });
      }
    }

    // Update Invoice Payment Status
    const allCompletedReturns = await tx.salesReturn.findMany({
      where: { invoiceId: invoice.id, status: 'COMPLETED' },
      include: { items: true },
    });

    let totalReturnedAllItems = 0;
    allCompletedReturns.forEach((sr) => {
      sr.items.forEach((sri) => {
        totalReturnedAllItems += sri.quantity;
      });
    });

    const totalInvoiceItemsQty = invoice.items.reduce((sum, i) => sum + i.quantity, 0);
    const newStatus = totalReturnedAllItems >= totalInvoiceItemsQty ? 'FULLY_RETURNED' : 'PARTIALLY_RETURNED';

    await tx.invoice.update({
      where: { id: invoice.id },
      data: { paymentStatus: newStatus },
    });

    // Write AuditLog
    await tx.auditLog.create({
      data: {
        shopId,
        userId,
        module: 'RETURNS',
        action: 'SALES_RETURN_CREATED',
        recordId: salesReturn.id,
        newValue: JSON.stringify({ returnNumber, totalReturnAmount, reason }),
      },
    });

    return salesReturn;
  });

  createNotificationFromEvent(shopId, {
    type: 'SALES_RETURN_CREATED',
    title: 'Sales Return Created',
    message: `₹${result.returnAmount} sales return created (${result.returnNumber}).`,
    entityType: 'SALES_RETURN',
    entityId: result.id,
  });

  return result;
}

// 2. Get Sales Returns List
async function getSalesReturns(shopId, query = {}) {
  const where = { shopId };
  if (query.status) where.status = query.status;

  if (query.search) {
    where.OR = [
      { returnNumber: { contains: query.search, mode: 'insensitive' } },
      { invoice: { invoiceNumber: { contains: query.search, mode: 'insensitive' } } },
      { farmer: { name: { contains: query.search, mode: 'insensitive' } } },
    ];
  }

  const reportService = require('../reports/reports.service');
  const dateRange = reportService.getDateRange(query);
  if (dateRange) where.createdAt = dateRange;

  const { page, limit, skip } = getPagination(query);

  const [total, returns] = await Promise.all([
    prisma.salesReturn.count({ where }),
    prisma.salesReturn.findMany({
      where,
      skip,
      take: limit,
      include: {
        invoice: { select: { id: true, invoiceNumber: true } },
        farmer: { select: { id: true, name: true, phone: true } },
        items: { include: { product: { select: { id: true, name: true, shortName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    returns,
    pagination: getPaginationMeta(total, page, limit),
  };
}

// 3. Get Sales Return By ID
async function getSalesReturnById(shopId, returnId) {
  const salesReturn = await prisma.salesReturn.findFirst({
    where: { id: returnId, shopId },
    include: {
      invoice: { select: { id: true, invoiceNumber: true, totalAmount: true, createdAt: true } },
      farmer: { select: { id: true, name: true, phone: true, village: true } },
      user: { select: { id: true, fullName: true } },
      items: {
        include: {
          product: { select: { id: true, name: true, shortName: true, code: true } },
          batch: { select: { batchNumber: true } },
        },
      },
    },
  });

  if (!salesReturn) {
    const err = new Error('Sales return record not found in this shop');
    err.statusCode = 404;
    throw err;
  }

  return salesReturn;
}

// 4. Reverse Sales Return
async function reverseSalesReturn(shopId, userId, returnId, reason) {
  const salesReturn = await prisma.salesReturn.findFirst({
    where: { id: returnId, shopId },
    include: { items: true, farmer: true },
  });

  if (!salesReturn) {
    const err = new Error('Sales return record not found');
    err.statusCode = 404;
    throw err;
  }

  if (salesReturn.status === 'REVERSED') {
    const err = new Error('Sales return has already been reversed');
    err.statusCode = 400;
    throw err;
  }

  return await prisma.$transaction(async (tx) => {
    // Reverse Stock IN
    for (const item of salesReturn.items) {
      if (item.condition === 'GOOD' && item.batchId) {
        await tx.inventoryBatch.update({
          where: { id: item.batchId },
          data: { quantity: { decrement: item.quantity } },
        });

        await tx.stockTransaction.create({
          data: {
            shopId,
            productId: item.productId,
            batchId: item.batchId,
            userId,
            type: 'OUT',
            quantity: -item.quantity,
            reason: `Reversal of Sales Return ${salesReturn.returnNumber}: ${reason}`,
          },
        });
      }
    }

    // Restore Farmer Balance if due was adjusted
    if (salesReturn.farmerId) {
      await tx.farmer.update({
        where: { id: salesReturn.farmerId },
        data: { khataBalance: { increment: salesReturn.returnAmount } },
      });

      const updatedFarmer = await tx.farmer.findUnique({
        where: { id: salesReturn.farmerId },
        select: { khataBalance: true },
      });

      await tx.khataTransaction.create({
        data: {
          shopId,
          farmerId: salesReturn.farmerId,
          type: 'DEBIT',
          amount: salesReturn.returnAmount,
          balanceAfter: updatedFarmer ? updatedFarmer.khataBalance : 0,
          referenceType: 'SALES_RETURN_REVERSAL',
          referenceId: salesReturn.id,
          description: `Reversal of Sales Return ${salesReturn.returnNumber}`,
        },
      });
    }

    const updated = await tx.salesReturn.update({
      where: { id: returnId },
      data: { status: 'REVERSED', notes: `${salesReturn.notes || ''} [REVERSED: ${reason}]` },
    });

    await tx.auditLog.create({
      data: {
        shopId,
        userId,
        module: 'RETURNS',
        action: 'SALES_RETURN_REVERSED',
        recordId: returnId,
        newValue: JSON.stringify({ reason }),
      },
    });

    return updated;
  });
}

// 5. Create Purchase Return
async function createPurchaseReturn(shopId, userId, data) {
  const { restockId, supplierId, items, reason, settlementMethod, notes } = data;

  const preparedItems = [];
  let totalReturnAmount = 0;
  let resolvedSupplierId = supplierId || null;

  for (const item of items) {
    const batch = await prisma.inventoryBatch.findFirst({
      where: { id: item.batchId, shopId },
      include: { product: true, supplier: true },
    });

    if (!batch) {
      const err = new Error(`Inventory batch ${item.batchId} not found in this shop`);
      err.statusCode = 404;
      throw err;
    }

    if (item.quantity > batch.quantity) {
      const err = new Error(
        `Cannot return more stock than remaining batch quantity. Batch quantity: ${batch.quantity}, Attempted: ${item.quantity}`
      );
      err.statusCode = 400;
      throw err;
    }

    if (!resolvedSupplierId && batch.supplierId) {
      resolvedSupplierId = batch.supplierId;
    }

    const itemTotal = item.quantity * batch.purchasePrice;
    totalReturnAmount += itemTotal;

    preparedItems.push({
      batchId: batch.id,
      productId: batch.productId,
      quantity: item.quantity,
      unitCost: batch.purchasePrice,
      totalCost: itemTotal,
      condition: item.condition || 'DAMAGED',
    });
  }

  return await prisma.$transaction(async (tx) => {
    const returnNumber = await generatePurchaseReturnNumber(shopId, tx);

    const purchaseReturn = await tx.purchaseReturn.create({
      data: {
        returnNumber,
        shopId,
        supplierId: resolvedSupplierId,
        userId,
        returnAmount: totalReturnAmount,
        reason,
        settlementMethod,
        status: 'COMPLETED',
        notes,
        items: {
          create: preparedItems,
        },
      },
      include: {
        items: { include: { product: { select: { name: true, shortName: true } } } },
        supplier: { select: { name: true, companyName: true } },
      },
    });

    // Execute Stock OUT from Inventory Batch
    for (const prepared of preparedItems) {
      await tx.inventoryBatch.update({
        where: { id: prepared.batchId },
        data: { quantity: { decrement: prepared.quantity } },
      });

      await tx.stockTransaction.create({
        data: {
          shopId,
          productId: prepared.productId,
          batchId: prepared.batchId,
          userId,
          type: 'PURCHASE_RETURN',
          quantity: -prepared.quantity,
          reason: `Purchase Return ${returnNumber}`,
        },
      });
    }

    // Supplier Khata & Financial Adjustment
    if (resolvedSupplierId) {
      await tx.supplier.update({
        where: { id: resolvedSupplierId },
        data: { khataBalance: { decrement: totalReturnAmount } },
      });

      const updatedSupplier = await tx.supplier.findUnique({
        where: { id: resolvedSupplierId },
        select: { khataBalance: true },
      });

      await tx.supplierTransaction.create({
        data: {
          shopId,
          supplierId: resolvedSupplierId,
          type: 'RETURN',
          amount: totalReturnAmount,
          balanceAfter: updatedSupplier ? updatedSupplier.khataBalance : 0,
          referenceId: purchaseReturn.id,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        shopId,
        userId,
        module: 'RETURNS',
        action: 'PURCHASE_RETURN_CREATED',
        recordId: purchaseReturn.id,
        newValue: JSON.stringify({ returnNumber, totalReturnAmount, reason }),
      },
    });

    return purchaseReturn;
  });

  createNotificationFromEvent(shopId, {
    type: 'PURCHASE_RETURN_CREATED',
    title: 'Purchase Return Created',
    message: `₹${result.returnAmount} purchase return created (${result.returnNumber}).`,
    entityType: 'PURCHASE_RETURN',
    entityId: result.id,
  });

  return result;
}

// 6. Get Purchase Returns List
async function getPurchaseReturns(shopId, query = {}) {
  const where = { shopId };
  if (query.status) where.status = query.status;

  if (query.search) {
    where.OR = [
      { returnNumber: { contains: query.search, mode: 'insensitive' } },
      { supplier: { companyName: { contains: query.search, mode: 'insensitive' } } },
      { supplier: { name: { contains: query.search, mode: 'insensitive' } } },
    ];
  }

  const reportService = require('../reports/reports.service');
  const dateRange = reportService.getDateRange(query);
  if (dateRange) where.createdAt = dateRange;

  const { page, limit, skip } = getPagination(query);

  const [total, returns] = await Promise.all([
    prisma.purchaseReturn.count({ where }),
    prisma.purchaseReturn.findMany({
      where,
      skip,
      take: limit,
      include: {
        supplier: { select: { id: true, name: true, companyName: true, phone: true } },
        items: { include: { product: { select: { id: true, name: true, shortName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    returns,
    pagination: getPaginationMeta(total, page, limit),
  };
}

// 7. Get Purchase Return By ID
async function getPurchaseReturnById(shopId, returnId) {
  const purchaseReturn = await prisma.purchaseReturn.findFirst({
    where: { id: returnId, shopId },
    include: {
      supplier: { select: { id: true, name: true, companyName: true, phone: true } },
      user: { select: { id: true, fullName: true } },
      items: {
        include: {
          product: { select: { id: true, name: true, shortName: true, code: true } },
          batch: { select: { batchNumber: true } },
        },
      },
    },
  });

  if (!purchaseReturn) {
    const err = new Error('Purchase return record not found in this shop');
    err.statusCode = 404;
    throw err;
  }

  return purchaseReturn;
}

// 8. Reverse Purchase Return
async function reversePurchaseReturn(shopId, userId, returnId, reason) {
  const purchaseReturn = await prisma.purchaseReturn.findFirst({
    where: { id: returnId, shopId },
    include: { items: true, supplier: true },
  });

  if (!purchaseReturn) {
    const err = new Error('Purchase return record not found');
    err.statusCode = 404;
    throw err;
  }

  if (purchaseReturn.status === 'REVERSED') {
    const err = new Error('Purchase return has already been reversed');
    err.statusCode = 400;
    throw err;
  }

  return await prisma.$transaction(async (tx) => {
    // Reverse Stock OUT (Increment stock back)
    for (const item of purchaseReturn.items) {
      if (item.batchId) {
        await tx.inventoryBatch.update({
          where: { id: item.batchId },
          data: { quantity: { increment: item.quantity } },
        });

        await tx.stockTransaction.create({
          data: {
            shopId,
            productId: item.productId,
            batchId: item.batchId,
            userId,
            type: 'RESTOCK',
            quantity: item.quantity,
            reason: `Reversal of Purchase Return ${purchaseReturn.returnNumber}: ${reason}`,
          },
        });
      }
    }

    // Restore Supplier Balance
    if (purchaseReturn.supplierId) {
      await tx.supplier.update({
        where: { id: purchaseReturn.supplierId },
        data: { khataBalance: { increment: purchaseReturn.returnAmount } },
      });
    }

    const updated = await tx.purchaseReturn.update({
      where: { id: returnId },
      data: { status: 'REVERSED', notes: `${purchaseReturn.notes || ''} [REVERSED: ${reason}]` },
    });

    await tx.auditLog.create({
      data: {
        shopId,
        userId,
        module: 'RETURNS',
        action: 'PURCHASE_RETURN_REVERSED',
        recordId: returnId,
        newValue: JSON.stringify({ reason }),
      },
    });

    return updated;
  });
}

// 9. Get Returns Summary
async function getReturnsSummary(shopId, query = {}) {
  const reportService = require('../reports/reports.service');
  const dateRange = reportService.getDateRange(query);

  const salesWhere = { shopId, status: 'COMPLETED' };
  const purchaseWhere = { shopId, status: 'COMPLETED' };

  if (dateRange) {
    salesWhere.createdAt = dateRange;
    purchaseWhere.createdAt = dateRange;
  }

  const [salesAgg, purchaseAgg, salesCount, purchaseCount] = await Promise.all([
    prisma.salesReturn.aggregate({
      where: salesWhere,
      _sum: { returnAmount: true },
    }),
    prisma.purchaseReturn.aggregate({
      where: purchaseWhere,
      _sum: { returnAmount: true },
    }),
    prisma.salesReturn.count({ where: salesWhere }),
    prisma.purchaseReturn.count({ where: purchaseWhere }),
  ]);

  return {
    salesReturns: {
      count: salesCount,
      amount: salesAgg._sum.returnAmount || 0,
    },
    purchaseReturns: {
      count: purchaseCount,
      amount: purchaseAgg._sum.returnAmount || 0,
    },
  };
}

module.exports = {
  createSalesReturn,
  getSalesReturns,
  getSalesReturnById,
  reverseSalesReturn,
  createPurchaseReturn,
  getPurchaseReturns,
  getPurchaseReturnById,
  reversePurchaseReturn,
  getReturnsSummary,
};
