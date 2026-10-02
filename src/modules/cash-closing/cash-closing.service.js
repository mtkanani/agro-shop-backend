const { prisma } = require('../../config/database');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

async function openCashRegister(userId, data) {
  const shopId = data.shopId;
  if (!shopId) {
    const err = new Error('Shop ID is required');
    err.statusCode = 400;
    throw err;
  }

  const existingOpen = await prisma.cashClosing.findFirst({
    where: {
      shopId,
      status: 'OPEN',
    },
  });

  if (existingOpen) {
    const err = new Error('An open cash register already exists for this shop. Please close it before opening a new register.');
    err.statusCode = 400;
    throw err;
  }

  return prisma.cashClosing.create({
    data: {
      shopId,
      userId,
      openingCash: data.openingCash || 0,
      status: 'OPEN',
      notes: data.notes || null,
    },
    include: {
      shop: true,
      user: { select: { id: true, fullName: true, email: true } },
    },
  });
}

async function closeCashRegister(closingId, shopId, data) {
  const where = { id: closingId };
  if (shopId) {
    where.shopId = shopId;
  }

  const register = await prisma.cashClosing.findFirst({
    where,
  });

  if (!register || register.status === 'CLOSED') {
    const err = new Error('Cash register not found in this shop or already closed');
    err.statusCode = 400;
    throw err;
  }

  // Calculate cash payments collected since register opened
  const cashPayments = await prisma.payment.aggregate({
    where: {
      shopId: register.shopId,
      createdAt: { gte: register.createdAt },
      method: 'CASH',
    },
    _sum: { amount: true },
  });

  const cashSales = cashPayments._sum.amount || 0;
  const cashExpense = data.cashExpense || 0;
  const expectedCash = register.openingCash + cashSales - cashExpense;
  const actualCash = data.actualCash !== undefined ? data.actualCash : expectedCash;
  const discrepancy = actualCash - expectedCash;

  return prisma.cashClosing.update({
    where: { id: closingId },
    data: {
      cashSales,
      cashExpense,
      expectedCash,
      actualCash,
      discrepancy,
      status: 'CLOSED',
      notes: data.notes || register.notes,
    },
    include: {
      shop: true,
      user: { select: { id: true, fullName: true } },
    },
  });
}

async function getCashClosings(query) {
  const { page, limit, skip } = getPagination(query);
  const where = {};

  if (query.shopId) where.shopId = query.shopId;
  if (query.status) where.status = query.status;

  const [total, records] = await Promise.all([
    prisma.cashClosing.count({ where }),
    prisma.cashClosing.findMany({
      where,
      skip,
      take: limit,
      include: {
        shop: { select: { id: true, shopName: true } },
        user: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    records,
    pagination: getPaginationMeta(total, page, limit),
  };
}

async function getCashClosingById(id, shopId) {
  const where = { id };
  if (shopId) {
    where.shopId = shopId;
  }

  const record = await prisma.cashClosing.findFirst({
    where,
    include: {
      shop: true,
      user: { select: { id: true, fullName: true, role: true } },
    },
  });

  if (!record) {
    const err = new Error('Cash closing session record not found');
    err.statusCode = 404;
    throw err;
  }

  return record;
}

module.exports = {
  openCashRegister,
  closeCashRegister,
  getCashClosings,
  getCashClosingById,
};
