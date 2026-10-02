const { prisma } = require('../../config/database');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');
const { emitShopEvent } = require('../../config/socket');
const { logAuditAction } = require('../../utils/auditLogger');

async function createSupplier(data) {
  const { userId, ...supplierData } = data;

  if (!supplierData.shopId) {
    const err = new Error('Shop ID is required');
    err.statusCode = 400;
    throw err;
  }

  const phone = supplierData.phone.trim();
  const name = supplierData.name.trim();
  const companyName = supplierData.companyName ? supplierData.companyName.trim() : name;

  // Check duplicate supplier by phone in active shop
  const existingPhone = await prisma.supplier.findFirst({
    where: {
      shopId: supplierData.shopId,
      phone: { equals: phone, mode: 'insensitive' },
      isActive: true,
    },
  });

  if (existingPhone) {
    const err = new Error('Supplier with this phone number already exists in your shop');
    err.statusCode = 409;
    throw err;
  }

  const supplier = await prisma.supplier.create({
    data: {
      ...supplierData,
      name,
      companyName,
      phone,
    },
  });

  emitShopEvent(supplierData.shopId, 'supplier.created', supplier);
  logAuditAction({
    userId: userId || null,
    shopId: supplierData.shopId,
    action: 'SUPPLIER_CREATE',
    module: 'SUPPLIERS',
    recordId: supplier.id,
    newValue: { name: supplier.name, companyName: supplier.companyName, phone: supplier.phone },
  });

  return supplier;
}

async function getAllSuppliers(query) {
  const { page, limit, skip } = getPagination(query);
  const where = { isActive: true };

  if (query.shopId) {
    where.shopId = query.shopId;
  }

  if (query.search) {
    const search = query.search.trim();
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { companyName: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { alternatePhone: { contains: search, mode: 'insensitive' } },
      { suppliedProducts: { contains: search, mode: 'insensitive' } },
      { gstin: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [total, suppliers] = await Promise.all([
    prisma.supplier.count({ where }),
    prisma.supplier.findMany({
      where,
      skip,
      take: limit,
      orderBy: { name: 'asc' },
    }),
  ]);

  return {
    suppliers,
    pagination: getPaginationMeta(total, page, limit),
  };
}

async function findSupplierOrThrow(id, shopId, select = null) {
  const where = { id };
  if (shopId) where.shopId = shopId;

  const supplier = await prisma.supplier.findFirst({
    where,
    ...(select ? { select } : {}),
  });

  if (!supplier) {
    const err = new Error('Supplier profile not found in this shop');
    err.statusCode = 404;
    throw err;
  }

  return supplier;
}

async function getSupplierById(id, shopId) {
  const where = { id };
  if (shopId) {
    where.shopId = shopId;
  }

  const supplier = await prisma.supplier.findFirst({
    where,
    include: {
      batches: {
        include: { product: true, variant: true },
        take: 20,
        orderBy: { createdAt: 'desc' },
      },
      payments: {
        take: 20,
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!supplier) {
    const err = new Error('Supplier profile not found in this shop');
    err.statusCode = 404;
    throw err;
  }

  return supplier;
}

async function updateSupplier(id, shopId, data) {
  const supplier = await findSupplierOrThrow(id, shopId, { id: true, shopId: true, name: true, companyName: true });
  const { userId, ...updateData } = data;
  const updatedSupplier = await prisma.supplier.update({
    where: { id: supplier.id },
    data: updateData,
  });

  emitShopEvent(supplier.shopId, 'supplier.updated', updatedSupplier);
  logAuditAction({
    userId: userId || null,
    shopId: supplier.shopId,
    action: 'SUPPLIER_UPDATE',
    module: 'SUPPLIERS',
    recordId: supplier.id,
    oldValue: { name: supplier.name, companyName: supplier.companyName },
    newValue: { name: updatedSupplier.name, companyName: updatedSupplier.companyName },
  });

  return updatedSupplier;
}

async function deleteSupplier(id, shopId) {
  const supplier = await findSupplierOrThrow(id, shopId, { id: true });
  return prisma.supplier.update({
    where: { id: supplier.id },
    data: { isActive: false },
  });
}

async function getSupplierTransactions(id, shopId, query = {}) {
  const supplier = await findSupplierOrThrow(id, shopId, {
    id: true,
    name: true,
    companyName: true,
    phone: true,
    khataBalance: true,
  });
  const { page, limit, skip } = getPagination(query);

  const where = { supplierId: supplier.id };
  if (shopId) {
    where.shopId = shopId;
  }

  const [total, batches] = await Promise.all([
    prisma.inventoryBatch.count({ where }),
    prisma.inventoryBatch.findMany({
      where,
      skip,
      take: limit,
      include: {
        product: { select: { id: true, name: true, code: true } },
        variant: { select: { id: true, variantName: true, sku: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    supplier: {
      id: supplier.id,
      name: supplier.name,
      companyName: supplier.companyName,
      phone: supplier.phone,
      khataBalance: supplier.khataBalance,
    },
    batches,
    pagination: getPaginationMeta(total, page, limit),
  };
}

async function getSupplierProducts(id, shopId) {
  const supplier = await findSupplierOrThrow(id, shopId, {
    id: true,
    name: true,
    companyName: true,
    phone: true,
    suppliedProducts: true,
  });
  const batches = await prisma.inventoryBatch.findMany({
    where: { supplierId: supplier.id },
    include: {
      product: { select: { id: true, name: true, shortName: true, code: true, uom: true } },
      variant: { select: { id: true, variantName: true, sku: true, sellingPrice: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Extract unique products
  const productMap = new Map();
  batches.forEach((b) => {
    if (b.product && !productMap.has(b.productId)) {
      productMap.set(b.productId, {
        productId: b.productId,
        name: b.product.name,
        shortName: b.product.shortName || b.product.name,
        code: b.product.code,
        lastPurchasePrice: b.purchasePrice,
        lastRestockDate: b.createdAt,
      });
    }
  });

  return {
    supplier: {
      id: supplier.id,
      name: supplier.name,
      companyName: supplier.companyName,
      phone: supplier.phone,
      suppliedProducts: supplier.suppliedProducts,
    },
    products: Array.from(productMap.values()),
  };
}

async function getSupplierOutstanding(id, shopId) {
  const supplier = await findSupplierOrThrow(id, shopId, {
    id: true,
    name: true,
    companyName: true,
    phone: true,
    gstin: true,
    khataBalance: true,
  });

  return {
    supplierId: supplier.id,
    supplierName: supplier.name,
    companyName: supplier.companyName,
    phone: supplier.phone,
    gstin: supplier.gstin,
    khataBalance: supplier.khataBalance, // Positive = Shop owes supplier (Payable)
    status: supplier.khataBalance > 0 ? 'PAYABLE' : 'SETTLED',
  };
}

async function recordSupplierPayment(id, shopId, data) {
  const supplier = await findSupplierOrThrow(id, shopId, {
    id: true,
    shopId: true,
  });
  const paymentService = require('../payments/payments.service');
  return paymentService.recordPayment({
    ...data,
    shopId: supplier.shopId,
    supplierId: supplier.id,
  });
}

module.exports = {
  createSupplier,
  getAllSuppliers,
  getSupplierById,
  updateSupplier,
  deleteSupplier,
  getSupplierTransactions,
  getSupplierProducts,
  getSupplierOutstanding,
  recordSupplierPayment,
};
