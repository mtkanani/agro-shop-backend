const { prisma } = require('../../config/database');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');
const { emitShopEvent } = require('../../config/socket');
const { logAuditAction } = require('../../utils/auditLogger');

async function generateInvoiceNumber(shopId) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const monthPrefix = `INV-${year}${month}`;

  // Find latest invoice matching current month prefix in this shop in O(log N)
  const latestInvoice = await prisma.invoice.findFirst({
    where: {
      shopId,
      invoiceNumber: {
        startsWith: monthPrefix,
      },
    },
    orderBy: { invoiceNumber: 'desc' },
    select: { invoiceNumber: true },
  });

  let nextSeq = '0001';
  if (latestInvoice && latestInvoice.invoiceNumber) {
    const lastSeqStr = latestInvoice.invoiceNumber.slice(monthPrefix.length);
    const lastSeq = parseInt(lastSeqStr, 10);
    if (!isNaN(lastSeq)) {
      nextSeq = String(lastSeq + 1).padStart(4, '0');
    }
  }
  return `${monthPrefix}${nextSeq}`;
}

async function createInvoice(userId, data) {
  const shopId = data.shopId;
  if (!shopId) {
    const err = new Error('Shop ID is required for billing');
    err.statusCode = 400;
    throw err;
  }

  // 1. Customer Verification (Farmer vs Walk-in)
  let farmer = null;
  const isWalkIn = data.customerType === 'WALK_IN_CUSTOMER' || (!data.farmerId && !data.customerType);

  if (data.farmerId) {
    farmer = await prisma.farmer.findFirst({
      where: { id: data.farmerId, shopId },
    });

    if (!farmer) {
      const err = new Error('Farmer profile not found in this shop');
      err.statusCode = 404;
      throw err;
    }
  }

  // 2. Validate Items, Stock Availability & Selling Prices
  // Batch resolve variantIds to productIds in O(1) round trips
  const variantIds = data.items
    .map((i) => i.productVariantId || i.variantId)
    .filter(Boolean);

  let variantMap = new Map();
  if (variantIds.length > 0) {
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      select: { id: true, productId: true, sellingPrice: true, mrp: true },
    });
    variantMap = new Map(variants.map((v) => [v.id, v]));
  }

  // Collect all unique product IDs
  const productIds = [
    ...new Set(
      data.items
        .map((item) => {
          const targetVariantId = item.productVariantId || item.variantId;
          const mappedVariant = targetVariantId ? variantMap.get(targetVariantId) : null;
          return item.productId || (mappedVariant ? mappedVariant.productId : null);
        })
        .filter(Boolean)
    ),
  ];

  // Specific batch IDs if requested
  const specificBatchIds = data.items.map((i) => i.batchId).filter(Boolean);

  // Batch query all products with variants & batches in 1 single DB query!
  const [productsList, specificBatches] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: productIds }, shopId, isActive: true },
      include: {
        variants: true,
        batches: {
          where: { quantity: { gt: 0 } },
          orderBy: { expiryDate: 'asc' }, // FEFO Strategy
        },
      },
    }),
    specificBatchIds.length > 0
      ? prisma.inventoryBatch.findMany({
          where: { id: { in: specificBatchIds }, shopId },
        })
      : Promise.resolve([]),
  ]);

  const productMap = new Map(productsList.map((p) => [p.id, p]));
  const specificBatchMap = new Map(specificBatches.map((b) => [b.id, b]));

  const processedItems = [];
  let subTotal = 0;

  for (const item of data.items) {
    let targetProductId = item.productId;
    let targetVariantId = item.productVariantId || item.variantId;

    if (!targetProductId && targetVariantId && variantMap.has(targetVariantId)) {
      targetProductId = variantMap.get(targetVariantId).productId;
    }

    const product = productMap.get(targetProductId);

    if (!product) {
      const err = new Error('Product not found or inactive in this shop');
      err.statusCode = 404;
      throw err;
    }

    // Selling price resolution: Item override > Variant sellingPrice > Batch sellingPrice > Product mrp
    let unitPrice = item.unitPrice;
    if (unitPrice === undefined || unitPrice === null) {
      if (targetVariantId) {
        const variant = product.variants.find((v) => v.id === targetVariantId);
        if (variant && (variant.sellingPrice || variant.mrp)) {
          unitPrice = variant.sellingPrice || variant.mrp;
        }
      }
      if ((unitPrice === undefined || unitPrice === null) && product.batches.length > 0) {
        unitPrice = product.batches[0].sellingPrice || product.batches[0].mrp;
      }
      if (unitPrice === undefined || unitPrice === null) {
        unitPrice = 0;
      }
    }

    // Batch allocation & Stock Check
    let targetBatch = null;
    if (item.batchId) {
      targetBatch = specificBatchMap.get(item.batchId) || product.batches.find((b) => b.id === item.batchId);
    } else if (product.batches.length > 0) {
      targetBatch = product.batches[0]; // Active batch expiring soonest (FEFO)
    }

    if (!targetBatch || targetBatch.quantity < item.quantity) {
      const available = targetBatch ? targetBatch.quantity : 0;
      const err = new Error(`Insufficient stock for product '${product.shortName || product.name}' (Batch: ${targetBatch ? targetBatch.batchNumber : 'N/A'}). Available: ${available}, Requested: ${item.quantity}`);
      err.statusCode = 400;
      throw err;
    }

    const itemDiscount = item.discount || 0;
    const itemSubtotal = Math.max(0, item.quantity * unitPrice - itemDiscount);

    subTotal += itemSubtotal;

    processedItems.push({
      productId: product.id,
      productName: product.name,
      shortName: product.shortName || product.name,
      batchId: targetBatch ? targetBatch.id : null,
      batchNumber: targetBatch ? targetBatch.batchNumber : null,
      quantity: item.quantity,
      unitPrice,
      taxRate: 0, // No tax
      taxAmount: 0, // No tax
      discount: itemDiscount,
      totalPrice: itemSubtotal,
    });
  }

  // 3. Overall Bill Discount & Grand Total
  const billDiscount = data.billDiscount !== undefined ? data.billDiscount : (data.discount || 0);
  const grandTotal = Math.max(0, subTotal - billDiscount);

  // 4. Payment Resolution
  const rawPaymentMethod = (data.paymentMethod || data.paymentType || 'CASH').toUpperCase();
  const amountReceived = data.amountReceived !== undefined ? data.amountReceived : (data.paidAmount !== undefined ? data.paidAmount : grandTotal);

  let paidAmount = 0;
  let changeAmount = 0;

  if (['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'PAY_NOW'].includes(rawPaymentMethod)) {
    paidAmount = Math.min(amountReceived, grandTotal);
    changeAmount = Math.max(0, amountReceived - grandTotal);
  } else if (rawPaymentMethod === 'CREDIT' || rawPaymentMethod === 'KHATA' || rawPaymentMethod === 'PAY_LATER') {
    paidAmount = data.paidAmount !== undefined ? Math.min(data.paidAmount, grandTotal) : 0;
  } else if (rawPaymentMethod === 'PARTIAL') {
    paidAmount = data.paidAmount !== undefined ? Math.min(data.paidAmount, grandTotal) : 0;
  } else {
    paidAmount = Math.min(amountReceived, grandTotal);
  }

  const remainingDue = Math.max(0, grandTotal - paidAmount);

  // 4b. Credit Limit Enforcement Guard
  if (remainingDue > 0 && farmer && farmer.creditLimit > 0) {
    const availableCredit = Math.max(0, farmer.creditLimit - farmer.khataBalance);
    if (farmer.khataBalance + remainingDue > farmer.creditLimit) {
      const err = new Error(`Farmer credit limit exceeded. Credit Limit: ₹${farmer.creditLimit}, Current Due: ₹${farmer.khataBalance}, Available Credit: ₹${availableCredit}, Requested Credit: ₹${remainingDue}`);
      err.statusCode = 400;
      throw err;
    }
  }

  let paymentStatus = 'PAID';
  if (remainingDue > 0 && paidAmount > 0) {
    paymentStatus = 'PARTIAL';
  } else if (remainingDue > 0 && paidAmount === 0) {
    paymentStatus = 'UNPAID';
  }

  // 5. Generate Custom Invoice Number: INV-YYYYMMDDDD
  const invoiceNumber = await generateInvoiceNumber(shopId);

  // 6. Execute Atomic Database Transaction
  const result = await prisma.$transaction(async (tx) => {
    // A. Deduct stock quantities from InventoryBatch & record STOCK_OUT
    for (const pItem of processedItems) {
      if (pItem.batchId) {
        await tx.inventoryBatch.update({
          where: { id: pItem.batchId },
          data: {
            quantity: { decrement: pItem.quantity },
          },
        });

        await tx.stockTransaction.create({
          data: {
            shopId,
            productId: pItem.productId,
            batchId: pItem.batchId,
            type: 'SALE',
            quantity: -pItem.quantity,
            reason: `Sales Invoice #${invoiceNumber}`,
            userId,
          },
        });
      }
    }

    // B. Create Invoice record
    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber,
        shopId,
        farmerId: farmer ? farmer.id : null,
        userId,
        subTotal,
        taxAmount: 0, // No tax
        discount: billDiscount,
        totalAmount: grandTotal,
        paidAmount,
        paymentStatus,
        paymentMethod: rawPaymentMethod,
        notes: data.notes || null,
        items: {
          create: processedItems.map((pItem) => ({
            productId: pItem.productId,
            batchId: pItem.batchId,
            quantity: pItem.quantity,
            unitPrice: pItem.unitPrice,
            taxRate: 0,
            taxAmount: 0,
            totalPrice: pItem.totalPrice,
          })),
        },
      },
      include: {
        items: { include: { product: true, batch: true } },
        farmer: true,
        shop: true,
        user: { select: { id: true, fullName: true, role: true } },
      },
    });

    // C. Create Payment Record if paidAmount > 0
    let paymentRecord = null;
    if (paidAmount > 0) {
      const pCount = await tx.payment.count({ where: { shopId } });
      const pYear = new Date().getFullYear();
      paymentRecord = await tx.payment.create({
        data: {
          shopId,
          paymentNumber: `PAY-${pYear}-${String(pCount + 1).padStart(5, '0')}`,
          farmerId: farmer ? farmer.id : null,
          invoiceId: invoice.id,
          amount: paidAmount,
          method: ['CREDIT', 'KHATA', 'PAY_LATER'].includes(rawPaymentMethod) ? 'CASH' : rawPaymentMethod,
          txnRef: data.paymentRef || null,
          notes: `Payment for Invoice #${invoiceNumber}`,
        },
      });
    }

    // D. Update Farmer Khata & record DEBIT Transaction if credit/due balance remains
    let updatedKhataBalance = farmer ? farmer.khataBalance : 0;
    if (remainingDue > 0 && farmer) {
      const currentFarmer = await tx.farmer.findUnique({ where: { id: farmer.id } });
      if (currentFarmer) {
        updatedKhataBalance = currentFarmer.khataBalance + remainingDue;
        await tx.farmer.update({
          where: { id: farmer.id },
          data: { khataBalance: updatedKhataBalance },
        });

        await tx.khataTransaction.create({
          data: {
            shopId,
            farmerId: farmer.id,
            type: 'DEBIT',
            amount: remainingDue,
            balanceAfter: updatedKhataBalance,
            referenceType: 'INVOICE',
            referenceId: invoice.id,
            description: `Credit sale against Invoice #${invoiceNumber}`,
          },
        });
      }
    }

    return {
      invoice,
      payment: paymentRecord,
      amountReceived,
      changeAmount,
      outstanding: {
        invoiceDueAmount: remainingDue,
        totalFarmerKhataBalance: updatedKhataBalance,
      },
    };
  });

  emitShopEvent(shopId, 'bill.created', result.invoice);
  emitShopEvent(shopId, 'stock.updated', { shopId });
  if (remainingDue > 0 && farmer) {
    emitShopEvent(shopId, 'khata.updated', { farmerId: farmer.id });
  }

  logAuditAction({
    userId,
    shopId,
    action: 'BILL_CREATE',
    module: 'BILLING',
    recordId: result.invoice.id,
    newValue: { invoiceNumber: result.invoice.invoiceNumber, totalAmount: grandTotal, paidAmount },
  });

  const touchedProductIds = [...new Set(processedItems.map((p) => p.productId))];
  const notificationService = require('../notifications/notification.service');
  notificationService.evaluateStockAlerts(shopId, touchedProductIds);

  return result;
}

