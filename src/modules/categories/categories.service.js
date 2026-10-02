const { prisma } = require('../../config/database');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

const DEFAULT_AGRO_CATEGORIES = [
  { name: 'Seeds', description: 'Agricultural seed varieties & hybrid seeds' },
  { name: 'Fertilizers', description: 'Chemical, NPK, and soil nutrient fertilizers' },
  { name: 'Pesticides', description: 'Crop protection pesticides & pest controls' },
  { name: 'Insecticides', description: 'Insect controls and spray products' },
  { name: 'Fungicides', description: 'Fungal infection prevention and treatments' },
  { name: 'Herbicides', description: 'Weed control chemicals & herbicides' },
  { name: 'Plant Growth Promoters', description: 'Growth enhancers, tonics & vitamins' },
  { name: 'Organic Products', description: 'Organic fertilizers, bio-stimulants & compost' },
  { name: 'Bio Fertilizers', description: 'Biological soil enrichers & bio-agents' },
  { name: 'Agricultural Tools', description: 'Manual farm tools, sprayers & accessories' },
  { name: 'Irrigation Products', description: 'Drip irrigation pipes, sprinklers & fittings' },
  { name: 'Farm Equipment', description: 'Machinery parts & agricultural equipment' },
  { name: 'Other', description: 'General agricultural shop items' },
];

async function createCategory(data) {
  const { shopId, name, description } = data;

  if (!shopId) {
    const error = new Error('Shop ID is required');
    error.statusCode = 400;
    throw error;
  }

  const normalizedName = name.trim();

  // Check duplicate category name within the same shop
  const existingCategory = await prisma.category.findFirst({
    where: {
      shopId,
      name: { equals: normalizedName, mode: 'insensitive' },
    },
  });

  if (existingCategory) {
    const error = new Error('Category with this name already exists in your shop');
    error.statusCode = 409;
    throw error;
  }

  return prisma.category.create({
    data: {
      shopId,
      name: normalizedName,
      description: description ? description.trim() : null,
    },
    include: {
      _count: { select: { products: true } },
    },
  });
}

async function getAllCategories(query = {}) {
  const where = {};

  if (query.shopId) {
    where.shopId = query.shopId;
  }

  if (query.search) {
    where.name = { contains: query.search.trim(), mode: 'insensitive' };
  }

  const isPaginated = query.page !== undefined || query.limit !== undefined;

  if (isPaginated) {
    const { page, limit, skip } = getPagination(query);
    const [total, categories] = await Promise.all([
      prisma.category.count({ where }),
      prisma.category.findMany({
        where,
        skip,
        take: limit,
        include: {
          _count: { select: { products: true } },
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    return {
      categories,
      pagination: getPaginationMeta(total, page, limit),
    };
  }

  // Backward-compatible unpaginated list (for dropdowns, forms, etc.)
  const categories = await prisma.category.findMany({
    where,
    include: {
      _count: { select: { products: true } },
    },
    orderBy: { name: 'asc' },
  });

  return categories;
}

async function getCategoryById(id, shopId = null) {
  const where = { id };
  if (shopId) {
    where.shopId = shopId;
  }

  const category = await prisma.category.findFirst({
    where,
    include: {
      products: {
        take: 10,
        orderBy: { createdAt: 'desc' },
      },
      _count: { select: { products: true } },
    },
  });

  if (!category) {
    const err = new Error('Category not found in this shop');
    err.statusCode = 404;
    throw err;
  }

  return category;
}

async function updateCategory(id, shopId, data) {
  const category = await getCategoryById(id, shopId);
  const updatePayload = {};

  if (data.name !== undefined) {
    const newName = data.name.trim();
    if (newName.toLowerCase() !== category.name.toLowerCase()) {
      const duplicate = await prisma.category.findFirst({
        where: {
          shopId: category.shopId,
          name: { equals: newName, mode: 'insensitive' },
          id: { not: id },
        },
      });

      if (duplicate) {
        const error = new Error('Category with this name already exists in your shop');
        error.statusCode = 409;
        throw error;
      }
    }
    updatePayload.name = newName;
  }

  if (data.description !== undefined) {
    updatePayload.description = data.description ? data.description.trim() : null;
  }

  return prisma.category.update({
    where: { id: category.id },
    data: updatePayload,
    include: {
      _count: { select: { products: true } },
    },
  });
}

async function deleteCategory(id, shopId) {
  const category = await getCategoryById(id, shopId);

  // Check if products exist in category
  const productCount = await prisma.product.count({ where: { categoryId: id } });
  if (productCount > 0) {
    // Unlink products or delete safely
    await prisma.product.updateMany({
      where: { categoryId: id },
      data: { categoryId: null },
    });
  }

  return prisma.category.delete({
    where: { id: category.id },
  });
}

async function seedDefaultCategories(shopId) {
  if (!shopId) return;

  const count = await prisma.category.count({ where: { shopId } });
  if (count > 0) return; // Categories already initialized

  await prisma.category.createMany({
    data: DEFAULT_AGRO_CATEGORIES.map((cat) => ({
      shopId,
      name: cat.name,
      description: cat.description,
    })),
    skipDuplicates: true,
  });
}

module.exports = {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  seedDefaultCategories,
};
