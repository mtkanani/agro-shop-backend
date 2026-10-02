const request = require('supertest');
const app = require('../src/app');
const { generateAccessToken } = require('../src/utils/jwt');
const { prisma } = require('../src/config/database');
const { paginateThroughQuery } = require('../src/utils/paginationLoop');

describe('Universal Pagination & Pagination Loop Test Suite', () => {
  let shop;
  let owner;
  let tokenOwner;

  beforeAll(async () => {
    shop = await prisma.shop.create({
      data: {
        shopName: 'Pagination Loop Test Agro',
        code: `PLTA_${Date.now()}`,
        mobile: `+919100${String(Date.now()).slice(-6)}`,
        status: 'ACTIVE',
      },
    });

    owner = await prisma.user.create({
      data: {
        shopId: shop.id,
        fullName: 'Pagination Owner',
        email: `page_owner_${Date.now()}@shop.com`,
        mobile: shop.mobile,
        passwordHash: 'hash',
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });
    tokenOwner = generateAccessToken(owner);

    // Seed test categories
    await prisma.category.createMany({
      data: [
        { shopId: shop.id, name: `Bio Pesticides ${Date.now()}` },
        { shopId: shop.id, name: `Chemical Sprays ${Date.now()}` },
        { shopId: shop.id, name: `Drip Pipes ${Date.now()}` },
        { shopId: shop.id, name: `Foliar Fertilizers ${Date.now()}` },
      ],
    });

    // Seed test product types
    await prisma.productType.createMany({
      data: [
        { shopId: shop.id, name: `Canister ${Date.now()}`, shortName: 'CAN', isActive: true },
        { shopId: shop.id, name: `Sack ${Date.now()}`, shortName: 'SCK', isActive: true },
        { shopId: shop.id, name: `Ampoule ${Date.now()}`, shortName: 'AMP', isActive: true },
      ],
    });
  });

  // Test 1: Categories with pagination parameters
  it('GET /api/v1/categories?page=1&limit=2 - should return paginated response with metadata', async () => {
    const res = await request(app)
      .get('/api/v1/categories')
      .query({ page: 1, limit: 2 })
      .set('Authorization', `Bearer ${tokenOwner}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('pagination');
    expect(res.body.pagination.currentPage).toEqual(1);
    expect(res.body.pagination.itemsPerPage).toEqual(2);
    expect(res.body.pagination.totalItems).toBeGreaterThanOrEqual(4);
    expect(res.body.pagination.totalPages).toBeGreaterThanOrEqual(2);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
  });

  // Test 2: Categories without pagination (Backward Compatibility for Dropdowns)
  it('GET /api/v1/categories - should return full array without pagination when page/limit omitted', async () => {
    const res = await request(app)
      .get('/api/v1/categories')
      .set('Authorization', `Bearer ${tokenOwner}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.pagination).toBeUndefined();
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(4);
  });

  // Test 3: Product Types with pagination parameters
  it('GET /api/v1/product-types?page=1&limit=2 - should return paginated product types', async () => {
    const res = await request(app)
      .get('/api/v1/product-types')
      .query({ page: 1, limit: 2 })
      .set('Authorization', `Bearer ${tokenOwner}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('pagination');
    expect(res.body.pagination.itemsPerPage).toEqual(2);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
  });

  // Test 4: Product Types without pagination (Backward Compatibility)
  it('GET /api/v1/product-types - should return array for dropdowns when unpaginated', async () => {
    const res = await request(app)
      .get('/api/v1/product-types')
      .set('Authorization', `Bearer ${tokenOwner}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.pagination).toBeUndefined();
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  // Test 5: Near-Expiry Batches with pagination
  it('GET /api/v1/inventory/near-expiry?page=1&limit=1 - should return paginated near-expiry batches', async () => {
    const res = await request(app)
      .get('/api/v1/inventory/near-expiry')
      .query({ page: 1, limit: 1 })
      .set('Authorization', `Bearer ${tokenOwner}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('pagination');
    expect(res.body.pagination.itemsPerPage).toEqual(1);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  // Test 6: Unit Test for paginateThroughQuery loop
  it('paginateThroughQuery - should iterate over database records in safe bounded chunks', async () => {
    let processedBatches = 0;
    let totalItemsTraversed = 0;

    const result = await paginateThroughQuery(prisma.category, {
      where: { shopId: shop.id },
      chunkSize: 2,
      onBatch: async (categories, meta) => {
        processedBatches += 1;
        totalItemsTraversed += categories.length;
        expect(categories.length).toBeLessThanOrEqual(2);
        expect(meta.chunkSize).toEqual(2);
      },
    });

    expect(result.totalProcessed).toBeGreaterThanOrEqual(4);
    expect(result.batchesCount).toBeGreaterThanOrEqual(2);
    expect(processedBatches).toEqual(result.batchesCount);
    expect(totalItemsTraversed).toEqual(result.totalProcessed);
  });
});
