const { prisma } = require('../../config/database');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');
const { emitShopEvent } = require('../../config/socket');
const { logAuditAction } = require('../../utils/auditLogger');
const emailService = require('../../services/email.service');
const whatsappService = require('../../services/whatsapp.service');

async function generatePaymentNumber(shopId, tx = null) {
  const db = tx || prisma;
  const pYear = new Date().getFullYear();
  const prefix = `PAY-${pYear}-`;
  const latestPayment = await db.payment.findFirst({
    where: {
      shopId,
      paymentNumber: { startsWith: prefix },
    },
    orderBy: { paymentNumber: 'desc' },
    select: { paymentNumber: true },
  });

  let nextSeq = '00001';
  if (latestPayment && latestPayment.paymentNumber) {
    const lastSeq = parseInt(latestPayment.paymentNumber.slice(prefix.length), 10);
    if (!isNaN(lastSeq)) {
      nextSeq = String(lastSeq + 1).padStart(5, '0');
    }
  }
  return `${prefix}${nextSeq}`;
}

async function getCreditOverview(shopId) {
  if (!shopId) {
    const err = new Error('Shop ID is required');
    err.statusCode = 400;
    throw err;
  }

  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const endOfDay = new Date(today.setHours(23, 59, 59, 999));
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [outstandingAgg, farmersWithDueCount, overdueAgg, paymentsTodayAgg, invoicesTodayAgg] = await Promise.all([
    // Total Outstanding across shop farmers
    prisma.farmer.aggregate({
      _sum: { khataBalance: true },
      where: { shopId, khataBalance: { gt: 0 }, isActive: true },
    }),
    // Count of farmers with outstanding due
    prisma.farmer.count({
      where: { shopId, khataBalance: { gt: 0 }, isActive: true },
    }),
    // Overdue invoices aggregate in O(1) DB query
    prisma.invoice.aggregate({
      where: {
        shopId,
        paymentStatus: { in: ['UNPAID', 'PARTIAL'] },
        createdAt: { lte: thirtyDaysAgo },
      },
      _sum: { totalAmount: true, paidAmount: true },
    }),
    // Payments received today
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        shopId,
        farmerId: { not: null },
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
    }),
    // Credit dues created today in O(1) DB query
    prisma.invoice.aggregate({
      where: {
        shopId,
        createdAt: { gte: startOfDay, lte: endOfDay },
        paymentStatus: { in: ['UNPAID', 'PARTIAL'] },
      },
      _sum: { totalAmount: true, paidAmount: true },
    }),
  ]);

  const totalOutstanding = Math.max(0, outstandingAgg._sum.khataBalance || 0);
  const farmersWithDue = farmersWithDueCount || 0;
  const paymentsToday = Math.max(0, paymentsTodayAgg._sum.amount || 0);
  const totalOverdue = Math.max(0, (overdueAgg._sum.totalAmount || 0) - (overdueAgg._sum.paidAmount || 0));
  const creditSalesToday = Math.max(0, (invoicesTodayAgg._sum.totalAmount || 0) - (invoicesTodayAgg._sum.paidAmount || 0));

  return {
    totalOutstanding,
    totalOverdue,
    farmersWithDue,
    paymentsToday,
    creditSalesToday,
  };
}

