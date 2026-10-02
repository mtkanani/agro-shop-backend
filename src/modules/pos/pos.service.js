const { prisma } = require('../../config/database');

/**
 * 1. Ultra-Low-Latency Single-Scan Barcode / Shortcode Fast Lookup
 * Time Complexity: O(1) B-Tree index seek + FIFO active batch resolution
 */
async function scanProductByCode(shopId, rawCode) {
  const code = String(rawCode).trim();
  const now = new Date();

  // Single B-Tree index seek on PostgreSQL via barcode or code with FIFO batch projection
  const product = await prisma.product.findFirst({
    where: {
      shopId,
      isActive: true,
      OR: [
        { barcode: code },
        { code: code },
      ],
    },
    select: {
      id: true,
      name: true,
      shortName: true,
      code: true,
      barcode: true,
      brand: true,
      hsnCode: true,
      taxRate: true,
      uom: true,
      category: {
        select: { id: true, name: true },
      },
      batches: {
        where: {
          quantity: { gt: 0 },
          expiryDate: { gt: now },
        },
        orderBy: {
          expiryDate: 'asc', // FIFO: Earliest Expiring First!
        },
        select: {
          id: true,
          batchNumber: true,
          expiryDate: true,
          quantity: true,
          sellingPrice: true,
          purchasePrice: true,
          mrp: true,
        },
      },
    },
  });

  if (!product) {
    const err = new Error(`Product with barcode or code "${code}" not found in this shop`);
    err.statusCode = 404;
    throw err;
  }

  const activeBatches = product.batches || [];
  const selectedBatch = activeBatches.length > 0 ? activeBatches[0] : null;
  const totalActiveStock = activeBatches.reduce((sum, b) => sum + (b.quantity || 0), 0);
  const outOfStock = activeBatches.length === 0;

  return {
    id: product.id,
    name: product.name,
    shortName: product.shortName,
    code: product.code,
    barcode: product.barcode,
    brand: product.brand,
    category: product.category ? product.category.name : '',
    categoryId: product.category ? product.category.id : null,
    uom: product.uom,
    taxRate: product.taxRate,
    hsnCode: product.hsnCode,
    outOfStock,
    totalActiveStock,
    activeBatchesCount: activeBatches.length,
    selectedBatch: selectedBatch
      ? {
          id: selectedBatch.id,
          batchNumber: selectedBatch.batchNumber,
          expiryDate: selectedBatch.expiryDate,
          sellingPrice: selectedBatch.sellingPrice,
          purchasePrice: selectedBatch.purchasePrice,
          mrp: selectedBatch.mrp,
          availableStock: selectedBatch.quantity,
        }
      : null,
    allActiveBatches: activeBatches.map((b) => ({
      id: b.id,
      batchNumber: b.batchNumber,
      expiryDate: b.expiryDate,
      sellingPrice: b.sellingPrice,
      mrp: b.mrp,
      availableStock: b.quantity,
    })),
  };
}

/**
 * 2. Counter Catalogue Generation with Keyset / Cursor Pagination
 * Time Complexity: O(log N) index seek via Primary Key cursor (id > cursor)
 */
async function getCatalogue(shopId, query = {}) {
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || '18', 10)));
  const now = new Date();

  const where = { shopId, isActive: true };

  if (query.categoryId) {
    where.categoryId = query.categoryId;
  }

  if (query.search && query.search.trim()) {
    const term = query.search.trim();
    where.OR = [
      { name: { contains: term, mode: 'insensitive' } },
      { code: { contains: term, mode: 'insensitive' } },
      { barcode: { contains: term, mode: 'insensitive' } },
      { brand: { contains: term, mode: 'insensitive' } },
    ];
  }

  // Keyset (Cursor-Based) Pagination vs Offset Fallback
  let skip = 0;
  const take = limit + 1; // 1 extra to check hasNextPage

  if (query.cursor && query.cursor.trim()) {
    where.id = { gt: query.cursor.trim() }; // O(log N) B-Tree seek directly on Primary Key
  } else if (query.page) {
    const pageNum = Math.max(1, parseInt(query.page, 10));
    skip = (pageNum - 1) * limit;
  }

  const [products, totalCount] = await Promise.all([
    prisma.product.findMany({
      where,
      take,
      skip,
      orderBy: { id: 'asc' },
      select: {
        id: true,
        name: true,
        shortName: true,
        code: true,
        barcode: true,
        brand: true,
        uom: true,
        taxRate: true,
        category: { select: { id: true, name: true } },
        batches: {
          where: {
            quantity: { gt: 0 },
            expiryDate: { gt: now },
          },
          orderBy: { expiryDate: 'asc' },
          take: 1,
          select: {
            batchNumber: true,
            sellingPrice: true,
            mrp: true,
            quantity: true,
          },
        },
      },
    }),
    prisma.product.count({
      where: {
        shopId,
        isActive: true,
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      },
    }),
  ]);

  const hasNextPage = products.length > limit;
  const items = hasNextPage ? products.slice(0, limit) : products;
  const nextCursor = hasNextPage && items.length > 0 ? items[items.length - 1].id : null;

  const formattedCatalogue = items.map((p) => {
    const activeBatch = p.batches && p.batches.length > 0 ? p.batches[0] : null;
    return {
      id: p.id,
      name: p.name,
      shortName: p.shortName,
      code: p.code,
      barcode: p.barcode,
      brand: p.brand,
      category: p.category ? p.category.name : '',
      uom: p.uom,
      taxRate: p.taxRate,
      qrPayload: p.barcode || p.code,
      price: activeBatch ? activeBatch.sellingPrice : 0,
      mrp: activeBatch ? activeBatch.mrp : 0,
      activeBatchNumber: activeBatch ? activeBatch.batchNumber : null,
      inStock: Boolean(activeBatch && activeBatch.quantity > 0),
    };
  });

  return {
    catalogue: formattedCatalogue,
    pagination: {
      totalCount,
      limit,
      hasNextPage,
      nextCursor,
    },
  };
}

module.exports = {
  scanProductByCode,
  getCatalogue,
};
