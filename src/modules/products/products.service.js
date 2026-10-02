const { prisma } = require('../../config/database');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

async function createProduct(data) {
  const {
    variants,
    shopId,
    categoryId,
    productTypeId,
    shortName,
    name,
    purchasePrice,
    mrp,
    sellingPrice,
    ...productData
  } = data;

  if (!shopId) {
    const err = new Error('Shop ID is required');
    err.statusCode = 400;
    throw err;
  }

  const finalShortName = (shortName && shortName.trim()) ? shortName.trim() : name.trim();

  // 1. Verify Category exists and belongs to active shop
  const category = await prisma.category.findFirst({
    where: { id: categoryId, shopId },
  });

  if (!category) {
    const err = new Error('Category not found or belongs to another shop');
    err.statusCode = 403;
    throw err;
  }

  // 2. Verify ProductType if provided
  if (productTypeId) {
    const productType = await prisma.productType.findFirst({
      where: { id: productTypeId, shopId, isActive: true },
    });
    if (!productType) {
      const err = new Error('Product Type not found or inactive in this shop');
      err.statusCode = 400;
      throw err;
    }
  }

  // 3. Generate product code if not provided
  const generatedCode = productData.code
    ? productData.code.trim().toUpperCase()
    : `${finalShortName.replace(/\s+/g, '-').toUpperCase()}-${Date.now().toString().slice(-4)}`;

  // 4. Check duplicate code within the same shop
  const existingCode = await prisma.product.findFirst({
    where: { shopId, code: generatedCode },
  });

  if (existingCode) {
    const err = new Error('Product code already exists in this shop');
    err.statusCode = 409;
    throw err;
  }

  // 5. Prepare Product Variants manually added by Owner
  const defaultVariants = (variants && variants.length > 0) ? variants : [
    {
      variantName: 'Standard',
      shortName: finalShortName,
      sku: generatedCode,
      purchasePrice: purchasePrice || 0,
      mrp: mrp || 0,
      sellingPrice: sellingPrice || 0,
    },
  ];

  return prisma.product.create({
    data: {
      ...productData,
      shopId,
      name: name.trim(),
      shortName: finalShortName,
      code: generatedCode,
      categoryId,
      productTypeId: productTypeId || null,
      variants: {
        create: defaultVariants.map((v) => ({
          variantName: v.variantName.trim(),
          shortName: v.shortName ? v.shortName.trim() : (v.variantName !== 'Standard' ? `${finalShortName} ${v.variantName.trim()}` : finalShortName),
          sku: v.sku ? v.sku.trim().toUpperCase() : `${generatedCode}-${v.variantName.replace(/\s+/g, '-').toUpperCase()}`,
          barcode: v.barcode ? v.barcode.trim() : null,
          unit: v.unit ? v.unit.trim() : null,
          purchasePrice: v.purchasePrice || 0,
          mrp: v.mrp || 0,
          sellingPrice: v.sellingPrice || 0,
          taxRate: v.taxRate !== undefined ? v.taxRate : (productData.taxRate || 0),
          isActive: true,
        })),
      },
    },
    include: {
      category: true,
      productType: true,
      variants: true,
    },
  });
}

