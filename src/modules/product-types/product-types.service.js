const { prisma } = require('../../config/database');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

const DEFAULT_PRODUCT_TYPES = [
  { name: 'Bottle', shortName: 'BTL', description: 'Liquid bottles (100ml, 500ml, 1L)' },
  { name: 'Bag', shortName: 'BAG', description: 'Fertilizer & seed bags (25kg, 50kg)' },
  { name: 'Packet', shortName: 'PKT', description: 'Seed & powder packets (100g, 500g)' },
  { name: 'Box', shortName: 'BOX', description: 'Box packaging & multi-packs' },
  { name: 'Can', shortName: 'CAN', description: 'Liquid chemical cans & drums' },
  { name: 'Drum', shortName: 'DRM', description: 'Bulk storage drums' },
  { name: 'Pouch', shortName: 'PCH', description: 'Flexible foil & plastic pouches' },
];

async function createProductType(data) {
  const { shopId, name, shortName, description } = data;

  if (!shopId) {
    const error = new Error('Shop ID is required');
    error.statusCode = 400;
    throw error;
  }

  const normalizedName = name.trim();

  // Check duplicate product type name within the same shop
  const existingType = await prisma.productType.findFirst({
    where: {
      shopId,
      name: { equals: normalizedName, mode: 'insensitive' },
    },
  });

  if (existingType) {
    const error = new Error('Product Type with this name already exists in your shop');
    error.statusCode = 409;
    throw error;
  }

  return prisma.productType.create({
    data: {
      shopId,
      name: normalizedName,
      shortName: shortName ? shortName.trim().toUpperCase() : null,
      description: description ? description.trim() : null,
      isActive: true,
    },
  });
}

async function getAllProductTypes(query = {}) {
  const where = { isActive: true };

  if (query.shopId) {
    where.shopId = query.shopId;
  }

  if (query.search) {
    where.name = { contains: query.search.trim(), mode: 'insensitive' };
  }

  const isPaginated = query.page !== undefined || query.limit !== undefined;

  if (isPaginated) {
    const { page, limit, skip } = getPagination(query);
    const [total, productTypes] = await Promise.all([
      prisma.productType.count({ where }),
      prisma.productType.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
    ]);

    return {
      productTypes,
      pagination: getPaginationMeta(total, page, limit),
    };
  }

  return prisma.productType.findMany({
    where,
    orderBy: { name: 'asc' },
  });
}

async function getProductTypeById(id, shopId = null) {
  const where = { id };
  if (shopId) {
    where.shopId = shopId;
  }

  const productType = await prisma.productType.findFirst({
    where,
    include: {
      _count: { select: { products: true } },
    },
  });

  if (!productType) {
    const err = new Error('Product Type not found in this shop');
    err.statusCode = 404;
    throw err;
  }

  return productType;
}

async function updateProductType(id, shopId, data) {
  const productType = await getProductTypeById(id, shopId);
  const updatePayload = {};

  if (data.name !== undefined) {
    const newName = data.name.trim();
    if (newName.toLowerCase() !== productType.name.toLowerCase()) {
      const duplicate = await prisma.productType.findFirst({
        where: {
          shopId: productType.shopId,
          name: { equals: newName, mode: 'insensitive' },
          id: { not: id },
        },
      });

      if (duplicate) {
        const error = new Error('Product Type with this name already exists in your shop');
        error.statusCode = 409;
        throw error;
      }
    }
    updatePayload.name = newName;
  }

  if (data.shortName !== undefined) {
    updatePayload.shortName = data.shortName ? data.shortName.trim().toUpperCase() : null;
  }

  if (data.description !== undefined) {
    updatePayload.description = data.description ? data.description.trim() : null;
  }

  return prisma.productType.update({
    where: { id: productType.id },
    data: updatePayload,
  });
}

async function deleteProductType(id, shopId) {
  const productType = await getProductTypeById(id, shopId);
  return prisma.productType.update({
    where: { id: productType.id },
    data: { isActive: false },
  });
}

async function seedDefaultProductTypes(shopId) {
  if (!shopId) return;

  const count = await prisma.productType.count({ where: { shopId } });
  if (count > 0) return;

  await prisma.productType.createMany({
    data: DEFAULT_PRODUCT_TYPES.map((pt) => ({
      shopId,
      name: pt.name,
      shortName: pt.shortName,
      description: pt.description,
    })),
    skipDuplicates: true,
  });
}

module.exports = {
  createProductType,
  getAllProductTypes,
  getProductTypeById,
  updateProductType,
  deleteProductType,
  seedDefaultProductTypes,
};
