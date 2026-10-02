const { prisma } = require('../../config/database');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

async function createShop(data) {
  return prisma.shop.create({
    data,
  });
}

async function getAllShops(query) {
  const { page, limit, skip } = getPagination(query);
  const where = { status: 'ACTIVE' };

  if (query.search) {
    where.OR = [
      { shopName: { contains: query.search } },
      { code: { contains: query.search } },
      { mobile: { contains: query.search } },
      { ownerName: { contains: query.search } },
    ];
  }

  const [total, shops] = await Promise.all([
    prisma.shop.count({ where }),
    prisma.shop.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    shops,
    pagination: getPaginationMeta(total, page, limit),
  };
}

async function getShopById(id) {
  const shop = await prisma.shop.findUnique({
    where: { id },
    include: {
      users: { select: { id: true, fullName: true, email: true, mobile: true, role: true, status: true } },
      _count: { select: { products: true, invoices: true } },
    },
  });

  if (!shop) {
    const err = new Error('Shop not found');
    err.statusCode = 404;
    throw err;
  }
  return shop;
}

async function updateShop(id, data) {
  return prisma.shop.update({
    where: { id },
    data,
  });
}

async function deleteShop(id) {
  return prisma.shop.update({
    where: { id },
    data: { status: 'INACTIVE' },
  });
}

module.exports = {
  createShop,
  getAllShops,
  getShopById,
  updateShop,
  deleteShop,
};