async function getAllProducts(query) {
  const { page, limit, skip } = getPagination(query);
  const where = { isActive: true };

  if (query.shopId) {
    where.shopId = query.shopId;
  }

  if (query.categoryId) {
    where.categoryId = query.categoryId;
  }

  if (query.productTypeId) {
    where.productTypeId = query.productTypeId;
  }

  if (query.search) {
    const searchTerm = query.search.trim();
    where.OR = [
      { name: { contains: searchTerm, mode: 'insensitive' } },
      { shortName: { contains: searchTerm, mode: 'insensitive' } },
      { code: { contains: searchTerm, mode: 'insensitive' } },
      { brand: { contains: searchTerm, mode: 'insensitive' } },
      { barcode: { contains: searchTerm, mode: 'insensitive' } },
      { variants: { some: { sku: { contains: searchTerm, mode: 'insensitive' } } } },
      { variants: { some: { barcode: { contains: searchTerm, mode: 'insensitive' } } } },
      { variants: { some: { shortName: { contains: searchTerm, mode: 'insensitive' } } } },
    ];
  }

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      include: {
        category: true,
        productType: true,
        variants: {
          where: { isActive: true },
          include: {
            batches: {
              where: { quantity: { gt: 0 } },
            },
          },
        },
        batches: {
          where: { quantity: { gt: 0 } },
          orderBy: { expiryDate: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  const formattedProducts = products.map((p) => {
    const totalStock = p.batches.reduce((sum, b) => sum + b.quantity, 0);
    const primaryVariant = (p.variants && p.variants.length > 0) ? p.variants[0] : null;
    const primaryBatch = (p.batches && p.batches.length > 0) ? p.batches[0] : null;
    const purchasePrice = primaryVariant ? primaryVariant.purchasePrice : (primaryBatch ? primaryBatch.purchasePrice : 0);
    const mrp = primaryVariant ? primaryVariant.mrp : (primaryBatch ? primaryBatch.mrp : 0);
    const sellingPrice = primaryVariant ? primaryVariant.sellingPrice : (primaryBatch ? primaryBatch.sellingPrice : 0);
    const marginAmount = Math.round((sellingPrice - purchasePrice) * 100) / 100;
    const marginPercentage = purchasePrice > 0 ? Math.round(((sellingPrice - purchasePrice) / purchasePrice) * 100 * 10) / 10 : 0;

    return {
      ...p,
      purchasePrice,
      mrp,
      sellingPrice,
      marginAmount,
      marginPercentage,
      totalStock,
      isLowStock: totalStock <= p.minStock,
    };
  });

  return {
    products: formattedProducts,
    pagination: getPaginationMeta(total, page, limit),
  };
}

async function getProductById(id, shopId) {
  const where = { id };
  if (shopId) {
    where.shopId = shopId;
  }

  const product = await prisma.product.findFirst({
    where,
    include: {
      category: true,
      productType: true,
      shop: true,
      variants: {
        where: { isActive: true },
        include: {
          batches: {
            where: { quantity: { gt: 0 } },
            orderBy: { expiryDate: 'asc' },
          },
        },
      },
      batches: {
        include: { supplier: true },
        orderBy: { expiryDate: 'asc' },
      },
    },
  });

  if (!product) {
    const err = new Error('Product not found in this shop');
    err.statusCode = 404;
    throw err;
  }

  const totalStock = product.batches.reduce((sum, b) => sum + b.quantity, 0);
  const primaryVariant = (product.variants && product.variants.length > 0) ? product.variants[0] : null;
  const primaryBatch = (product.batches && product.batches.length > 0) ? product.batches[0] : null;
  const purchasePrice = primaryVariant ? primaryVariant.purchasePrice : (primaryBatch ? primaryBatch.purchasePrice : 0);
  const mrp = primaryVariant ? primaryVariant.mrp : (primaryBatch ? primaryBatch.mrp : 0);
  const sellingPrice = primaryVariant ? primaryVariant.sellingPrice : (primaryBatch ? primaryBatch.sellingPrice : 0);
  const marginAmount = Math.round((sellingPrice - purchasePrice) * 100) / 100;
  const marginPercentage = purchasePrice > 0 ? Math.round(((sellingPrice - purchasePrice) / purchasePrice) * 100 * 10) / 10 : 0;

  return {
    ...product,
    purchasePrice,
    mrp,
    sellingPrice,
    marginAmount,
    marginPercentage,
    totalStock,
    isLowStock: totalStock <= product.minStock,
  };
}

async function updateProduct(id, shopId, data) {
  const product = await getProductById(id, shopId);
  const { purchasePrice, mrp, sellingPrice, ...cleanProductData } = data;

  // If price updates are provided, synchronize the primary variant
  if (purchasePrice !== undefined || mrp !== undefined || sellingPrice !== undefined) {
    const variantUpdate = {};
    if (purchasePrice !== undefined) variantUpdate.purchasePrice = purchasePrice;
    if (mrp !== undefined) variantUpdate.mrp = mrp;
    if (sellingPrice !== undefined) variantUpdate.sellingPrice = sellingPrice;

    const primaryVariant = product.variants && product.variants.length > 0 ? product.variants[0] : null;
    if (primaryVariant) {
      await prisma.productVariant.update({
        where: { id: primaryVariant.id },
        data: variantUpdate,
      });
    }
  }

  return prisma.product.update({
    where: { id: product.id },
    data: cleanProductData,
    include: { category: true, productType: true, variants: true },
  });
}

async function deleteProduct(id, shopId) {
  const product = await getProductById(id, shopId);
  return prisma.product.update({
    where: { id: product.id },
    data: { isActive: false },
  });
}

module.exports = {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
};
