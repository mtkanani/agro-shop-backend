const { prisma } = require('../../config/database');
const { hashPassword } = require('../../utils/password');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

async function createUser(data) {
  const hashedPassword = await hashPassword(data.password);
  return prisma.user.create({
    data: {
      fullName: data.fullName,
      email: data.email,
      mobile: data.mobile || null,
      passwordHash: hashedPassword,
      role: data.role,
      shopId: data.shopId || null,
      status: 'ACTIVE',
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      mobile: true,
      role: true,
      shopId: true,
      shop: true,
      status: true,
      createdAt: true,
    },
  });
}

async function getAllUsers(query) {
  const { page, limit, skip } = getPagination(query);
  const where = {};

  if (query.shopId) {
    where.shopId = query.shopId;
  }

  if (query.role) {
    where.role = query.role;
  }

  if (query.search) {
    where.OR = [
      { fullName: { contains: query.search } },
      { email: { contains: query.search } },
      { mobile: { contains: query.search } },
    ];
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      select: {
        id: true,
        fullName: true,
        email: true,
        mobile: true,
        role: true,
        shopId: true,
        shop: { select: { id: true, shopName: true, code: true } },
        status: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    users,
    pagination: getPaginationMeta(total, page, limit),
  };
}

async function getUserById(id) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      fullName: true,
      email: true,
      mobile: true,
      role: true,
      shopId: true,
      shop: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }
  return user;
}

async function updateUser(id, data) {
  return prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      fullName: true,
      email: true,
      mobile: true,
      role: true,
      shopId: true,
      status: true,
      updatedAt: true,
    },
  });
}

async function toggleUserStatus(id) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  const newStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

  return prisma.user.update({
    where: { id },
    data: { status: newStatus },
    select: { id: true, fullName: true, email: true, status: true },
  });
}

module.exports = {
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
  toggleUserStatus,
};