async function getAllInvoices(query = {}) {
  const { page, limit, skip } = getPagination(query);
  const where = {};

  if (query.shopId) {
    where.shopId = query.shopId;
  }

  if (query.farmerId) {
    where.farmerId = query.farmerId;
  }

  if (query.paymentStatus) {
    where.paymentStatus = query.paymentStatus;
  }

  if (query.paymentMethod) {
    where.paymentMethod = query.paymentMethod;
  }

  if (query.search) {
    const search = query.search.trim();
    where.OR = [
      { invoiceNumber: { contains: search, mode: 'insensitive' } },
      { farmer: { name: { contains: search, mode: 'insensitive' } } },
      { farmer: { phone: { contains: search, mode: 'insensitive' } } },
    ];
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

  const [total, invoices] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      skip,
      take: limit,
      include: {
        farmer: { select: { id: true, name: true, phone: true } },
        user: { select: { id: true, fullName: true } },
        items: { include: { product: { select: { id: true, name: true, shortName: true, code: true } } } },
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    invoices,
    pagination: getPaginationMeta(total, page, limit),
  };
}

async function getInvoiceById(id, shopId) {
  const where = { id };
  if (shopId) {
    where.shopId = shopId;
  }

  const invoice = await prisma.invoice.findFirst({
    where,
    include: {
      farmer: true,
      shop: true,
      user: { select: { id: true, fullName: true, role: true } },
      items: {
        include: {
          product: { select: { id: true, name: true, shortName: true, code: true, uom: true } },
          batch: { select: { id: true, batchNumber: true, expiryDate: true } },
        },
      },
      payments: true,
    },
  });

  if (!invoice) {
    const err = new Error('Invoice not found in this shop');
    err.statusCode = 404;
    throw err;
  }

  return invoice;
}

async function getInvoiceReceipt(id, shopId) {
  const invoice = await getInvoiceById(id, shopId);

  const itemsFormatted = invoice.items.map((item) => ({
    productId: item.productId,
    name: item.product ? item.product.name : 'Unknown Product',
    shortName: item.product ? (item.product.shortName || item.product.name) : 'Unknown Product',
    batchNumber: item.batch ? item.batch.batchNumber : null,
    quantity: item.quantity,
    unit: item.product ? item.product.uom : 'UNIT',
    unitPrice: item.unitPrice,
    taxAmount: 0,
    totalPrice: item.totalPrice,
  }));

  const customer = invoice.farmer
    ? {
        type: 'FARMER',
        id: invoice.farmer.id,
        name: invoice.farmer.name,
        phone: invoice.farmer.phone,
        address: invoice.farmer.address,
      }
    : {
        type: 'WALK_IN_CUSTOMER',
        name: 'Walk-in Customer',
        phone: 'N/A',
      };

  return {
    receiptHeader: {
      shopName: invoice.shop ? invoice.shop.shopName : 'Agro Shop',
      shopPhone: invoice.shop ? invoice.shop.mobile : 'N/A',
      shopAddress: invoice.shop ? invoice.shop.address : 'N/A',
      gstin: invoice.shop ? invoice.shop.gstin : null,
    },
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.createdAt,
    customer,
    items: itemsFormatted,
    summary: {
      subTotal: invoice.subTotal,
      discount: invoice.discount,
      taxAmount: 0,
      totalAmount: invoice.totalAmount,
      paidAmount: invoice.paidAmount,
      dueAmount: Math.max(0, invoice.totalAmount - invoice.paidAmount),
      paymentStatus: invoice.paymentStatus,
      paymentMethod: invoice.paymentMethod,
    },
    billingUser: invoice.user ? invoice.user.fullName : 'POS System',
  };
}

async function cancelInvoice(invoiceId, shopId, userId, reason = 'Customer Cancellation') {
  const where = { id: invoiceId };
  if (shopId) {
    where.shopId = shopId;
  }

  const invoice = await prisma.invoice.findFirst({
    where,
    include: {
      items: true,
      farmer: true,
      payments: true,
    },
  });

  if (!invoice) {
    const err = new Error('Invoice not found in this shop');
    err.statusCode = 404;
    throw err;
  }

  if (invoice.paymentStatus === 'CANCELLED') {
    const err = new Error('Invoice is already cancelled');
    err.statusCode = 400;
    throw err;
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Stock Reversal: Return stock to inventory batches & log STOCK_IN transaction
    for (const item of invoice.items) {
      if (item.batchId) {
        await tx.inventoryBatch.update({
          where: { id: item.batchId },
          data: { quantity: { increment: item.quantity } },
        });

        await tx.stockTransaction.create({
          data: {
            shopId: invoice.shopId,
            productId: item.productId,
            batchId: item.batchId,
            type: 'STOCK_IN',
            quantity: item.quantity,
            reason: `Reversal for Cancelled Invoice #${invoice.invoiceNumber}`,
            userId,
          },
        });
      }
    }

    // 2. Khata Reversal: If credit amount was added to farmer, credit back
    const remainingDue = Math.max(0, invoice.totalAmount - invoice.paidAmount);
    if (remainingDue > 0 && invoice.farmerId) {
      const farmer = await tx.farmer.findUnique({ where: { id: invoice.farmerId } });
      if (farmer) {
        const newKhataBalance = Math.max(0, farmer.khataBalance - remainingDue);
        await tx.farmer.update({
          where: { id: invoice.farmerId },
          data: { khataBalance: newKhataBalance },
        });

        await tx.khataTransaction.create({
          data: {
            shopId: invoice.shopId,
            farmerId: invoice.farmerId,
            type: 'CREDIT',
            amount: remainingDue,
            balanceAfter: newKhataBalance,
            referenceType: 'INVOICE_CANCEL',
            referenceId: invoice.id,
            description: `Cancellation reversal for Invoice #${invoice.invoiceNumber}`,
          },
        });
      }
    }

    // 3. Mark Invoice status = 'CANCELLED'
    const cancelledInvoice = await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        paymentStatus: 'CANCELLED',
        notes: invoice.notes ? `${invoice.notes} | CANCELLED: ${reason}` : `CANCELLED: ${reason}`,
      },
      include: {
        items: { include: { product: true } },
        farmer: true,
      },
    });

    return cancelledInvoice;
  });

  emitShopEvent(result.shopId, 'bill.cancelled', result);
  emitShopEvent(result.shopId, 'stock.updated', { shopId: result.shopId });
  if (result.farmerId) {
    emitShopEvent(result.shopId, 'khata.updated', { farmerId: result.farmerId });
  }

  logAuditAction({
    userId,
    shopId: result.shopId,
    action: 'BILL_CANCEL',
    module: 'BILLING',
    recordId: result.id,
    oldValue: { status: 'ACTIVE' },
    newValue: { status: 'CANCELLED', reason },
  });

  return result;
}