async function getFarmerCreditList(shopId, query = {}) {
  const { page, limit, skip } = getPagination(query);
  const where = { shopId, isActive: true };

  if (query.search) {
    const search = query.search.trim();
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { village: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (query.status === 'DUE') {
    where.khataBalance = { gt: 0 };
  } else if (query.status === 'NO_DUE') {
    where.khataBalance = { lte: 0 };
  }

  const [total, farmers] = await Promise.all([
    prisma.farmer.count({ where }),
    prisma.farmer.findMany({
      where,
      skip,
      take: limit,
      orderBy: { khataBalance: 'desc' },
      include: {
        invoices: {
          where: { paymentStatus: { in: ['UNPAID', 'PARTIAL'] } },
          select: { id: true, invoiceNumber: true, totalAmount: true, paidAmount: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    }),
  ]);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const formattedFarmers = farmers.map((farmer) => {
    let overdueAmount = 0;
    farmer.invoices.forEach((inv) => {
      if (new Date(inv.createdAt) <= thirtyDaysAgo) {
        overdueAmount += Math.max(0, inv.totalAmount - inv.paidAmount);
      }
    });

    let status = 'NO_DUE';
    if (farmer.khataBalance > 0) {
      status = overdueAmount > 0 ? 'OVERDUE' : 'DUE';
    }

    return {
      id: farmer.id,
      name: farmer.name,
      phone: farmer.phone,
      village: farmer.village,
      creditLimit: farmer.creditLimit,
      totalDue: farmer.khataBalance,
      availableCredit: Math.max(0, farmer.creditLimit - farmer.khataBalance),
      overdueAmount,
      status,
      unpaidInvoicesCount: farmer.invoices.length,
    };
  });

  return {
    farmers: formattedFarmers,
    pagination: getPaginationMeta(total, page, limit),
  };
}

async function getOverdueInvoices(shopId, query = {}) {
  const { page, limit, skip } = getPagination(query);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const where = {
    shopId,
    paymentStatus: { in: ['UNPAID', 'PARTIAL'] },
    createdAt: { lte: thirtyDaysAgo },
  };

  if (query.search) {
    const search = query.search.trim();
    where.OR = [
      { invoiceNumber: { contains: search, mode: 'insensitive' } },
      { farmer: { name: { contains: search, mode: 'insensitive' } } },
      { farmer: { phone: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [total, invoices] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      skip,
      take: limit,
      include: {
        farmer: { select: { id: true, name: true, phone: true, village: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const now = new Date();
  const formattedInvoices = invoices.map((inv) => {
    const createdDate = new Date(inv.createdAt);
    const daysOverdue = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24)) - 30;
    const remainingDue = Math.max(0, inv.totalAmount - inv.paidAmount);

    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      createdAt: inv.createdAt,
      farmer: inv.farmer,
      totalAmount: inv.totalAmount,
      paidAmount: inv.paidAmount,
      dueAmount: remainingDue,
      daysOverdue: Math.max(1, daysOverdue),
    };
  });

  return {
    invoices: formattedInvoices,
    pagination: getPaginationMeta(total, page, limit),
  };
}

async function getFarmerCreditSummary(farmerId, shopId) {
  const farmer = await prisma.farmer.findFirst({
    where: { id: farmerId, shopId },
    include: {
      invoices: {
        select: { id: true, invoiceNumber: true, totalAmount: true, paidAmount: true, paymentStatus: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
      payments: {
        select: { id: true, paymentNumber: true, amount: true, method: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
  });

  if (!farmer) {
    const err = new Error('Farmer not found in this shop');
    err.statusCode = 404;
    throw err;
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  let totalCreditSales = 0;
  let overdueAmount = 0;

  farmer.invoices.forEach((inv) => {
    totalCreditSales += inv.totalAmount;
    if (['UNPAID', 'PARTIAL'].includes(inv.paymentStatus) && new Date(inv.createdAt) <= thirtyDaysAgo) {
      overdueAmount += Math.max(0, inv.totalAmount - inv.paidAmount);
    }
  });

  let totalPayments = 0;
  farmer.payments.forEach((p) => {
    totalPayments += p.amount;
  });

  const lastPayment = farmer.payments.length > 0 ? farmer.payments[0] : null;

  return {
    farmer: {
      id: farmer.id,
      name: farmer.name,
      phone: farmer.phone,
      village: farmer.village,
      address: farmer.address,
    },
    creditInfo: {
      creditLimit: farmer.creditLimit,
      totalOutstanding: farmer.khataBalance,
      availableCredit: Math.max(0, farmer.creditLimit - farmer.khataBalance),
      overdueAmount,
      totalCreditSales,
      totalPayments,
    },
    lastPayment: lastPayment
      ? {
          paymentNumber: lastPayment.paymentNumber,
          amount: lastPayment.amount,
          method: lastPayment.method,
          date: lastPayment.createdAt,
        }
      : null,
    recentPayments: farmer.payments,
  };
}

async function getFarmerLedger(farmerId, shopId, query = {}) {
  const farmer = await prisma.farmer.findFirst({
    where: { id: farmerId, shopId },
  });

  if (!farmer) {
    const err = new Error('Farmer not found in this shop');
    err.statusCode = 404;
    throw err;
  }

  const { page, limit, skip } = getPagination(query);
  const where = { farmerId, shopId };

  if (query.fromDate || query.toDate) {
    where.createdAt = {};
    if (query.fromDate) where.createdAt.gte = new Date(query.fromDate);
    if (query.toDate) where.createdAt.lte = new Date(query.toDate);
  }

  const [total, transactions] = await Promise.all([
    prisma.khataTransaction.count({ where }),
    prisma.khataTransaction.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  let totalDebit = 0;
  let totalCredit = 0;

  transactions.forEach((tx) => {
    if (tx.type === 'DEBIT') totalDebit += tx.amount;
    else if (tx.type === 'CREDIT') totalCredit += tx.amount;
  });

  return {
    farmer: { id: farmer.id, name: farmer.name, phone: farmer.phone, village: farmer.village },
    summary: {
      totalDebit,
      totalCredit,
      closingBalance: farmer.khataBalance,
    },
    transactions,
    pagination: getPaginationMeta(total, page, limit),
  };
}

async function recordFarmerPayment(userId, shopId, data) {
  if (!shopId) {
    const err = new Error('Shop ID is required for payment recording');
    err.statusCode = 400;
    throw err;
  }

  const farmer = await prisma.farmer.findFirst({
    where: { id: data.farmerId, shopId },
  });

  if (!farmer) {
    const err = new Error('Farmer not found in this shop');
    err.statusCode = 404;
    throw err;
  }

  if (farmer.khataBalance <= 0) {
    const err = new Error('Farmer has no outstanding balance to pay');
    err.statusCode = 400;
    throw err;
  }

  if (data.amount > farmer.khataBalance) {
    const err = new Error(`Payment amount (₹${data.amount}) exceeds farmer outstanding balance (₹${farmer.khataBalance})`);
    err.statusCode = 400;
    throw err;
  }

  const paymentNumber = await generatePaymentNumber(shopId);

  const result = await prisma.$transaction(async (tx) => {
    // 1. Create Payment Record
    const payment = await tx.payment.create({
      data: {
        paymentNumber,
        shopId,
        farmerId: farmer.id,
        invoiceId: data.invoiceId || null,
        amount: data.amount,
        method: data.method || 'CASH',
        txnRef: data.txnRef || null,
        notes: data.notes || `Payment received for ${farmer.name}`,
      },
    });

    // 2. Allocate payment to invoices (Oldest Due First or specific invoiceId)
    let remainingToAllocate = data.amount;

    let targetInvoices = [];
    if (data.invoiceId) {
      const inv = await tx.invoice.findFirst({
        where: { id: data.invoiceId, farmerId: farmer.id, shopId },
      });
      if (inv) targetInvoices.push(inv);
    } else {
      targetInvoices = await tx.invoice.findMany({
        where: { farmerId: farmer.id, shopId, paymentStatus: { in: ['UNPAID', 'PARTIAL'] } },
        orderBy: { createdAt: 'asc' },
      });
    }

    for (const inv of targetInvoices) {
      if (remainingToAllocate <= 0) break;

      const invDue = Math.max(0, inv.totalAmount - inv.paidAmount);
      if (invDue > 0) {
        const allocate = Math.min(remainingToAllocate, invDue);
        const newPaid = inv.paidAmount + allocate;
        const newStatus = newPaid >= inv.totalAmount ? 'PAID' : 'PARTIAL';

        await tx.invoice.update({
          where: { id: inv.id },
          data: { paidAmount: newPaid, paymentStatus: newStatus },
        });

        await tx.paymentAllocation.create({
          data: {
            paymentId: payment.id,
            invoiceId: inv.id,
            amountAllocated: allocate,
          },
        });

        remainingToAllocate -= allocate;
      }
    }

    // 3. Decrement Farmer Khata Balance
    const newKhataBalance = farmer.khataBalance - data.amount;
    await tx.farmer.update({
      where: { id: farmer.id },
      data: { khataBalance: newKhataBalance },
    });

    // 4. Record KhataTransaction (CREDIT)
    const khataTx = await tx.khataTransaction.create({
      data: {
        shopId,
        type: 'CREDIT',
        amount: data.amount,
        balanceAfter: newKhataBalance,
        farmerId: farmer.id,
        referenceType: 'PAYMENT',
        referenceId: payment.id,
        description: `Payment received via ${data.method} (${paymentNumber})`,
      },
    });

    return {
      payment,
      previousDue: farmer.khataBalance,
      paidAmount: data.amount,
      remainingDue: newKhataBalance,
      khataTransaction: khataTx,
    };
  });

  const notificationService = require('../notifications/notification.service');
  notificationService.createNotificationFromEvent(shopId, {
    type: 'PAYMENT_RECEIVED',
    title: 'Payment Received',
    message: `${farmer.name} paid ₹${data.amount} via ${data.method || 'CASH'}.`,
    entityType: 'FARMER',
    entityId: farmer.id,
  });

  emitShopEvent(shopId, 'payment.created', result.payment);
  emitShopEvent(shopId, 'khata.updated', { farmerId: farmer.id });

  logAuditAction({
    userId,
    shopId,
    action: 'PAYMENT_RECORD',
    module: 'FARMER_CREDIT',
    recordId: result.payment.id,
    newValue: { paymentNumber, amount: data.amount, remainingDue: result.remainingDue },
  });

  return result;
}

async function settleInvoiceDue(invoiceId, shopId, userId, data = {}) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, shopId },
    include: { farmer: true },
  });

  if (!invoice) {
    const err = new Error('Invoice not found in this shop');
    err.statusCode = 404;
    throw err;
  }

  if (invoice.paymentStatus === 'PAID') {
    const err = new Error('Invoice is already fully PAID');
    err.statusCode = 400;
    throw err;
  }

  if (invoice.paymentStatus === 'CANCELLED') {
    const err = new Error('Cannot settle a cancelled invoice');
    err.statusCode = 400;
    throw err;
  }

  const remainingDue = Math.max(0, invoice.totalAmount - invoice.paidAmount);
  if (remainingDue <= 0) {
    const err = new Error('Invoice has no remaining due balance');
    err.statusCode = 400;
    throw err;
  }

  const paymentNumber = await generatePaymentNumber(shopId);

  const result = await prisma.$transaction(async (tx) => {
    // 1. Create Payment
    const payment = await tx.payment.create({
      data: {
        paymentNumber,
        shopId,
        farmerId: invoice.farmerId,
        invoiceId: invoice.id,
        amount: remainingDue,
        method: data.paymentMethod || 'CASH',
        txnRef: data.paymentRef || null,
        notes: data.notes || `Full settlement for Invoice #${invoice.invoiceNumber}`,
      },
    });

    // 2. Mark Invoice status = PAID
    const updatedInvoice = await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        paidAmount: invoice.totalAmount,
        paymentStatus: 'PAID',
      },
    });

    await tx.paymentAllocation.create({
      data: {
        paymentId: payment.id,
        invoiceId: invoice.id,
        amountAllocated: remainingDue,
      },
    });

    // 3. Decrement Farmer Khata Balance if linked to a farmer
    let updatedKhataBalance = 0;
    if (invoice.farmerId && invoice.farmer) {
      updatedKhataBalance = Math.max(0, invoice.farmer.khataBalance - remainingDue);
      await tx.farmer.update({
        where: { id: invoice.farmerId },
        data: { khataBalance: updatedKhataBalance },
      });

      await tx.khataTransaction.create({
        data: {
          shopId,
          type: 'CREDIT',
          amount: remainingDue,
          balanceAfter: updatedKhataBalance,
          farmerId: invoice.farmerId,
          referenceType: 'INVOICE_SETTLEMENT',
          referenceId: invoice.id,
          description: `Full settlement for Invoice #${invoice.invoiceNumber}`,
        },
      });
    }

    return {
      invoice: updatedInvoice,
      payment,
      settledAmount: remainingDue,
      farmerKhataBalance: updatedKhataBalance,
    };
  });

  emitShopEvent(shopId, 'invoice.settled', result.invoice);
  emitShopEvent(shopId, 'khata.updated', { farmerId: invoice.farmerId });

  logAuditAction({
    userId,
    shopId,
    action: 'BILL_SETTLE',
    module: 'FARMER_CREDIT',
    recordId: invoice.id,
    newValue: { invoiceNumber: invoice.invoiceNumber, settledAmount: remainingDue, status: 'PAID' },
  });

  return result;
}

async function getPaymentReceipt(paymentId, shopId) {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, shopId },
    include: {
      farmer: true,
      shop: true,
      invoice: true,
    },
  });

  if (!payment) {
    const err = new Error('Payment record not found in this shop');
    err.statusCode = 404;
    throw err;
  }

  const previousDue = (payment.farmer ? payment.farmer.khataBalance : 0) + payment.amount;

  return {
    receiptHeader: {
      shopName: payment.shop ? payment.shop.shopName : 'Agro Shop',
      shopPhone: payment.shop ? payment.shop.mobile : 'N/A',
      shopAddress: payment.shop ? payment.shop.address : 'N/A',
    },
    paymentNumber: payment.paymentNumber,
    paymentDate: payment.createdAt,
    customer: payment.farmer
      ? { id: payment.farmer.id, name: payment.farmer.name, phone: payment.farmer.phone }
      : { name: 'Walk-in Customer', phone: 'N/A' },
    paymentDetails: {
      method: payment.method,
      txnRef: payment.txnRef,
      notes: payment.notes,
      amountPaid: payment.amount,
      previousDue,
      remainingDue: payment.farmer ? payment.farmer.khataBalance : 0,
    },
    linkedInvoice: payment.invoice
      ? { invoiceNumber: payment.invoice.invoiceNumber, totalAmount: payment.invoice.totalAmount }
      : null,
  };
}

async function reversePayment(paymentId, shopId, userId, reason = 'Payment Reversal') {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, shopId },
    include: {
      allocations: true,
      farmer: true,
    },
  });

  if (!payment) {
    const err = new Error('Payment record not found in this shop');
    err.statusCode = 404;
    throw err;
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Restore Farmer Khata Balance if linked to farmer
    let newBalance = 0;
    if (payment.farmerId && payment.farmer) {
      newBalance = payment.farmer.khataBalance + payment.amount;
      await tx.farmer.update({
        where: { id: payment.farmerId },
        data: { khataBalance: newBalance },
      });

      await tx.khataTransaction.create({
        data: {
          shopId,
          type: 'DEBIT',
          amount: payment.amount,
          balanceAfter: newBalance,
          farmerId: payment.farmerId,
          referenceType: 'PAYMENT_REVERSAL',
          referenceId: payment.id,
          description: `Reversal of Payment #${payment.paymentNumber}. Reason: ${reason}`,
        },
      });
    }

    // 2. Revert invoice paid amounts for allocations
    for (const alloc of payment.allocations) {
      const inv = await tx.invoice.findUnique({ where: { id: alloc.invoiceId } });
      if (inv) {
        const revertedPaid = Math.max(0, inv.paidAmount - alloc.amountAllocated);
        const newStatus = revertedPaid <= 0 ? 'UNPAID' : 'PARTIAL';
        await tx.invoice.update({
          where: { id: inv.id },
          data: { paidAmount: revertedPaid, paymentStatus: newStatus },
        });
      }
    }

    return {
      reversedPaymentNumber: payment.paymentNumber,
      amountReversed: payment.amount,
      restoredBalance: newBalance,
    };
  });

  emitShopEvent(shopId, 'payment.reversed', result);
  if (payment.farmerId) {
    emitShopEvent(shopId, 'khata.updated', { farmerId: payment.farmerId });
  }

  logAuditAction({
    userId,
    shopId,
    action: 'PAYMENT_REVERSE',
    module: 'FARMER_CREDIT',
    recordId: payment.id,
    newValue: { paymentNumber: payment.paymentNumber, amountReversed: payment.amount, reason },
  });

  return result;
}

async function createCreditAdjustment(userId, shopId, data) {
  const farmer = await prisma.farmer.findFirst({
    where: { id: data.farmerId, shopId },
  });

  if (!farmer) {
    const err = new Error('Farmer not found in this shop');
    err.statusCode = 404;
    throw err;
  }

  const balanceChange = data.type === 'DEBIT' ? data.amount : -data.amount;
  const newKhataBalance = Math.max(0, farmer.khataBalance + balanceChange);

  const transaction = await prisma.$transaction(async (tx) => {
    await tx.farmer.update({
      where: { id: farmer.id },
      data: { khataBalance: newKhataBalance },
    });

    const khataTx = await tx.khataTransaction.create({
      data: {
        shopId,
        type: data.type,
        amount: data.amount,
        balanceAfter: newKhataBalance,
        farmerId: farmer.id,
        referenceType: 'ADJUSTMENT',
        description: `Manual Adjustment (${data.type}): ${data.reason}`,
      },
    });

    return khataTx;
  });

  emitShopEvent(shopId, 'khata.updated', { farmerId: farmer.id });

  logAuditAction({
    userId,
    shopId,
    action: 'CREDIT_ADJUST',
    module: 'FARMER_CREDIT',
    recordId: transaction.id,
    newValue: { amount: data.amount, type: data.type, newBalance: newKhataBalance, reason: data.reason },
  });

  return transaction;
}

async function setCreditLimit(farmerId, shopId, creditLimit) {
  const farmer = await prisma.farmer.findFirst({
    where: { id: farmerId, shopId },
  });

  if (!farmer) {
    const err = new Error('Farmer not found in this shop');
    err.statusCode = 404;
    throw err;
  }

  const updatedFarmer = await prisma.farmer.update({
    where: { id: farmerId },
    data: { creditLimit },
  });

  emitShopEvent(shopId, 'farmer.updated', { farmerId });

  return updatedFarmer;
}

async function createOpeningBalance(userId, shopId, farmerId, data) {
  const farmer = await prisma.farmer.findFirst({
    where: { id: farmerId, shopId },
  });

  if (!farmer) {
    const err = new Error('Farmer not found in this shop');
    err.statusCode = 404;
    throw err;
  }

  const balanceChange = data.type === 'DEBIT' ? data.amount : -data.amount;
  const newKhataBalance = Math.max(0, farmer.khataBalance + balanceChange);

  const result = await prisma.$transaction(async (tx) => {
    await tx.farmer.update({
      where: { id: farmer.id },
      data: { khataBalance: newKhataBalance },
    });

    const khataTx = await tx.khataTransaction.create({
      data: {
        shopId,
        type: data.type || 'DEBIT',
        amount: data.amount,
        balanceAfter: newKhataBalance,
        farmerId: farmer.id,
        referenceType: 'OPENING_BALANCE',
        description: data.reason || 'Opening Balance Initialization',
      },
    });

    return khataTx;
  });

  emitShopEvent(shopId, 'khata.updated', { farmerId });

  logAuditAction({
    userId,
    shopId,
    action: 'OPENING_BALANCE_CREATE',
    module: 'FARMER_CREDIT',
    recordId: result.id,
    newValue: { farmerId, amount: data.amount, newBalance: newKhataBalance },
  });

  return result;
}

async function getFarmerBillsSummary(farmerId, shopId) {
  const farmer = await prisma.farmer.findFirst({
    where: { id: farmerId, shopId },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      village: true,
      khataBalance: true,
    },
  });

  if (!farmer) {
    const err = new Error('Farmer not found in this shop');
    err.statusCode = 404;
    throw err;
  }

  const invoices = await prisma.invoice.findMany({
    where: { shopId, farmerId },
    select: {
      id: true,
      invoiceNumber: true,
      totalAmount: true,
      paidAmount: true,
      paymentStatus: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const summaries = {
    ALL: { count: 0, totalAmount: 0, totalPaid: 0, totalDue: 0 },
    PENDING: { count: 0, totalAmount: 0, totalPaid: 0, totalDue: 0 },
    COMPLETED: { count: 0, totalAmount: 0, totalPaid: 0, totalDue: 0 },
  };

  invoices.forEach((inv) => {
    const due = Math.max(0, inv.totalAmount - inv.paidAmount);

    // All
    summaries.ALL.count += 1;
    summaries.ALL.totalAmount += inv.totalAmount;
    summaries.ALL.totalPaid += inv.paidAmount;
    summaries.ALL.totalDue += due;

    // Pending: unpaid or partial or has due
    if (['UNPAID', 'PARTIAL'].includes(inv.paymentStatus) || due > 0) {
      summaries.PENDING.count += 1;
      summaries.PENDING.totalAmount += inv.totalAmount;
      summaries.PENDING.totalPaid += inv.paidAmount;
      summaries.PENDING.totalDue += due;
    }

    // Completed: paid and no due
    if (inv.paymentStatus === 'PAID' && due <= 0) {
      summaries.COMPLETED.count += 1;
      summaries.COMPLETED.totalAmount += inv.totalAmount;
      summaries.COMPLETED.totalPaid += inv.paidAmount;
      summaries.COMPLETED.totalDue += 0;
    }
  });

  // Round numbers
  ['ALL', 'PENDING', 'COMPLETED'].forEach((key) => {
    summaries[key].totalAmount = Math.round(summaries[key].totalAmount * 100) / 100;
    summaries[key].totalPaid = Math.round(summaries[key].totalPaid * 100) / 100;
    summaries[key].totalDue = Math.round(summaries[key].totalDue * 100) / 100;
  });

  return {
    farmer,
    summaries,
  };
}

async function sendFarmerBills(shopId, userId, farmerId, data) {
  const { billType, channels = ['EMAIL', 'WHATSAPP'], recipientEmail, recipientPhone, customNote, lang } = data;

  const [farmer, shop] = await Promise.all([
    prisma.farmer.findFirst({
      where: { id: farmerId, shopId },
    }),
    prisma.shop.findUnique({
      where: { id: shopId },
    }),
  ]);

  if (!farmer) {
    const err = new Error('Farmer not found in this shop');
    err.statusCode = 404;
    throw err;
  }

  const targetLang = lang || farmer.preferredLanguage || shop?.defaultLanguage || 'en';

  // Determine invoice filter based on billType
  const where = { shopId, farmerId };
  if (billType === 'PENDING') {
    where.paymentStatus = { in: ['UNPAID', 'PARTIAL'] };
  } else if (billType === 'COMPLETED') {
    where.paymentStatus = 'PAID';
  }

  const bills = await prisma.invoice.findMany({
    where,
    include: {
      items: {
        select: {
          id: true,
          productId: true,
          quantity: true,
          unitPrice: true,
          totalPrice: true,
          product: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Calculate totals
  let totalAmount = 0;
  let totalPaid = 0;
  let totalDue = 0;

  bills.forEach((inv) => {
    totalAmount += inv.totalAmount;
    totalPaid += inv.paidAmount;
    totalDue += Math.max(0, inv.totalAmount - inv.paidAmount);
  });

  const summary = {
    count: bills.length,
    totalAmount: Math.round(totalAmount * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    totalDue: Math.round(totalDue * 100) / 100,
  };

  const targetEmail = recipientEmail || farmer.email;
  const targetPhone = recipientPhone || farmer.phone;

  const delivery = {
    language: targetLang,
    email: null,
    whatsapp: null,
  };

  // 1. Email Delivery
  if (channels.includes('EMAIL')) {
    if (targetEmail) {
      try {
        await emailService.sendFarmerBillsEmail({
          to: targetEmail,
          shop,
          farmer,
          billType,
          bills,
          summary,
          customNote,
          lang: targetLang,
        });
        delivery.email = {
          sent: true,
          recipient: targetEmail,
        };
      } catch (err) {
        delivery.email = {
          sent: false,
          recipient: targetEmail,
          error: err.message,
        };
      }
    } else {
      delivery.email = {
        sent: false,
        recipient: null,
        reason: 'No email address registered or provided for this farmer',
      };
    }
  }

  // 2. WhatsApp Delivery
  if (channels.includes('WHATSAPP')) {
    const formattedMessage = whatsappService.formatFarmerBillsWhatsAppMessage({
      shop,
      farmer,
      billType,
      bills,
      summary,
      customNote,
      lang: targetLang,
    });

    const deepLink = whatsappService.generateWhatsAppDeepLink({
      phone: targetPhone,
      message: formattedMessage,
    });

    if (targetPhone) {
      try {
        const waRes = await whatsappService.sendWhatsApp({
          phone: targetPhone,
          message: formattedMessage,
        });
        delivery.whatsapp = {
          sent: true,
          recipient: targetPhone,
          deepLink,
          messagePreview: formattedMessage.slice(0, 150),
          status: waRes.status,
        };
      } catch (err) {
        delivery.whatsapp = {
          sent: false,
          recipient: targetPhone,
          deepLink,
          error: err.message,
        };
      }
    } else {
      delivery.whatsapp = {
        sent: false,
        recipient: null,
        deepLink,
        reason: 'No phone number registered or provided for this farmer',
      };
    }
  }

  // Audit log
  logAuditAction({
    userId,
    shopId,
    action: 'FARMER_BILLS_SENT',
    module: 'FARMER_CREDIT',
    recordId: farmer.id,
    newValue: {
      billType,
      channels,
      summary,
      delivery,
    },
  });

  return {
    farmer: {
      id: farmer.id,
      name: farmer.name,
      phone: targetPhone,
      email: targetEmail,
    },
    billType,
    language: targetLang,
    summary,
    delivery,
  };
}

module.exports = {
  getCreditOverview,
  getFarmerCreditList,
  getOverdueInvoices,
  getFarmerCreditSummary,
  getFarmerLedger,
  recordFarmerPayment,
  settleInvoiceDue,
  getPaymentReceipt,
  reversePayment,
  createCreditAdjustment,
  setCreditLimit,
  createOpeningBalance,
  getFarmerBillsSummary,
  sendFarmerBills,
};

