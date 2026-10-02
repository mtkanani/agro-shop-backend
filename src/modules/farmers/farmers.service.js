const { prisma } = require('../../config/database');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

async function createFarmer(data) {
  if (data.phone) {
    const existingPhone = await prisma.farmer.findFirst({
      where: { shopId: data.shopId, phone: data.phone },
    });

    if (existingPhone) {
      const error = new Error('Farmer with this phone number already exists in this shop');
      error.statusCode = 409;
      throw error;
    }
  }

  return prisma.farmer.create({
    data: {
      shopId: data.shopId,
      name: data.name,
      phone: data.phone,
      email: data.email ? data.email.trim() : null,
      village: data.village || null,
      address: data.address || null,
      aadhaarNo: data.aadhaarNo || null,
      creditLimit: data.creditLimit !== undefined ? Number(data.creditLimit) : 0,
      khataBalance: data.khataBalance !== undefined ? Number(data.khataBalance) : 0,
      preferredLanguage: data.preferredLanguage || 'gujlish',
      isActive: true,
    },
  });
}

async function getAllFarmers(query) {
  const { page, limit, skip } = getPagination(query);
  const where = { isActive: true };

  if (query.shopId) {
    where.shopId = query.shopId;
  }

  if (query.village) {
    where.village = { contains: query.village };
  }

  if (query.hasKhataDues === 'true') {
    where.khataBalance = { gt: 0 };
  }

  if (query.search) {
    where.OR = [
      { name: { contains: query.search } },
      { phone: { contains: query.search } },
      { village: { contains: query.search } },
    ];
  }

  const [total, farmers] = await Promise.all([
    prisma.farmer.count({ where }),
    prisma.farmer.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    farmers,
    pagination: getPaginationMeta(total, page, limit),
  };
}

async function findFarmerOrThrow(id, shopId, select = null) {
  const where = { id };
  if (shopId) where.shopId = shopId;

  const farmer = await prisma.farmer.findFirst({
    where,
    ...(select ? { select } : {}),
  });

  if (!farmer) {
    const err = new Error('Farmer profile not found in this shop');
    err.statusCode = 404;
    throw err;
  }

  return farmer;
}

async function getFarmerById(id, shopId) {
  const where = { id };
  if (shopId) {
    where.shopId = shopId;
  }

  const farmer = await prisma.farmer.findFirst({
    where,
    include: {
      invoices: {
        take: 5,
        orderBy: { createdAt: 'desc' },
      },
      transactions: {
        take: 5,
        orderBy: { createdAt: 'desc' },
      },
      payments: {
        take: 5,
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!farmer) {
    const err = new Error('Farmer profile not found in this shop');
    err.statusCode = 404;
    throw err;
  }

  const [totalBillsCount, invoicesSum, paymentsSum] = await Promise.all([
    prisma.invoice.count({ where: { farmerId: farmer.id } }),
    prisma.invoice.aggregate({ where: { farmerId: farmer.id }, _sum: { totalAmount: true } }),
    prisma.payment.aggregate({ where: { farmerId: farmer.id }, _sum: { amount: true } }),
  ]);

  const creditLimit = farmer.creditLimit || 0;
  const availableCredit = Math.max(0, creditLimit - farmer.khataBalance);
  let creditStatus = 'NO_DUE';
  if (farmer.khataBalance > 0) {
    if (creditLimit > 0 && farmer.khataBalance >= creditLimit) {
      creditStatus = 'LIMIT_EXCEEDED';
    } else if (creditLimit > 0 && farmer.khataBalance >= creditLimit * 0.8) {
      creditStatus = 'NEAR_LIMIT';
    } else {
      creditStatus = 'WITHIN_LIMIT';
    }
  }

  const financialSummary = {
    totalBills: totalBillsCount,
    totalPurchases: invoicesSum._sum.totalAmount || 0,
    totalPaid: paymentsSum._sum.amount || 0,
    outstanding: farmer.khataBalance,
    creditLimit,
    availableCredit,
    creditStatus,
  };

  return {
    farmer: {
      id: farmer.id,
      shopId: farmer.shopId,
      name: farmer.name,
      phone: farmer.phone,
      village: farmer.village,
      address: farmer.address,
      aadhaarNo: farmer.aadhaarNo,
      creditLimit: farmer.creditLimit,
      khataBalance: farmer.khataBalance,
      preferredLanguage: farmer.preferredLanguage || 'gujlish',
      isActive: farmer.isActive,
      createdAt: farmer.createdAt,
      updatedAt: farmer.updatedAt,
    },
    financialSummary,
    recentInvoices: farmer.invoices,
    recentKhataTransactions: farmer.transactions,
    recentPayments: farmer.payments,
  };
}

async function updateFarmer(id, shopId, data) {
  const farmer = await findFarmerOrThrow(id, shopId, { id: true });
  const updatePayload = {};

  if (data.name !== undefined) updatePayload.name = data.name;
  if (data.phone !== undefined) updatePayload.phone = data.phone;
  if (data.email !== undefined) updatePayload.email = data.email ? data.email.trim() : null;
  if (data.village !== undefined) updatePayload.village = data.village;
  if (data.address !== undefined) updatePayload.address = data.address;
  if (data.aadhaarNo !== undefined) updatePayload.aadhaarNo = data.aadhaarNo;
  if (data.creditLimit !== undefined) updatePayload.creditLimit = Number(data.creditLimit);
  if (data.preferredLanguage !== undefined) updatePayload.preferredLanguage = data.preferredLanguage;

  return prisma.farmer.update({
    where: { id: farmer.id },
    data: updatePayload,
  });
}

async function deleteFarmer(id, shopId) {
  const farmer = await findFarmerOrThrow(id, shopId, { id: true });
  return prisma.farmer.update({
    where: { id: farmer.id },
    data: { isActive: false },
  });
}

async function getFarmerKhata(id, shopId, query = {}) {
  const farmer = await findFarmerOrThrow(id, shopId, {
    id: true,
    name: true,
    phone: true,
    khataBalance: true,
    creditLimit: true,
  });
  const { page, limit, skip } = getPagination(query);

  const where = { farmerId: farmer.id };
  if (shopId) {
    where.shopId = shopId;
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

  return {
    farmer: {
      id: farmer.id,
      name: farmer.name,
      phone: farmer.phone,
      khataBalance: farmer.khataBalance,
      creditLimit: farmer.creditLimit,
    },
    transactions,
    pagination: getPaginationMeta(total, page, limit),
  };
}

async function getFarmerBills(id, shopId, query = {}) {
  const farmer = await findFarmerOrThrow(id, shopId, {
    id: true,
    name: true,
    phone: true,
  });
  const { page, limit, skip } = getPagination(query);

  const where = { farmerId: farmer.id };
  if (shopId) {
    where.shopId = shopId;
  }

  const [total, bills] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      skip,
      take: limit,
      include: {
        items: true,
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    farmer: {
      id: farmer.id,
      name: farmer.name,
      phone: farmer.phone,
    },
    bills,
    pagination: getPaginationMeta(total, page, limit),
  };
}

async function getFarmerPayments(id, shopId, query = {}) {
  const farmer = await findFarmerOrThrow(id, shopId, {
    id: true,
    name: true,
    phone: true,
  });
  const { page, limit, skip } = getPagination(query);

  const where = { farmerId: farmer.id };
  if (shopId) {
    where.shopId = shopId;
  }

  const [total, payments] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      skip,
      take: limit,
      include: {
        invoice: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    farmer: {
      id: farmer.id,
      name: farmer.name,
      phone: farmer.phone,
    },
    payments,
    pagination: getPaginationMeta(total, page, limit),
  };
}

async function getFarmerOutstanding(id, shopId) {
  const farmer = await findFarmerOrThrow(id, shopId, {
    id: true,
    name: true,
    phone: true,
    village: true,
    creditLimit: true,
    khataBalance: true,
  });
  const creditLimit = farmer.creditLimit || 0;
  const availableCredit = Math.max(0, creditLimit - farmer.khataBalance);

  let creditStatus = 'NO_DUE';
  if (farmer.khataBalance > 0) {
    if (creditLimit > 0 && farmer.khataBalance >= creditLimit) {
      creditStatus = 'LIMIT_EXCEEDED';
    } else if (creditLimit > 0 && farmer.khataBalance >= creditLimit * 0.8) {
      creditStatus = 'NEAR_LIMIT';
    } else {
      creditStatus = 'WITHIN_LIMIT';
    }
  }

  return {
    farmerId: farmer.id,
    farmerName: farmer.name,
    phone: farmer.phone,
    village: farmer.village,
    creditLimit,
    outstanding: farmer.khataBalance,
    availableCredit,
    creditStatus,
  };
}

async function recordFarmerPayment(id, shopId, data) {
  const farmer = await findFarmerOrThrow(id, shopId, {
    id: true,
    shopId: true,
    isActive: true,
  });

  if (farmer.isActive === false) {
    const err = new Error('This farmer is inactive and cannot be used for new transactions');
    err.statusCode = 400;
    throw err;
  }

  const paymentService = require('../payments/payments.service');
  return paymentService.recordPayment({
    amount: data.amount,
    method: data.method || 'CASH',
    txnRef: data.txnRef || null,
    notes: data.notes || null,
    shopId: farmer.shopId,
    farmerId: farmer.id,
    userId: data.userId || null,
  });
}

module.exports = {
  createFarmer,
  getAllFarmers,
  getFarmerById,
  updateFarmer,
  deleteFarmer,
  getFarmerKhata,
  getFarmerBills,
  getFarmerPayments,
  getFarmerOutstanding,
  recordFarmerPayment,
};
