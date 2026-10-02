const { prisma } = require('../../config/database');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

async function getFarmerLedger(farmerId, query) {
  const farmer = await prisma.farmer.findUnique({ where: { id: farmerId } });
  if (!farmer) {
    const err = new Error('Farmer profile not found');
    err.statusCode = 404;
    throw err;
  }

  const { page, limit, skip } = getPagination(query);
  const where = { farmerId };

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
    farmer,
    transactions,
    pagination: getPaginationMeta(total, page, limit),
  };
}

async function getSupplierLedger(supplierId, query) {
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) {
    const err = new Error('Supplier not found');
    err.statusCode = 404;
    throw err;
  }

  const { page, limit, skip } = getPagination(query);
  const where = { supplierId };

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
    supplier,
    transactions,
    pagination: getPaginationMeta(total, page, limit),
  };
}

async function addManualKhataEntry(data) {
  if (!data.farmerId && !data.supplierId) {
    const err = new Error('Either farmerId or supplierId must be provided');
    err.statusCode = 400;
    throw err;
  }

  return prisma.$transaction(async (tx) => {
    let balanceAfter = 0;

    if (data.farmerId) {
      const farmer = await tx.farmer.findUnique({ where: { id: data.farmerId } });
      if (!farmer) throw new Error('Farmer not found');

      // For Farmer: DEBIT increases balance owed (Debt), CREDIT decreases balance (Payment)
      const balanceChange = data.type === 'DEBIT' ? data.amount : -data.amount;
      balanceAfter = farmer.khataBalance + balanceChange;

      await tx.farmer.update({
        where: { id: data.farmerId },
        data: { khataBalance: balanceAfter },
      });
    } else if (data.supplierId) {
      const supplier = await tx.supplier.findUnique({ where: { id: data.supplierId } });
      if (!supplier) throw new Error('Supplier not found');

      // For Supplier: CREDIT increases balance owed to supplier, DEBIT decreases it
      const balanceChange = data.type === 'CREDIT' ? data.amount : -data.amount;
      balanceAfter = supplier.khataBalance + balanceChange;

      await tx.supplier.update({
        where: { id: data.supplierId },
        data: { khataBalance: balanceAfter },
      });
    }

    const transaction = await tx.khataTransaction.create({
      data: {
        type: data.type,
        amount: data.amount,
        balanceAfter,
        farmerId: data.farmerId || null,
        supplierId: data.supplierId || null,
        referenceType: 'MANUAL',
        description: data.description,
      },
    });

    return transaction;
  });
}

module.exports = {
  getFarmerLedger,
  getSupplierLedger,
  addManualKhataEntry,
};
