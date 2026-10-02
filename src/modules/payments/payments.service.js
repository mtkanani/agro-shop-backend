const { prisma } = require('../../config/database');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

async function recordPayment(data) {
  const shopId = data.shopId;
  if (!shopId) {
    const err = new Error('Shop ID is required for payment recording');
    err.statusCode = 400;
    throw err;
  }

  const pCount = await prisma.payment.count({ where: { shopId } });
  const paymentNumber = `PAY-${new Date().getFullYear()}-${String(pCount + 1).padStart(5, '0')}`;

  return prisma.$transaction(async (tx) => {
    // 1. Create Payment record
    const payment = await tx.payment.create({
      data: {
        paymentNumber,
        shopId,
        farmerId: data.farmerId || null,
        supplierId: data.supplierId || null,
        invoiceId: data.invoiceId || null,
        amount: data.amount,
        method: data.method,
        txnRef: data.txnRef || null,
        notes: data.notes || null,
      },
      include: {
        farmer: true,
        supplier: true,
        invoice: true,
      },
    });

    // 2. If Payment is for a Farmer Khata clearance
    if (data.farmerId) {
      const farmer = await tx.farmer.findUnique({ where: { id: data.farmerId } });
      if (farmer) {
        const newBalance = farmer.khataBalance - data.amount;
        await tx.farmer.update({
          where: { id: data.farmerId },
          data: { khataBalance: newBalance },
        });

        await tx.khataTransaction.create({
          data: {
            shopId,
            type: 'CREDIT',
            amount: data.amount,
            balanceAfter: newBalance,
            farmerId: data.farmerId,
            referenceType: 'PAYMENT',
            referenceId: payment.id,
            description: `Payment received via ${data.method}`,
          },
        });
      }
    }

    // 3. If Payment is to a Supplier
    if (data.supplierId) {
      const supplier = await tx.supplier.findUnique({ where: { id: data.supplierId } });
      if (supplier) {
        const newBalance = supplier.khataBalance - data.amount;
        await tx.supplier.update({
          where: { id: data.supplierId },
          data: { khataBalance: newBalance },
        });

        await tx.khataTransaction.create({
          data: {
            shopId,
            type: 'DEBIT',
            amount: data.amount,
            balanceAfter: newBalance,
            supplierId: data.supplierId,
            referenceType: 'PAYMENT',
            referenceId: payment.id,
            description: `Payment paid to supplier via ${data.method}`,
          },
        });
      }
    }

    // 4. If linked to an Invoice, update invoice status
    if (data.invoiceId) {
      const invoice = await tx.invoice.findUnique({ where: { id: data.invoiceId } });
      if (invoice) {
        const newPaidAmount = invoice.paidAmount + data.amount;
        let newStatus = 'PAID';
        if (newPaidAmount < invoice.totalAmount) {
          newStatus = 'PARTIAL';
        }

        await tx.invoice.update({
          where: { id: data.invoiceId },
          data: {
            paidAmount: newPaidAmount,
            paymentStatus: newStatus,
          },
        });
      }
    }

    return payment;
  });

  const { emitShopEvent } = require('../../config/socket');
  const { logAuditAction } = require('../../utils/auditLogger');

  emitShopEvent(shopId, 'payment.created', result);
  if (data.farmerId || data.supplierId) {
    emitShopEvent(shopId, 'khata.updated', { farmerId: data.farmerId, supplierId: data.supplierId });
  }

  logAuditAction({
    userId: data.userId || null,
    shopId,
    action: 'PAYMENT_RECORD',
    module: 'PAYMENTS',
    recordId: result.id,
    newValue: { paymentNumber: result.paymentNumber, amount: data.amount, method: data.method },
  });

  return result;
}

async function getAllPayments(query) {
  const { page, limit, skip } = getPagination(query);
  const where = {};

  if (query.farmerId) where.farmerId = query.farmerId;
  if (query.supplierId) where.supplierId = query.supplierId;
  if (query.method) where.method = query.method;

  const [total, payments] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      skip,
      take: limit,
      include: {
        farmer: { select: { id: true, name: true, phone: true } },
        supplier: { select: { id: true, name: true, companyName: true } },
        invoice: { select: { id: true, invoiceNumber: true, totalAmount: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    payments,
    pagination: getPaginationMeta(total, page, limit),
  };
}

module.exports = {
  recordPayment,
  getAllPayments,
};