async function getBillingSummary(shopId, query = {}) {
  if (!shopId) {
    const err = new Error('Shop ID is required for billing summary');
    err.statusCode = 400;
    throw err;
  }

  const currentDate = query.date ? new Date(query.date) : new Date();
  const startOfDay = new Date(currentDate.setHours(0, 0, 0, 0));
  const endOfDay = new Date(currentDate.setHours(23, 59, 59, 999));

  const invoices = await prisma.invoice.findMany({
    where: {
      shopId,
      createdAt: { gte: startOfDay, lte: endOfDay },
      paymentStatus: { not: 'CANCELLED' },
    },
  });

  let totalSales = 0;
  let cashSales = 0;
  let upiSales = 0;
  let creditSales = 0;

  invoices.forEach((inv) => {
    totalSales += inv.totalAmount;
    if (inv.paymentMethod === 'CASH') cashSales += inv.paidAmount;
    else if (inv.paymentMethod === 'UPI') upiSales += inv.paidAmount;

    const due = Math.max(0, inv.totalAmount - inv.paidAmount);
    creditSales += due;
  });

  return {
    date: startOfDay.toISOString().split('T')[0],
    totalBills: invoices.length,
    totalSales,
    cashSales,
    upiSales,
    creditSales,
  };
}

module.exports = {
  generateInvoiceNumber,
  createInvoice,
  getAllInvoices,
  getInvoiceById,
  getInvoiceReceipt,
  cancelInvoice,
  getBillingSummary,
};
